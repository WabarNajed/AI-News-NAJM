import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSource, dedupe, parsePublicationDate } from "../lib/news-utils";
import { fetchSource } from "../lib/news-fetch";
import { forPublisher, matchesNews } from "../lib/news-filter";
import type { Source } from "../lib/types";
const source: Source = { id: "test", name: "ناشر الاختبار", type: "media", url: "https://example.com/", feedUrl: "https://example.com/rss", connector: "rss", note: "test" };
const rss = `<rss><channel><item><title>البنك يعلن تمويل الشركات السعودية</title><link>https://example.com/story</link><pubDate>Tue, 06 Oct 2026 08:00:00 GMT</pubDate><description>مقتطف تجريبي لا يُستخدم في التطبيق.</description></item></channel></rss>`;
const [article] = parseSource(rss, source);

test("RSS and namespaced news sitemap parse publication dates, not lastmod", () => {
  assert.equal(article.publishedAt, "2026-10-06T08:00:00.000Z");
  const [parsed] = parseSource(`<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://example.com/economy/story</loc><lastmod>2026-10-06</lastmod><news:news><news:title>تطورات الاقتصاد السعودي والبنوك</news:title><news:publication_date>2026-10-01</news:publication_date></news:news></url></urlset>`, { ...source, connector: "news-sitemap" });
  assert.equal(parsed.publishedAt, "2026-10-01");
  assert.equal(parsed.dateOnly, true);
  assert.equal(parsed.summary, null);
  assert.equal(parsePublicationDate("2026-02-31"), null);
});
test("unknown dates remain available inside time filters", () => {
  assert.equal(matchesNews({ ...article, publishedAt: null }, "", "all", "7"), true);
  assert.equal(matchesNews({ ...article, publishedAt: "2020-01-01" }, "", "all", "7"), false);
});
test("syndication retains each publisher original link and metadata for filters", () => {
  const secondary = { ...article, id: "second", sourceId: "second", source: "الثاني", url: "https://example.org/story", summary: null };
  const [group] = dedupe([article, secondary]);
  assert.equal(group.related?.length, 1);
  assert.equal(forPublisher(group, "second")?.url, secondary.url);
  assert.equal(forPublisher(group, "second")?.summary, null);
  assert.equal(forPublisher(group, "missing"), null);
  assert.equal(dedupe([group, secondary])[0].related?.length, 1);
});
test("invalid upstream responses fail instead of replacing last good cache", () => {
  assert.throws(() => parseSource("<html>Access denied</html>", source));
  assert.throws(() => parseSource("<rss><channel/></rss>", source));
  assert.equal(parseSource(rss.replace(article.title, "مباراة رياضية بين فريقين"), source).length, 0);
});
test("one denied publisher does not stop another; ingestion never needs AI", async () => {
  const mockFetch = (async (url: string | URL | Request) => {
    if (String(url).includes("blocked.example")) return new Response("denied", { status: 403 });
    return new Response(String(url).endsWith("robots.txt") ? "User-agent: *\nAllow: /" : rss);
  }) as typeof fetch;
  const results = await Promise.allSettled([fetchSource({ ...source, feedUrl: "https://blocked.example/rss" }, mockFetch), fetchSource(source, mockFetch)]);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "fulfilled");
  if (results[1].status === "fulfilled") assert.equal(results[1].value[0].title, article.title);
});
test("robots denial prevents feed request; transient failures retry once", async () => {
  let calls = 0;
  await assert.rejects(fetchSource(source, (async () => { calls++; return new Response("User-agent: *\nDisallow: /"); }) as typeof fetch));
  assert.equal(calls, 1);
  let feeds = 0;
  const result = await fetchSource(source, (async (url: string | URL | Request) => {
    if (String(url).endsWith("robots.txt")) return new Response("missing", { status: 404 });
    feeds++;
    return feeds === 1 ? new Response("error", { status: 503 }) : new Response(rss);
  }) as typeof fetch);
  assert.equal(feeds, 2);
  assert.equal(result.length, 1);
});
