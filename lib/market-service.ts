import { claim, failCache, readCache, writeCache } from "./db";
import { checkPublicPolicy, fetchCompany, fetchIndex, fetchRepo, type CompanyData } from "./market-sources";
import { insurers, insurerDirectory, insurerSource } from "./insurers";
import { fetchInsurer, verifyListedDirectory } from "./insurer-sources";
import type { MarketData, MarketIndicator } from "./types";
const minute = 60000;
const jobs = [
  { id: "tasi", interval: 15 * minute, run: () => fetchIndex("tasi") },
  { id: "insurance", interval: 15 * minute, run: () => fetchIndex("insurance") },
  { id: "repo", interval: 6 * 60 * minute, run: fetchRepo },
  { id: "saudire", interval: 6 * 60 * minute, run: fetchCompany },
] as const;
const key = (id: string) => `public-market:v1:${id}`;
const companyKey = (symbol: string) => key(`insurer:${symbol}`);
const directoryKey = key("insurer-directory");
const refreshCycleKey = key("insurer-refresh-cycle");
const companyInterval = 6 * 60 * minute;
export const coverage = [
  `النطاق: ${insurers.length} شركة تأمين وإعادة تأمين مدرجة، طُوبقت مع سجل هيئة التأمين بتاريخ ${insurerDirectory.registerDate} ودليل الشركات المدرجة بتاريخ ${insurerDirectory.verifiedAt}. رسن شركة تقنية وليست شركة تأمين؛ لا تشمل القائمة الشركات غير المدرجة والفروع الأجنبية.`,
  "تداول أعاد HTTP 403. نستخدم التقارير المالية العامة وعناوين إعلانات تداول المنشورة عبر أرقام، إضافة إلى الموقع الرسمي للإعادة السعودية. لا نتجاوز حجبًا أو اشتراكًا مدفوعًا.",
  "الأرقام بمليون ريال سعودي ومقربة كما نُشرت. صافي الدخل منفصل عن الربح قبل الزكاة. الأرباع مستقلة عن النصف الأول والتسعة أشهر التراكمية. لا نستنتج قيمًا من نسب النمو؛ المفقود يبقى فارغًا.",
  "جلب آلي مجاني كل 6 ساعات أثناء فتح اللوحة، على دفعات قصيرة مستقلة لكل شركة. نبدأ بآخر تقريرين متاحين ونحتفظ بالسجل الناجح؛ ليست أرشيفًا كاملًا لكل الفترات أو الإعلانات. فشل شركة لا يمنع تحديث البقية.",
];
export function mergeCompany(old: CompanyData | undefined, next: CompanyData): CompanyData {
  const results = new Map((old?.results ?? []).map((r) => [`${r.company}:${r.period}`, r]));
  for (const row of next.results) {
    const id = `${row.company}:${row.period}`;
    const previous = results.get(id);
    if (!previous || ((row.publishedAt ?? "") >= (previous.publishedAt ?? "") && (row.current !== null || previous.current === null))) results.set(id, row);
  }
  const disclosures = new Map((old?.disclosures ?? []).map((r) => [r.id, r]));
  for (const row of next.disclosures) disclosures.set(row.id, row);
  return { results: [...results.values()], disclosures: [...disclosures.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 150), errors: next.errors };
}
export async function refreshMarket(force = false) {
  if (force && await claim(refreshCycleKey, minute)) await writeCache(refreshCycleKey, { requestedAt: new Date().toISOString() });
  const cycle = (await readCache(refreshCycleKey))?.payload as { requestedAt?: string } | undefined;
  const requestedAt = Date.parse(cycle?.requestedAt ?? "") || 0;
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
  const refreshInsurers = async () => {
    const batchKey = key("insurer-batch-lock");
    if (!(await claim(batchKey, 0))) return;
    try {
    const records = await Promise.all(insurers.map((c) => readCache(companyKey(c.symbol))));
    const interval = force ? minute : companyInterval;
    const now = Date.now();
    const due = insurers.map((company, i) => ({ company, record: records[i] })).filter(({ record }) => (!record?.attemptedAt || now - record.attemptedAt.getTime() >= interval || (record.attemptedAt.getTime() < requestedAt && now - record.attemptedAt.getTime() >= minute)) && (!record?.lockedUntil || record.lockedUntil.getTime() <= now)).sort((a, b) => Number(!!b.record?.error) - Number(!!a.record?.error) || (a.record?.attemptedAt?.getTime() ?? 0) - (b.record?.attemptedAt?.getTime() ?? 0)).slice(0, 1);
    if (!due.length) return;
    const policy = await checkPublicPolicy(insurerDirectory.listedDirectory).catch(() => null);
    await Promise.all(due.map(async ({ company, record }) => {
      const cacheKey = companyKey(company.symbol);
      if (!(await claim(cacheKey, (record?.attemptedAt?.getTime() ?? 0) < requestedAt ? minute : interval))) return;
      try {
        if (!policy) throw new Error("تعذّر التحقق من سياسة المصدر العام");
        const incoming = await fetchInsurer(company, policy);
        await writeCache(cacheKey, mergeCompany(record?.payload as CompanyData | undefined, incoming));
        if (incoming.errors.length) await failCache(cacheKey, incoming.errors.join(" · "));
      } catch (error) { await failCache(cacheKey, error instanceof Error ? error.message : "تعذّر جلب الشركة"); }
    }));
    } finally { await writeCache(batchKey, {}); }
  };
  const refreshDirectory = async () => {
    if (!(await claim(directoryKey, 24 * 60 * minute))) return;
    try { await writeCache(directoryKey, await verifyListedDirectory()); }
    catch { await failCache(directoryKey, "تعذّر تحديث دليل الإدراج؛ نعرض نطاق آخر مطابقة معلنة."); }
  };
  await Promise.all([
    refreshInsurers(), refreshDirectory(),
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
  const companyRecords = await Promise.all(insurers.map((c) => readCache(companyKey(c.symbol))));
  const directory = await readCache(directoryKey);
  const directoryData = directory?.payload as { checkedAt?: string; differences?: string[] } | undefined;
  const legacy = records[3]?.payload as CompanyData | undefined;
  const companies = insurers.map((c, i) => {
    const payload = companyRecords[i]?.payload as CompanyData | undefined;
    return c.symbol === "8200" ? mergeCompany(legacy, { results: payload?.results ?? [], disclosures: payload?.disclosures ?? [], errors: payload?.errors ?? [] }) : payload;
  });
  const companyCoverage = insurers.map((c, i) => ({
    symbol: c.symbol, company: c.name, sourceUrl: insurerSource(c),
    periods: [...new Set((companies[i]?.results ?? []).filter((r) => r.current !== null).map((r) => r.period))].sort().reverse(),
    results: companies[i]?.results?.filter((r) => r.current !== null).length ?? 0,
    disclosures: companies[i]?.disclosures?.length ?? 0,
    lastSuccess: companyRecords[i]?.updatedAt?.toISOString() ?? (c.symbol === "8200" ? records[3]?.updatedAt?.toISOString() ?? null : null),
    error: companyRecords[i]?.error ?? null,
    missingComparatives: companies[i]?.results?.filter((r) => r.previous === null).length ?? 0,
  }));
  const cycle = (await readCache(refreshCycleKey))?.payload as { requestedAt?: string } | undefined;
  const requestedAt = Date.parse(cycle?.requestedAt ?? "") || 0;
  const companyDue = companyRecords.some((r) => (!r?.attemptedAt || now - r.attemptedAt.getTime() >= companyInterval || r.attemptedAt.getTime() < requestedAt) && (!r?.lockedUntil || r.lockedUntil.getTime() <= now));
  const companyRefreshing = companyRecords.some((r) => !!r?.lockedUntil && r.lockedUntil.getTime() > now);
  const successTimes = companyCoverage.flatMap((c) => c.lastSuccess ? [c.lastSuccess] : []).sort();
  return {
    companyCoverage,
    directoryCheckedAt: directoryData?.checkedAt ?? null,
    indicators: jobs.slice(0, 3).map((job, i) => {
      const record = records[i];
      const payload = record?.payload as MarketIndicator | undefined;
      return { id: job.id as MarketIndicator["id"], data: payload?.observedAt ? payload : null, lastSuccess: record?.updatedAt?.toISOString() ?? null, lastAttempt: record?.attemptedAt?.toISOString() ?? null, error: record?.error ?? null };
    }),
    results: companies.flatMap((c) => c?.results ?? []), disclosures: companies.flatMap((c) => c?.disclosures ?? []).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    companyLastSuccess: successTimes.at(-1) ?? null,
    companyError: companyCoverage.some((c) => c.error) ? "تعذّر تحديث بعض الشركات؛ راجع حالة كل شركة." : records[3]?.error ?? null,
    limitations: [...coverage, ...(directory?.error ? [directory.error] : []), ...(directoryData?.differences ?? [])],
    refreshing: companyRefreshing || records.some((r) => !!r?.lockedUntil && r.lockedUntil.getTime() > now),
    refreshDue: companyDue || records.some((r, i) => (!r?.attemptedAt || now - r.attemptedAt.getTime() >= jobs[i].interval) && (!r?.lockedUntil || r.lockedUntil.getTime() <= now)),
  };
}
