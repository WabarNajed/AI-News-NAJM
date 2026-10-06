import { test } from "node:test";
import assert from "node:assert/strict";
import { insurers } from "../lib/insurers";
import { parseInsurerOverview, parseInsurerReport, reportNumber, reportPeriod } from "../lib/insurer-sources";
import { isNajmRelevant, buildBrief } from "../lib/brief";
import { indicatorDate, indicatorNumber, westernDigits } from "../lib/format";
import { mergeCompany } from "../lib/market-service";
import type { Article } from "../lib/types";

const company = insurers[0];
const url = "https://www.argaam.com/ar/financial-reports/company-report/33/2026/71";
const table = (previous: string, current: string, value = "609.85", before = "729.11", unit = "مليون") => `<section><div class="h2hold"><h2>ملخص النتائج المالية (${unit} ريال)</h2></div><table><thead><tr><th>البند</th><th>${previous}</th><th>${current}</th><th>التغير</th></tr></thead><tbody><tr><th>صافى الربح قبل الضرائب و الزكاه</th><td>794.35</td><td>678.34</td></tr><tr><th>صافي الدخل</th><td>${before}</td><td>${value}</td><td previousvalue="123" currentvalue="456">20%</td></tr></tbody></table></section>`;
const page = (body: string) => `<h1>أرباح التعاونية للتأمين</h1><span class="date-posted">2026/07/30</span>${body}`;
test("verified universe has 25 unique listed insurers, excludes technology and delisted insurers", () => {
  assert.equal(insurers.length, 25);
  assert.equal(new Set(insurers.map(c => c.symbol)).size, 25);
  assert.ok(!insurers.some(c => ["8313", "8110", "8140"].includes(c.symbol)));
});
test("public report separates Q2 and H1, uses stated units and YoY only", () => {
  const parsed = parseInsurerReport(page(table("6 أشهر 2025", "6 أشهر 2026") + table("الربع الثاني 2025", "الربع الثاني 2026", "321.77", "467.42") + table("الربع الأول 2026", "الربع الثاني 2026")), url, company);
  assert.deepEqual(parsed.results.map(r => [r.period, r.current, r.previous]), [["2026-H1", 609.85, 729.11], ["2026-Q2", 321.77, 467.42]]);
  assert.equal(parsed.results[0].disclosureUrl, url);
  assert.equal(parsed.disclosures[0].publishedAt, "2026-07-30");
  assert.equal(parsed.results[0].definition, "صافي الدخل · كما نشره أرقام، مقرب إلى منزلتين");
});
test("losses, missing values, unit normalization and unknown units are explicit", () => {
  const parsed = parseInsurerReport(page(table("6 أشهر 2025", "6 أشهر 2026", "(1,250)", "—", "ألف")), url, company);
  assert.equal(parsed.results[0].current, -1.25);
  assert.equal(parsed.results[0].previous, null);
  assert.equal(parsed.results[0].comparable, false);
  assert.equal(reportNumber("٠"), 0);
  assert.equal(reportNumber("۱۲٫۵"), 12.5);
  assert.equal(reportNumber("غير متاح"), null);
  assert.equal(parseInsurerReport(page(table("6 أشهر 2025", "6 أشهر 2026", "3", "2", "عملة مجهولة")), url, company).results.length, 0);
  assert.throws(() => parseInsurerReport(page(""), url.replace("/33/", "/970/"), company));
});
test("periods normalize without conflating year, quarters and cumulative periods", () => {
  for (const [input, expected] of [["2025", "2025-FY"], ["الربع الرابع 2025", "2025-Q4"], ["9 أشهر 2026", "2026-9M"], ["6 أشهر 2026", "2026-H1"], ["الربع الثالث 2026", "2026-Q3"]]) assert.equal(reportPeriod(input), expected);
  assert.equal(reportPeriod("2026 غير محدد"), null);
});
test("overview links cannot cross companies or include unrelated media stories", () => {
  const p = parseInsurerOverview(`<a href="/ar/financial-reports/company-report/33/2026/71">نتائج</a><a href="/ar/financial-reports/company-report/970/2026/71">شركة أخرى</a><h3><a href="/ar/article/articledetail/id/1940103">إعلان التعاونية</a><span class="date"><span class="source">تداول</span>2026/09/30</span></h3><h3><a href="/ar/article/articledetail/id/123">خبر عام</a><span class="date"><span class="source">صحيفة</span>2026/09/30</span></h3>`, company);
  assert.deepEqual(p.links, [url]);
  assert.equal(p.disclosures.length, 1);
  assert.equal(p.disclosures[0].company, company.name);
});
test("partial failures retain successful per-company records", () => {
  const good = parseInsurerReport(page(table("6 أشهر 2025", "6 أشهر 2026")), url, company);
  const missing = parseInsurerReport(page(table("6 أشهر 2025", "6 أشهر 2026", "—", "—")), url, company);
  assert.equal(mergeCompany(good, missing).results[0].current, 609.85);
  assert.equal(mergeCompany(good, { results: [], disclosures: [], errors: ["403"] }).results.length, 1);
});
test("briefing accepts only Najm-business material, independent of source category", () => {
  for (const title of ["نجم تطلق خدمة معاينة الحوادث", "تعديل قواعد التأمين على المركبات", "هيئة التأمين تقر ضوابط تسوية المطالبات", "خطة وطنية لتعزيز السلامة المرورية", "ميدغلف تعلن نتائجها المالية", "ارتفاع أرباح التعاونية", "الإعادة السعودية توقع اتفاقية إعادة تأمين", "هيئة التأمين توافق على اندماج شركتين"]) assert.ok(isNajmRelevant(title), title);
  for (const title of ["هيئة التأمين تشارك الأكاديمية المالية في إطلاق برامج لتطوير حديثي التخرج في القطاع المالي والتأميني", "الموافقة على طرح وحدات صندوق استثماري", "ترخيص مستشار استثمار جديد", "هيئة السوق المالية توافق على صندوق تأمين استثماري", "البنك المركزي يعدل أسعار الفائدة", "أسعار النفط تسجل ارتفاعاً", "نتائج شركة الوطنية للاستثمار", "نجم كرة القدم ينتقل إلى ناد جديد", "تعلن هيئة السوق المالية الموافقة على ممارسة أعمال المشورة"]) assert.equal(isNajmRelevant(title), false, title);
});
test("no relevant stories yields honest Arabic empty state and does not mutate main news", () => {
  const a: Article = { id: "fund", title: "الموافقة على طرح صندوق استثماري", summary: null, content: null, sourceId: "ia", source: "هيئة التأمين", url: "https://example.com/news", publishedAt: "2026-10-05", retrievedAt: "2026-10-06", updatedAt: "2026-10-06", category: "sector", entity: "قطاع التأمين", kind: "announcement", dateOnly: true };
  const articles = [a];
  const brief = buildBrief(articles, Date.parse("2026-10-06"));
  assert.equal(brief.status, "insufficient");
  assert.equal(brief.items.length, 0);
  assert.match(brief.message!, /نجم/);
  assert.equal(articles[0], a);
});
test("alternate titles of the same regulator announcement deduplicate", () => {
  const base: Article = { id: "official", title: "هيئة التأمين تُعلن صدور قرارات نهائية بإلغاء تراخيص عددٍ من الشركات", summary: null, content: null, sourceId: "ia", source: "هيئة التأمين", url: "https://example.com/official", publishedAt: "2026-10-01", retrievedAt: "2026-10-06", updatedAt: "2026-10-06", category: "reg", entity: "التأمين", kind: "announcement", dateOnly: true };
  const brief = buildBrief([base, { ...base, id: "publisher", sourceId: "publisher", title: "هيئة التأمين السعودية تصدر قرارات نهائية بإلغاء تراخيص 26 شركة", url: "https://example.com/publisher" }], Date.parse("2026-10-06"));
  assert.equal(brief.items.length, 1);
});
test("indicator values dates and source text have Western digits and stable precision", () => {
  assert.equal(indicatorNumber(10558.95), "10,558.95");
  assert.equal(indicatorNumber(4.5), "4.50");
  assert.equal(westernDigits("١٥ دقيقة ۱۲"), "15 دقيقة 12");
  assert.doesNotMatch(indicatorDate("2026-10-06T10:00:00Z"), /[٠-٩۰-۹]/);
  assert.match(indicatorDate("2026-10-06T10:00:00Z"), /2026/);
});
