import { load } from "cheerio";
import { checkPublicPolicy, request, type CompanyData } from "./market-sources";
import { insurers, insurerDirectory, insurerSource, type Insurer } from "./insurers";
import { westernDigits } from "./format";
import type { Disclosure, FinancialResult } from "./types";

const clean = (s: string) => westernDigits(s).replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
export function reportNumber(value: string): number | null {
  let s = clean(value).replace(/[,٬]/g, "").replace(/٫/g, ".").replace(/−/g, "-");
  if (/^\([\d.]+\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function reportPeriod(label: string): string | null {
  const s = clean(label).replace(/[أإآ]/g, "ا");
  const year = s.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;
  const quarters = ["الاول", "الثاني", "الثالث", "الرابع"];
  const q = quarters.findIndex((word) => s.includes(`الربع ${word}`));
  if (q >= 0) return `${year}-Q${q + 1}`;
  if (/6 (اشهر|شهور)|النصف الاول/.test(s)) return `${year}-H1`;
  if (/9 (اشهر|شهور)|التسعة/.test(s)) return `${year}-9M`;
  if (/12 (شهر|اشهر)|السنة|عام|سنة/.test(s) || s === year) return `${year}-FY`;
  return null;
}
function publicationDate(value: string): string | null {
  const match = clean(value).match(/\b(20\d{2})[/-](\d{2})[/-](\d{2})\b/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const time = Date.parse(iso);
  return Number.isFinite(time) && time <= Date.now() && new Date(time).toISOString().startsWith(iso) ? iso : null;
}
export function parseInsurerReport(html: string, url: string, company: Insurer): CompanyData {
  const u = new URL(url);
  if (u.origin !== "https://www.argaam.com" || !u.pathname.startsWith(`/ar/financial-reports/company-report/${company.argaamId}/`)) throw new Error("رابط التقرير لا يطابق الشركة");
  const $ = load(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ""));
  const title = clean($("h1").first().text());
  const publishedAt = publicationDate($(".date-posted").first().text());
  if (!title || !publishedAt) throw new Error("تاريخ التقرير أو عنوانه غير قابل للتحقق");
  const results: FinancialResult[] = [];
  $("section").each((_, section) => {
    const heading = clean($(section).children(".h2hold").text());
    const factor = /مليون ريال/.test(heading) ? 1 : /(?:ألف|الف|آلاف) ريال/.test(heading) ? 0.001 : /مليار ريال/.test(heading) ? 1000 : null;
    if (factor === null) return;
    $(section).find("table").each((_, table) => {
      const headers = $(table).find("thead th").toArray().map((el) => clean($(el).text()));
      const previousPeriod = reportPeriod(headers[1] ?? "");
      const period = reportPeriod(headers[2] ?? "");
      if (!period || !previousPeriod || previousPeriod !== `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`) return;
      $(table).find("tbody tr").each((_, row) => {
        const cells = $(row).children("th,td");
        if (clean(cells.eq(0).text()) !== "صافي الدخل") return;
        const current = reportNumber(cells.eq(2).text());
        const previous = reportNumber(cells.eq(1).text());
        results.push({ company: company.name, period, current: current === null ? null : Number((current * factor).toFixed(6)), previous: previous === null ? null : Number((previous * factor).toFixed(6)), currency: "ريال سعودي", unit: "مليون", definition: "صافي الدخل · كما نشره أرقام، مقرب إلى منزلتين", comparable: current !== null && previous !== null, status: "verified", disclosureUrl: url, publishedAt });
      });
    });
  });
  const disclosure: Disclosure = { id: url, company: company.name, title, publishedAt, type: "نتائج مالية", url, source: "أرقام · تقرير مالي منشور", language: "ar" };
  return { results, disclosures: [disclosure], errors: results.length ? [] : ["التقرير منشور لكن جدول صافي الدخل أو وحدته غير متاح؛ لم نستنتج أرقامًا من العنوان."] };
}
export function parseInsurerOverview(html: string, company: Insurer) {
  const $ = load(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ""));
  const links = [...new Set($("a[href]").toArray().map((a) => $(a).attr("href")!).filter((href) => new RegExp(`^/ar/financial-reports/company-report/${company.argaamId}/20\\d{2}/\\d+$`).test(href)))].slice(0, 2).map((path) => `https://www.argaam.com${path}`);
  const disclosures = new Map<string, Disclosure>();
  // Only exchange-attributed headlines in this company's own public overview, not related market news.
  $("h3").each((_, el) => {
    if (clean($(el).find(".source").text()) !== "تداول") return;
    const a = $(el).find('a[href^="/ar/article/articledetail/id/"]').first();
    const path = a.attr("href");
    const title = clean(a.text());
    const publishedAt = publicationDate($(el).find(".date").text());
    if (!path || !/^\/ar\/article\/articledetail\/id\/\d+$/.test(path) || !title || !publishedAt) return;
    const url = `https://www.argaam.com${path}`;
    const type = /جمعية/.test(title) ? "جمعية المساهمين" : /عقد|اتفاقية/.test(title) ? "اتفاقية وشراكة" : /توزيع|أرباح نقدية/.test(title) ? "توزيعات أرباح" : "إعلان شركة";
    disclosures.set(url, { id: url, company: company.name, title, publishedAt, type, url, source: "تداول عبر أرقام · عنوان الإعلان العام", language: "ar" });
  });
  return { links, disclosures: [...disclosures.values()] };
}
export async function fetchInsurer(company: Insurer, policy: Awaited<ReturnType<typeof checkPublicPolicy>>): Promise<CompanyData> {
  const get = async (url: string) => {
    if (policy.isAllowed(url, "NajmMarketReader") === false) throw new Error("سياسة المصدر تمنع الجلب الآلي");
    // Argaam embeds full chart histories: verified public reports decompress to about 10 MB.
    return request(url, 16_000_000, 15000);
  };
  const overview = parseInsurerOverview(await get(insurerSource(company)), company);
  const data: CompanyData = { results: [], disclosures: overview.disclosures, errors: [] };
  if (!overview.links.length) data.errors.push("لا توجد روابط تقارير مالية عامة قابلة للتحقق.");
  for (const url of overview.links) {
    try {
      const report = parseInsurerReport(await get(url), url, company);
      data.results.push(...report.results);
      data.disclosures.push(...report.disclosures);
      data.errors.push(...report.errors);
    } catch (error) { data.errors.push(`${url}: ${error instanceof Error ? error.message : "تعذّر الجلب"}`); }
  }
  if (!data.disclosures.length) throw new Error("تعذّر جلب سجلات الشركة؛ احتُفظ بآخر نجاح");
  return data;
}
export async function verifyListedDirectory() {
  const policy = await checkPublicPolicy(insurerDirectory.listedDirectory);
  if (policy.isAllowed(insurerDirectory.listedDirectory, "NajmMarketReader") === false) throw new Error("سياسة الدليل تمنع الجلب");
  const $ = load(await request(insurerDirectory.listedDirectory));
  const symbols = [...new Set($("a[href*='/company/companyoverview/marketid/3/']").toArray().flatMap((a) => clean($(a).text()).match(/^(8\d{3})\s*-/)?.[1] ?? []))].filter((id) => id !== "8313");
  if (!symbols.length) throw new Error("تعذّر قراءة دليل الشركات المدرجة");
  const expected = new Set<string>(insurers.map((c) => c.symbol));
  const differences = [...symbols.filter((id) => !expected.has(id)).map((id) => `رمز جديد يحتاج مطابقة بسجل الهيئة: ${id}`), ...insurers.filter((c) => !symbols.includes(c.symbol)).map((c) => `لم يعد ظاهرًا في الدليل: ${c.symbol} ${c.name}`)];
  return { checkedAt: new Date().toISOString(), differences };
}
