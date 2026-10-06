import { test } from "node:test";
import assert from "node:assert/strict";
import { change, selectResults, financialStats } from "../lib/financial";
import {
  dedupe,
  mergeArticles,
  parsePublicationDate,
  parseSource,
  safeUrl,
} from "../lib/news-utils";
import { scrollStep } from "../lib/scroll";
import { sources } from "../lib/sources";
import type { Article, FinancialResult } from "../lib/types";
const base: FinancialResult = {
  company: "اختبار",
  period: "2026-Q1",
  current: 4,
  previous: -2,
  currency: "SAR",
  unit: "million",
  definition: "net profit",
  comparable: true,
  status: "verified",
  disclosureUrl: null,
  publishedAt: null,
};
const article: Article = {
  id: "a",
  title: "عنوان اختبار لإعلان رسمي",
  source: "مصدر",
  sourceId: "ia",
  url: "https://www.ia.gov.sa/ar/media-center/news/134",
  summary: null,
  content: null,
  publishedAt: "2026-10-01",
  retrievedAt: "2026-10-06T00:00:00Z",
  updatedAt: "2026-10-05T00:00:00Z",
  category: "reg",
  entity: "مصدر",
  kind: "announcement",
  dateOnly: true,
};
test("missing and zero values are not invented", () => {
  assert.equal(change(null, 10).percent, null);
  assert.equal(change(10, 0).percent, null);
  assert.equal(change(0, 10).percent, -100);
  assert.equal(change(20, 10, false).percent, null);
});
test("negative denominators and profit/loss transitions", () => {
  assert.deepEqual(change(4, -2), { percent: 300, label: "تحوّل إلى الربح" });
  assert.equal(change(-2, 4).label, "تحوّل إلى الخسارة");
  assert.equal(change(-1, -2).percent, 50);
  assert.equal(change(-4, -2).label, "اتساع الخسارة");
});
test("sorts selected period, isolates Q2 from H1 and puts missing last", () => {
  const rows = [
    base,
    { ...base, company: "ب", period: "2026-Q2", current: 12 },
    { ...base, company: "ج", period: "2026-Q2", current: null },
    { ...base, company: "د", period: "2026-H1", current: 100 },
  ];
  assert.equal(selectResults(rows, "2026-Q2", "profit-desc")[0].current, 12);
  assert.equal(
    selectResults(rows, "2026-Q2", "change-asc").at(-1)?.current,
    null,
  );
  assert.equal(
    financialStats(selectResults(rows, "2026-Q2", "profit-desc")).total,
    2,
  );
});
test("publisher dates never become retrieval dates", () => {
  assert.equal(parsePublicationDate("01 أكتوبر 2026"), "2026-10-01");
  assert.equal(parsePublicationDate("١٣-سبتمبر-٢٠٢٦"), "2026-09-13");
  assert.equal(parsePublicationDate("غير معروف"), null);
  assert.equal(parsePublicationDate("31 فبراير 2026"), null);
});
test("canonical URLs and exact syndicated titles deduplicate", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(
    safeUrl("https://example.com/a?utm_source=x#test"),
    "https://example.com/a",
  );
  assert.equal(
    dedupe([article, { ...article, url: article.url + "?utm_source=x" }])
      .length,
    1,
  );
  const grouped = dedupe([
    article,
    { ...article, id: "b", source: "ثان", url: "https://cma.org.sa/other" },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].related?.length, 1);
});
test("unchanged content keeps original update and publication time", () => {
  const result = mergeArticles(
    [article],
    [{ ...article, updatedAt: "2026-10-06T00:00:00Z" }],
  );
  assert.equal(result[0].updatedAt, article.updatedAt);
  assert.equal(result[0].publishedAt, article.publishedAt);
});
test("official parser extracts bounded safe metadata and handles layout failure", () => {
  const html =
    '<div class="nds-card"><h3>عنوان اختبار لإعلان رسمي</h3><p>مقتطف من المصدر الرسمي للتحقق من طريقة معالجة النص وبيانات الخبر.</p><span class="news-date">01 أكتوبر 2026</span><a href="/ar/media-center/news/134">المزيد</a></div>';
  const [a] = parseSource(html, sources[0]);
  assert.equal(a.publishedAt, "2026-10-01");
  assert.equal(a.url, article.url);
  assert.throws(() => parseSource("<html>unavailable</html>", sources[0]));
});
test("empty refresh retains last-known-good news without changing dates", () => {
  assert.deepEqual(mergeArticles([article], []), [article]);
});
test("scroll reverses at both ends without jumping", () => {
  assert.deepEqual(scrollStep(99, 100, 1, 3), {
    position: 100,
    direction: -1,
    boundary: true,
  });
  assert.deepEqual(scrollStep(1, 100, -1, 3), {
    position: 0,
    direction: 1,
    boundary: true,
  });
  assert.equal(scrollStep(50, 100, 1, 1).position, 51);
  assert.equal(scrollStep(0, 0, 1, 1).boundary, false);
});
