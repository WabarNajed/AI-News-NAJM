import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { Article, Source } from "./types";
export function plain(text: string) {
  let value = text;
  for (let i = 0; i < 2; i++) {
    const $ = load(value);
    $("script,style,iframe").remove();
    value = $.text();
  }
  return value
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function safeUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch {
    return null;
  }
}
export function parsePublicationDate(value: string): string | null {
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const text = plain(value)
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[-/]/g, " ");
  const match = text.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!match) return null;
  const month = months.indexOf(match[2]) + 1 || Number(match[2]);
  const day = Number(match[1]),
    year = Number(match[3]);
  if (month < 1 || month > 12 || year < 2000 || day < 1 || day > 31)
    return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T12:00:00+03:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCDate() !== day ||
    date.getTime() > Date.now() + 86400000
  )
    return null;
  return iso;
}
export function parseSource(
  html: string,
  source: Source,
  now = new Date().toISOString(),
): Article[] {
  const $ = load(html);
  const cards =
    source.connector === "ia"
      ? $(".nds-card").toArray()
      : $(".iconed-card").toArray();
  if (!cards.length)
    throw new Error("تغير تنسيق صفحة المصدر؛ تعذّر تحليل الأخبار.");
  const articles: Article[] = [];
  for (const el of cards) {
    const card = $(el);
    const href = card
      .find(
        source.connector === "ia"
          ? 'a[href*="/media-center/news/"]'
          : 'a[href*="/NEWS/Pages/CMA_N_"]',
      )
      .attr("href");
    const url = href && safeUrl(href, source.url);
    const title = plain(card.find("h3").first().text()).slice(0, 800);
    if (
      !url ||
      new URL(url).hostname !== new URL(source.url).hostname ||
      title.length < 15
    )
      continue;
    const excerpt = plain(card.find("p").first().text());
    const summary =
      excerpt.length > 30 && excerpt !== title ? excerpt.slice(0, 1200) : null;
    const category = /نجم/.test(title)
      ? "najm"
      : /تأمين|التأميني/.test(title)
        ? "sector"
        : "reg";
    articles.push({
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      title,
      summary,
      content: summary,
      url,
      sourceId: source.id,
      source: source.name,
      publishedAt: parsePublicationDate(
        card.find(".news-date,.date").first().text(),
      ),
      retrievedAt: now,
      updatedAt: now,
      category,
      entity: source.name,
      kind: "announcement",
      dateOnly: true,
    });
  }
  if (!articles.length)
    throw new Error("تعذّر استخراج روابط أخبار صالحة من الصفحة.");
  return dedupe(articles).slice(0, 24);
}
export function dedupe(articles: Article[]): Article[] {
  const urls = new Set<string>(),
    titles = new Map<string, Article>();
  const result: Article[] = [];
  for (const article of articles) {
    const url = safeUrl(article.url);
    if (!url || urls.has(url)) continue;
    urls.add(url);
    const key = article.title
      .normalize("NFKC")
      .replace(/[\u064b-\u065f\u0640]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "")
      .toLowerCase();
    const existing = titles.get(key);
    if (existing) {
      existing.related = [
        ...(existing.related ?? []),
        { source: article.source, url },
      ];
      continue;
    }
    const item = { ...article, url };
    titles.set(key, item);
    result.push(item);
  }
  return result;
}
export function mergeArticles(old: Article[], current: Article[]) {
  const previous = new Map(old.map((a) => [a.id, a]));
  return dedupe([
    ...current.map((a) => {
      const prev = previous.get(a.id);
      return prev && prev.title === a.title && prev.summary === a.summary && prev.content === a.content && prev.publishedAt === a.publishedAt
        ? { ...a, updatedAt: prev.updatedAt }
        : a;
    }),
    ...old,
  ])
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 100);
}
