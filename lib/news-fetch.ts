import robotsParser from "robots-parser";
import { parseSource } from "./news-utils";
import type { Source } from "./types";

class UpstreamError extends Error {
  constructor(public status: number) { super(`المصدر غير متاح (HTTP ${status}).`); }
}

async function request(url: string, fetcher: typeof fetch, signal: AbortSignal, attempt = 0): Promise<string> {
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      redirect: "error", cache: "no-store",
      headers: { "User-Agent": "NajmMarketReader/1.0", Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,text/html,text/plain" },
    });
    if (!response.ok) throw new UpstreamError(response.status);
    if (Number(response.headers.get("content-length") ?? 0) > 3_000_000) throw new Error("حجم استجابة المصدر غير مدعوم.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("استجابة المصدر فارغة.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_000_000) { await reader.cancel(); throw new Error("حجم استجابة المصدر غير مدعوم."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    const transient = error instanceof UpstreamError ? error.status >= 500 : error instanceof Error && ["TimeoutError", "TypeError"].includes(error.name);
    if (!attempt && !signal.aborted && transient) return request(url, fetcher, signal, 1);
    throw error;
  }
}

export async function fetchSource(source: Source, fetcher: typeof fetch = fetch) {
  const signal = AbortSignal.timeout(24000);
  const endpoint = source.feedUrl ?? source.url;
  const robotsUrl = new URL("/robots.txt", endpoint).href;
  let rules: string;
  try { rules = await request(robotsUrl, fetcher, signal); }
  catch (error) {
    if (error instanceof UpstreamError && error.status === 404) rules = "";
    else throw error;
  }
  if (/<!doctype|<html/i.test(rules)) throw new Error("تعذّر التحقق من سياسة الوصول؛ أعاد المصدر صفحة HTML بدل robots.txt.");
  const policy = robotsParser(robotsUrl, rules);
  if (policy.isAllowed(endpoint, "NajmMarketReader") === false) throw new Error("سياسة المصدر لا تسمح بالجلب الآلي.");
  return parseSource(await request(endpoint, fetcher, signal), source);
}
