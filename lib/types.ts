export type Category = "najm" | "sector" | "reg" | "econ" | "global";
export const categories: Record<Category, string> = {
  najm: "نجم",
  sector: "التأمين",
  reg: "تنظيمي",
  econ: "اقتصاد واستثمار",
  global: "عالمي",
};
export type Article = {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  sourceId: string;
  source: string;
  url: string;
  publishedAt: string | null;
  retrievedAt: string;
  updatedAt: string;
  category: Category;
  entity: string;
  kind: "announcement" | "report" | "forecast" | "commentary";
  dateOnly: boolean;
  language?: "ar" | "en";
  related?: Omit<Article, "related">[];
};
export type Source = {
  id: string;
  name: string;
  url: string;
  type: "official" | "media" | "social";
  connector?: "ia" | "cma" | "rss" | "news-sitemap";
  feedUrl?: string;
  language?: "ar" | "en";
  newsPath?: string;
  category?: Category;
  note: string;
};
export type SourceHealth = Source & {
  status: "connected" | "unavailable" | "directory";
  lastSuccess: string | null;
  lastAttempt: string | null;
  error: string | null;
  count: number;
};
export type FinancialResult = {
  company: string;
  period: string;
  current: number | null;
  previous: number | null;
  currency: string;
  unit: string;
  definition: string;
  comparable: boolean;
  status: "verified" | "not_published" | "retrieval_failed";
  disclosureUrl: string | null;
  publishedAt: string | null;
};
export type DashboardData = {
  articles: Article[];
  sources: SourceHealth[];
  results: FinancialResult[];
  lastSuccess: string | null;
  lastAttempt: string | null;
  stale: boolean;
  refreshMinutes: number;
  storageError: boolean;
  refreshing: boolean;
  refreshDue: boolean;
};
export type Brief = {
  status: "ready" | "insufficient" | "unavailable" | "pending";
  message?: string;
  generatedAt: string | null;
  items: {
    articleId: string;
    fact: string;
    analysis: string;
    evidence: string;
    url: string;
    source: string;
  }[];
};
