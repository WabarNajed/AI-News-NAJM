import { sources, REFRESH_MINUTES } from "./sources";
import { readCache, claim, writeCache, failCache, markAttempt, financialResults } from "./db";
import { dedupe, mergeArticles } from "./news-utils";
import { fetchSource } from "./news-fetch";
import type { Article, DashboardData, Source } from "./types";

const refreshKey = "refresh:v3";
async function ingest(source: Source) {
  const key = `source:${source.id}`;
  try {
    const old = await readCache(key);
    await markAttempt(key);
    const parsed = await fetchSource(source);
    const oldArticles = Array.isArray(old?.payload) ? old.payload as Article[] : [];
    await writeCache(key, mergeArticles(oldArticles, parsed));
    return true;
  } catch (error) {
    const message = error instanceof Error && /[\u0600-\u06ff]/.test(error.message)
      ? error.message : "تعذّر الاتصال بالمصدر ضمن المهلة؛ نحتفظ بآخر جلب ناجح.";
    await failCache(key, message);
    return false;
  }
}
export async function refreshNews(manual = false) {
  const previous = await readCache(refreshKey);
  const interval = manual || previous?.error ? 60000 : REFRESH_MINUTES * 60000;
  if (!(await claim(refreshKey, interval))) return;
  const results = await Promise.allSettled(sources.filter((s) => s.connector).map(ingest));
  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value).length;
  if (succeeded) await writeCache(refreshKey, { succeeded });
  else await failCache(refreshKey, "تعذّر التحديث من جميع المصادر؛ نعرض آخر بيانات ناجحة.");
}
export async function getDashboard(): Promise<DashboardData> {
  const health: DashboardData["sources"] = [];
  const articles: Article[] = [];
  const refresh = await readCache(refreshKey);
  const rows = await Promise.all(sources.map(async (source) => ({
    source, row: source.connector ? await readCache(`source:${source.id}`) : null,
  })));
  for (const { source, row } of rows) {
    const items = Array.isArray(row?.payload) ? row.payload as Article[] : [];
    articles.push(...items);
    health.push({
      ...source,
      status: !source.connector ? "directory" : row?.updatedAt && !row.error ? "connected" : "unavailable",
      lastSuccess: row?.updatedAt?.toISOString() ?? null,
      lastAttempt: row?.attemptedAt?.toISOString() ?? null,
      error: row?.error ?? null, count: items.length,
    });
  }
  const lastSuccess = health.map((s) => s.lastSuccess).filter(Boolean).sort().at(-1) ?? null;
  const lastAttempt = refresh?.attemptedAt?.toISOString() ?? health.map((s) => s.lastAttempt).filter(Boolean).sort().at(-1) ?? null;
  const refreshing = !!refresh?.lockedUntil && refresh.lockedUntil.getTime() > Date.now();
  const interval = refresh?.error ? 60000 : REFRESH_MINUTES * 60000;
  return {
    articles: dedupe(articles).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    sources: health, results: await financialResults(), lastSuccess, lastAttempt,
    stale: !lastSuccess || Date.now() - Date.parse(lastSuccess) > REFRESH_MINUTES * 120000 || health.some((s) => s.connector && s.status === "unavailable"),
    refreshMinutes: REFRESH_MINUTES, storageError: false, refreshing,
    refreshDue: !refreshing && (!refresh?.attemptedAt || Date.now() - refresh.attemptedAt.getTime() >= interval),
  };
}
export function unavailableDashboard(): DashboardData {
  return {
    articles: [], sources: sources.map((s) => ({ ...s, status: s.connector ? "unavailable" : "directory", lastSuccess: null, lastAttempt: null, error: s.connector ? "تعذّر الوصول إلى التخزين." : null, count: 0 })),
    results: [], lastSuccess: null, lastAttempt: null, stale: true,
    refreshMinutes: REFRESH_MINUTES, storageError: true, refreshing: false, refreshDue: false,
  };
}
