import { load } from "cheerio";
import robotsParser from "robots-parser";
import { sources, REFRESH_MINUTES } from "./sources";
import {
  readCache,
  claim,
  writeCache,
  failCache,
  financialResults,
} from "./db";
import { dedupe, mergeArticles, parseSource, plain } from "./news-utils";
import type { Article, DashboardData, Source } from "./types";

async function request(url: string, attempt = 0): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      redirect: "error",
      cache: "no-store",
      headers: {
        "User-Agent": "NajmMarketReader/1.0",
        Accept: "text/html,text/plain",
      },
    });
    if (!res.ok) {
      if (res.status < 500 || attempt)
        throw new Error(`المصدر غير متاح (${res.status}).`);
      return request(url, 1);
    }
    if (Number(res.headers.get("content-length") ?? 0) > 2_000_000)
      throw new Error("حجم استجابة المصدر غير مدعوم.");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("استجابة المصدر فارغة.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new Error("حجم استجابة المصدر غير مدعوم.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    if (
      !attempt &&
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message === "fetch failed")
    )
      return request(url, 1);
    throw error;
  }
}
async function ingest(source: Source) {
  const key = `source:${source.id}`;
  const old = await readCache(key);
  try {
    const robotsUrl = new URL("/robots.txt", source.url).href;
    const policy = robotsParser(robotsUrl, await request(robotsUrl));
    if (policy.isAllowed(source.url, "NajmMarketReader") === false)
      throw new Error("سياسة المصدر لا تسمح بالجلب الآلي.");
    const parsed = parseSource(await request(source.url), source);
    if (source.connector === "cma") {
      await Promise.all(
        parsed.slice(0, 4).map(async (article) => {
          if (policy.isAllowed(article.url, "NajmMarketReader") === false)
            return;
          try {
            const $ = load(await request(article.url));
            const content = plain($(".ms-rtestate-field").first().text());
            if (content.length > 100) {
              article.content = content.slice(0, 8000);
              article.summary =
                content.slice(0, 500) + (content.length > 500 ? "…" : "");
            }
          } catch {
            /* Official listing metadata remains usable if the article body is unavailable. */
          }
        }),
      );
    }
    const oldArticles = Array.isArray(old?.payload)
      ? (old.payload as Article[])
      : [];
    await writeCache(key, mergeArticles(oldArticles, parsed));
  } catch (error) {
    const message =
      error instanceof Error && /[\u0600-\u06ff]/.test(error.message)
        ? error.message
        : "تعذّر الاتصال بالمصدر ضمن المهلة؛ نحتفظ بآخر جلب ناجح.";
    await failCache(key, message);
  }
}
export async function refreshNews() {
  if (!(await claim("refresh:v2", REFRESH_MINUTES * 60000))) return;
  try {
    await Promise.all(sources.filter((s) => s.connector).map(ingest));
    await writeCache("refresh:v2", { completed: true });
  } catch {
    await failCache("refresh:v2", "تعذّر حفظ التحديث في قاعدة البيانات.");
  }
}
export async function getDashboard(): Promise<DashboardData> {
  const health: DashboardData["sources"] = [];
  const articles: Article[] = [];
  const rows = await Promise.all(
    sources.map(async (source) => ({
      source,
      row: source.connector ? await readCache(`source:${source.id}`) : null,
    })),
  );
  for (const { source, row } of rows) {
    const items = Array.isArray(row?.payload) ? (row.payload as Article[]) : [];
    articles.push(...items);
    health.push({
      ...source,
      status: !source.connector
        ? "directory"
        : row?.updatedAt && !row.error
          ? "connected"
          : "unavailable",
      lastSuccess: row?.updatedAt?.toISOString() ?? null,
      lastAttempt: row?.attemptedAt?.toISOString() ?? null,
      error: row?.error ?? null,
      count: items.length,
    });
  }
  const lastSuccess =
    health
      .map((s) => s.lastSuccess)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const lastAttempt =
    health
      .map((s) => s.lastAttempt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  return {
    articles: dedupe(articles).sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    ),
    sources: health,
    results: await financialResults(),
    lastSuccess,
    lastAttempt,
    stale:
      !lastSuccess ||
      Date.now() - Date.parse(lastSuccess) > REFRESH_MINUTES * 120000 ||
      health.some((s) => s.connector && s.status === "unavailable"),
    refreshMinutes: REFRESH_MINUTES,
    storageError: false,
  };
}
export function unavailableDashboard(): DashboardData {
  return {
    articles: [],
    sources: sources.map((s) => ({
      ...s,
      status: s.connector ? "unavailable" : "directory",
      lastSuccess: null,
      lastAttempt: null,
      error: s.connector ? "تعذّر الوصول إلى التخزين." : null,
      count: 0,
    })),
    results: [],
    lastSuccess: null,
    lastAttempt: null,
    stale: true,
    refreshMinutes: REFRESH_MINUTES,
    storageError: true,
  };
}
