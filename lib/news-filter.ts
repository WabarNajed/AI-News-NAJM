import type { Article } from "./types";

export function forPublisher(article: Article, source: string): Article | null {
  if (source === "all" || article.sourceId === source) return article;
  const attributed = article.related?.find((item) => item.sourceId === source);
  if (!attributed) return null;
  const { related: _related, ...original } = article;
  return { ...attributed, related: [original] };
}

export function matchesNews(article: Article, query: string, category: string, days: string, now = Date.now()) {
  const published = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
  return (!query.trim() || `${article.title} ${article.summary ?? ""} ${article.entity}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) &&
    (category === "all" || article.category === category) &&
    (days === "all" || !Number.isFinite(published) || published >= now - Number(days) * 86400000);
}
