import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrief } from "../lib/brief";
import { numeric, parseIndex, parseRelease, parseRepo, releaseLinks } from "../lib/market-sources";
import { mergeCompany } from "../lib/market-service";
import { availablePeriods, financialStats, selectResults } from "../lib/financial";
import type { Article } from "../lib/types";
const now = "2026-10-06T10:00:00.000Z";
const html = (body: string, title = "Saudi Re Reports Financial Results", date = "August 3, 2026") => `<h1>${title}</h1><time>${date}</time><div class="elementor-widget-theme-post-content">${body}</div>`;
const secondQuarter = html("Saudi Re announced its financial results for the second quarter of 2026, reporting a net profit after Zakat of SAR 115 million, compared to SAR 53 million for the same quarter last year. Net profit for the first half reached SAR 162 million, marking an increase of 84% compared to the corresponding period last year.");
const url = "https://saudire.net/official-result/";
test("public quote parser requires actual prices, source date and delay disclosure", () => {
  const page = '<div class="market-summary__last-price">10,558.95</div><div class="market-summary__date">آخر تحديث: الثلاثاء, أكتوبر 06</div><div class="market-summary__note">البيانات متأخرة ١٥ دقيقة</div>';
  const quote = parseIndex(page, "tasi", now);
  assert.equal(quote.value, 10558.95);
  assert.equal(quote.observedAt, now);
  assert.equal(quote.sourceDate, "الثلاثاء, أكتوبر 06");
  assert.equal(quote.delayed, true);
  assert.throws(() => parseIndex("Access denied", "tasi", now));
  assert.throws(() => parseIndex(page.replace("10,558.95", "—"), "tasi", now));
  assert.equal(numeric(""), null);
  assert.equal(numeric("—"), null);
  assert.equal(numeric("0"), 0);
});
test("official SAMA JSON distinguishes publication from observation date", () => {
  const quote = parseRepo(JSON.stringify([{ SAMAOfficialRepoRate: 4.5, SAMAPublishDate: "16/09/2026" }]), now);
  assert.equal(quote.value, 4.5);
  assert.equal(quote.sourceDate, "2026-09-16");
  assert.equal(quote.observedAt, now);
  assert.throws(() => parseRepo(JSON.stringify([{ SAMAOfficialRepoRate: null, SAMAPublishDate: "16/09/2026" }]), now));
});
test("Q2 and H1 remain separate; rounded percentages never create missing comparatives", () => {
  const data = parseRelease(secondQuarter, url);
  assert.equal(data.results.length, 2);
  assert.deepEqual(data.results.map((r) => [r.period, r.current, r.previous]), [["2026-Q2", 115, 53], ["2026-H1", 162, null]]);
  assert.equal(data.results[1].comparable, false);
  assert.equal(selectResults(data.results, "2026-Q2", "profit-desc").length, 1);
  assert.equal(financialStats(selectResults(data.results, "2026-H1", "profit-desc")).profit, 1);
  assert.equal(availablePeriods(data.results).length, 2);
  assert.equal(data.disclosure.url, url);
});
test("units normalize to millions and annual data does not mix with quarter", () => {
  const data = parseRelease(html("Results for the year ending on 31/12/2025. Net profit after Zakat of SAR 0.14 billion, representing a decrease compared to SAR 475000 thousand for the same period last year."), url);
  assert.equal(data.results[0].period, "2025-FY");
  assert.equal(data.results[0].current, 140);
  assert.equal(data.results[0].previous, 475);
});
test("comparisons never borrow revenue or premiums from a later sentence", () => {
  const data = parseRelease(html("Results for the third quarter of 2026. Net profit after Zakat of SAR 40 million. Revenue rose to SAR 500 million, compared to SAR 300 million for last year."), url);
  assert.equal(data.results[0].period, "2026-Q3");
  assert.equal(data.results[0].current, 40);
  assert.equal(data.results[0].previous, null);
});
test("non-financial announcements remain chronological disclosures, not financial rows", () => {
  const partnership = parseRelease(html("The company announces a new partnership.", "Saudi Re Announces New Strategic Partnership", "July 14, 2026"), url + "partnership");
  const financial = parseRelease(secondQuarter, url);
  const first = { ...financial, disclosures: [financial.disclosure], errors: [] };
  const next = { ...partnership, disclosures: [partnership.disclosure], errors: ["One upstream failed"] };
  const merged = mergeCompany(first, next);
  assert.equal(partnership.results.length, 0);
  assert.equal(partnership.disclosure.type, "اتفاقية وشراكة");
  assert.equal(merged.results.length, 2);
  assert.equal(merged.results[0].publishedAt, first.results[0].publishedAt);
  assert.deepEqual(merged.disclosures.map((d) => d.publishedAt), ["2026-08-03", "2026-07-14"]);
  assert.throws(() => parseRelease("Access denied", url));
  assert.deepEqual(releaseLinks('<article><a href="https://evil.test/">Injected</a><a href="https://saudire.net/release/">Release</a></article>'), ["https://saudire.net/release/"]);
});
const article = (id: string, title: string, date = "2026-10-05"): Article => ({ id, title, url: `https://publisher.test/${id}`, source: "مصدر رسمي", sourceId: "official", summary: null, content: null, publishedAt: date, retrievedAt: now, updatedAt: now, category: "sector", entity: "التأمين", kind: "announcement", language: "ar", dateOnly: true });
test("briefing uses 3–5 verbatim Arabic headlines, deduplicates and excludes old or future articles", () => {
  const a = article("one", "هيئة التأمين تصدر قراراً بشأن تراخيص شركات الوساطة");
  const articles = [a, { ...a, id: "duplicate", url: "https://another.test/news" }, article("two", "ارتفاع أقساط التأمين الصحي خلال الربع الثالث"), article("three", "البنك المركزي يعلن تعديل أسعار الفائدة"), article("four", "شركة تعلن إبرام عقد تأمين جديد"), article("five", "نتائج استثمارات قطاع التأمين خلال النصف الأول"), article("six", "دراسة جديدة تتناول نشاط الخزينة"), article("old", "خبر قديم لا يدخل الموجز", "2025-01-01"), article("future", "خبر مستقبلي لا يدخل الموجز", "2027-01-01")];
  const brief = buildBrief(articles, Date.parse(now));
  assert.equal(brief.items.length, 5);
  assert.equal(new Set(brief.items.map((i) => i.fact)).size, 5);
  assert.ok(brief.items.every((i) => articles.some((a) => a.title === i.fact && a.url === i.url)));
  assert.ok(brief.items.every((i) => i.fact === i.evidence && !("analysis" in i)));
  assert.ok(!brief.items.some((i) => ["old", "future"].includes(i.articleId)));
  assert.deepEqual(buildBrief(articles, Date.parse(now)), brief);
});
