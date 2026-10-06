import { load } from "cheerio";
import robotsParser from "robots-parser";
import type { Disclosure, FinancialResult, MarketIndicator } from "./types";

export const marketSources = {
  tasi: "https://www.mubasher.info/markets/TDWL/indices/TASI",
  insurance: "https://www.mubasher.info/markets/TDWL/indices/TISI",
  repo: "https://www.sama.gov.sa/ar-sa/_LAYOUTS/15/SAMA.Portal/PortalHandler.ashx?op=LoadItems&listUrl=/ar-sa/MonetaryPolicy/Lists/OfficialRepoRate&viewName=Home",
  saudire: "https://saudire.net/press-release/",
} as const;
const agent = "NajmMarketReader";
const text = (value: string) => value.replace(/\s+/g, " ").trim();
export function numeric(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}
async function request(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": `${agent}/1.0`, Accept: "text/html,application/json,text/plain" },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`المصدر أعاد HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > 3_000_000) throw new Error("استجابة أكبر من الحد المسموح");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("استجابة فارغة");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 3_000_000) { await reader.cancel(); throw new Error("استجابة أكبر من الحد المسموح"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function checkPublicPolicy(url: string) {
  const robotsUrl = new URL("/robots.txt", url).href;
  const rules = await request(robotsUrl);
  if (/<html|<!doctype/i.test(rules)) throw new Error("تعذّر التحقق من سياسة المصدر");
  const policy = robotsParser(robotsUrl, rules);
  if (policy.isAllowed(url, agent) === false) throw new Error("المصدر لا يسمح بالجلب الآلي");
  return policy;
}
export function parseIndex(html: string, id: "tasi" | "insurance", observedAt: string): MarketIndicator {
  const $ = load(html);
  const value = numeric($(".market-summary__last-price").first().text());
  const sourceDate = text($(".market-summary__date").first().text()).replace(/^آخر تحديث:\s*/, "");
  const delay = text($(".market-summary__note").first().text());
  if (value === null || value <= 0 || !sourceDate || !/١٥|15/.test(delay)) throw new Error("تعذّر التحقق من قيمة المؤشر أو تاريخ المصدر وتأخيره");
  return {
    id, label: id === "tasi" ? "مؤشر السوق الرئيسية (تاسي)" : "مؤشر قطاع التأمين",
    value, unit: "نقطة", source: "مباشر", url: marketSources[id],
    observedAt, sourceDate, delayed: true, note: "متأخر ١٥ دقيقة أثناء الجلسة؛ وقت الصفقة غير منشور", 
  };
}
export function parseRepo(body: string, observedAt: string): MarketIndicator {
  const rows: unknown = JSON.parse(body);
  if (!Array.isArray(rows)) throw new Error("استجابة معدل الريبو غير صالحة");
  const valid = rows.flatMap((row) => {
    const match = String(row.SAMAPublishDate ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const value = typeof row.SAMAOfficialRepoRate === "number" ? row.SAMAOfficialRepoRate : null;
    if (!match || value === null || !Number.isFinite(value) || value < 0 || value > 100) return [];
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    if (!Number.isFinite(Date.parse(date)) || Date.parse(date) > Date.parse(observedAt)) return [];
    return [{ value, date }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  if (!valid.length) throw new Error("لم يُنشر معدل ريبو قابل للتحقق");
  return { id: "repo", label: "معدل إعادة الشراء", value: valid[0].value, unit: "٪", source: "البنك المركزي السعودي", url: marketSources.repo, observedAt, sourceDate: valid[0].date, delayed: false, note: "آخر معدل منشور في بيانات ساما الرسمية" };
}
export async function fetchIndex(id: "tasi" | "insurance") {
  await checkPublicPolicy(marketSources[id]);
  return parseIndex(await request(marketSources[id]), id, new Date().toISOString());
}
export async function fetchRepo() {
  // This is the public JSON endpoint used by SAMA's homepage (home.js + utils.js), not a private SharePoint list.
  return parseRepo(await request(marketSources.repo), new Date().toISOString());
}
export function releaseLinks(html: string) {
  const $ = load(html);
  return [...new Set($("article a[href]").toArray().map((el) => $(el).attr("href")!).filter((url) => {
    try { const u = new URL(url); return u.origin === "https://saudire.net" && u.pathname !== "/press-release/"; } catch { return false; }
  }))].slice(0, 10);
}
export function parseRelease(html: string, url: string): { disclosure: Disclosure; results: FinancialResult[] } {
  const $ = load(html);
  const title = text($("h1").first().text());
  const body = text($(".elementor-widget-theme-post-content").text());
  const dateText = text($("time").first().text());
  const date = Date.parse(dateText);
  if (!title || !body || !Number.isFinite(date) || date > Date.now() + 86400000) throw new Error("تعذّر تحليل الإعلان الرسمي");
  const publishedAt = new Date(date).toISOString().slice(0, 10);
  const type = /financial|profit|revenue|results/i.test(title) ? "نتائج مالية" : /rating|Moody/i.test(title) ? "تصنيف ائتماني" : /assembly|shareholder/i.test(title) ? "جمعية المساهمين" : /partnership|agreement/i.test(title) ? "اتفاقية وشراكة" : "إعلان شركة";
  const disclosure: Disclosure = { id: url, company: "الإعادة السعودية", title, publishedAt, type, url, source: "الإعادة السعودية · الموقع الرسمي", language: "en" };
  const results: FinancialResult[] = [];
  if (type !== "نتائج مالية") return { disclosure, results };
  const amount = "([\\d,.]+)\\s+(million|billion|thousand)";
  const net = body.match(new RegExp(`net profit after Zakat of SAR ${amount}`, "i"));
  const million = (value?: string, unit?: string) => {
    const n = numeric(value);
    return n === null ? null : n * (unit?.toLowerCase() === "billion" ? 1000 : unit?.toLowerCase() === "thousand" ? 0.001 : 1);
  };
  const result = (period: string, current: number | null, previous: number | null) => ({ company: disclosure.company, period, current, previous, currency: "ريال سعودي", unit: "مليون", definition: "صافي الربح بعد الزكاة · أرقام البيان مقربة", comparable: current !== null && previous !== null, status: "verified" as const, disclosureUrl: url, publishedAt });
  if (net) {
    const netStart = body.indexOf(net[0]);
    const sentence = body.slice(netStart).split(/\.(?:\s|$)/)[0];
    const previous = sentence.match(new RegExp(`compared to SAR ${amount}(?: for| in)`, "i"));
    const quarterMatch = body.match(/(first|second|third|fourth) quarter of (20\d{2})/i);
    const year = quarterMatch?.[2] ?? body.match(/31\/12\/(20\d{2})/)?.[1];
    const quarter = quarterMatch ? ({ first: "Q1", second: "Q2", third: "Q3", fourth: "Q4" }[quarterMatch[1].toLowerCase()] ?? null) : /year ending on 31\/12/i.test(body) ? "FY" : null;
    if (year && quarter) results.push(result(`${year}-${quarter}`, million(net[1], net[2]), million(previous?.[1], previous?.[2])));
    const half = body.match(new RegExp(`Net profit for the first half reached SAR ${amount}`, "i"));
    if (half && year) {
      const halfSentence = body.slice(body.indexOf(half[0])).split(/\.(?:\s|$)/)[0];
      const halfPrevious = halfSentence.match(new RegExp(`compared to SAR ${amount}`, "i"));
      results.push(result(`${year}-H1`, million(half[1], half[2]), million(halfPrevious?.[1], halfPrevious?.[2])));
    }
  }
  return { disclosure, results };
}
export type CompanyData = { disclosures: Disclosure[]; results: FinancialResult[]; errors: string[] };
export async function fetchCompany(): Promise<CompanyData> {
  const policy = await checkPublicPolicy(marketSources.saudire);
  const links = releaseLinks(await request(marketSources.saudire));
  if (!links.length) throw new Error("لم يصل فهرس إعلانات صالح");
  const data: CompanyData = { disclosures: [], results: [], errors: [] };
  const parsed = await Promise.all(links.map(async (url) => {
    try {
      if (policy.isAllowed(url, agent) === false) throw new Error("سياسة المصدر تمنع الوصول");
      return parseRelease(await request(url), url);
    } catch { data.errors.push(`تعذّر تحديث إعلان: ${url}`); return null; }
  }));
  for (const item of parsed) if (item) {
    data.disclosures.push(item.disclosure);
    data.results.push(...item.results);
    if (item.disclosure.type === "نتائج مالية" && !item.results.length) data.errors.push(`تنسيق نتائج غير مدعوم: ${item.disclosure.url}`);
  }
  if (!data.disclosures.length || !data.results.length) throw new Error("تعذّر استخراج نتائج وإعلانات رسمية؛ احتُفظ بآخر نجاح");
  data.disclosures.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return data;
}
