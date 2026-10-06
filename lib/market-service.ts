import { claim, failCache, readCache, writeCache } from "./db";
import { fetchCompany, fetchIndex, fetchRepo, type CompanyData } from "./market-sources";
import type { MarketData, MarketIndicator } from "./types";
const minute = 60000;
const jobs = [
  { id: "tasi", interval: 15 * minute, run: () => fetchIndex("tasi") },
  { id: "insurance", interval: 15 * minute, run: () => fetchIndex("insurance") },
  { id: "repo", interval: 6 * 60 * minute, run: fetchRepo },
  { id: "saudire", interval: 6 * 60 * minute, run: fetchCompany },
] as const;
const key = (id: string) => `public-market:v1:${id}`;
export const coverage = [
  "تغطية النتائج والإعلانات الحالية: الإعادة السعودية فقط؛ ليست إحصاءً شاملًا لقطاع التأمين.",
  "تداول السعودية رفض الجلب الآلي (HTTP 403). بيانات المؤشرات من مباشر المتاحة للعامة، والنتائج والإعلانات من الموقع الرسمي للشركة.",
  "الأرقام بملايين الريالات، مقربة كما نُشرت في البيان. لا يُستنتج رقم مقارن من نسبة نمو مقربة؛ لذلك قد يبقى المقارن غير متاح.",
];
export function mergeCompany(old: CompanyData | undefined, next: CompanyData): CompanyData {
  const results = new Map((old?.results ?? []).map((r) => [`${r.company}:${r.period}`, r]));
  for (const row of next.results) {
    const id = `${row.company}:${row.period}`;
    const previous = results.get(id);
    if (!previous || (row.publishedAt ?? "") >= (previous.publishedAt ?? "")) results.set(id, row);
  }
  const disclosures = new Map((old?.disclosures ?? []).map((r) => [r.id, r]));
  for (const row of next.disclosures) disclosures.set(row.id, row);
  return { results: [...results.values()], disclosures: [...disclosures.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 150), errors: next.errors };
}
export async function refreshMarket(force = false) {
  const run = async (job: typeof jobs[number]) => {
    if (!(await claim(key(job.id), force ? minute : job.interval))) return;
    try {
      if (job.id === "saudire") {
        const previous = (await readCache(key(job.id)))?.payload as CompanyData | undefined;
        const incoming = await fetchCompany();
        await writeCache(key(job.id), mergeCompany(previous, incoming));
        if (incoming.errors.length) await failCache(key(job.id), "تعذّر تحديث بعض الإعلانات؛ احتُفظ بآخر بياناتها الناجحة.");
      } else await writeCache(key(job.id), await job.run());
    } catch (error) {
      await failCache(key(job.id), error instanceof Error ? error.message : "تعذّر جلب المصدر");
    }
  };
  await Promise.all([
    (async () => {
      await run(jobs[0]);
      // Mubasher's published robots.txt requests a five-second crawl delay.
      await new Promise((resolve) => setTimeout(resolve, 5100));
      await run(jobs[1]);
    })(),
    run(jobs[2]), run(jobs[3]),
  ]);
}
export async function getMarketData(): Promise<MarketData> {
  const records = await Promise.all(jobs.map((job) => readCache(key(job.id))));
  const now = Date.now();
  const company = records[3]?.payload as CompanyData | undefined;
  return {
    indicators: jobs.slice(0, 3).map((job, i) => {
      const record = records[i];
      const payload = record?.payload as MarketIndicator | undefined;
      return { id: job.id as MarketIndicator["id"], data: payload?.observedAt ? payload : null, lastSuccess: record?.updatedAt?.toISOString() ?? null, lastAttempt: record?.attemptedAt?.toISOString() ?? null, error: record?.error ?? null };
    }),
    results: company?.results ?? [], disclosures: company?.disclosures ?? [],
    companyLastSuccess: records[3]?.updatedAt?.toISOString() ?? null,
    companyError: records[3]?.error ?? null,
    limitations: coverage,
    refreshing: records.some((r) => !!r?.lockedUntil && r.lockedUntil.getTime() > now),
    refreshDue: records.some((r, i) => (!r?.attemptedAt || now - r.attemptedAt.getTime() >= jobs[i].interval) && (!r?.lockedUntil || r.lockedUntil.getTime() <= now)),
  };
}
