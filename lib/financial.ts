import type { FinancialResult } from "./types";
export const periods = [
  { id: "2026-Q1", label: "الربع الأول ٢٠٢٦", previous: "الربع الأول ٢٠٢٥" },
  { id: "2026-Q2", label: "الربع الثاني ٢٠٢٦", previous: "الربع الثاني ٢٠٢٥" },
  {
    id: "2026-H1",
    label: "النصف الأول ٢٠٢٦ (تراكمي)",
    previous: "النصف الأول ٢٠٢٥ (تراكمي)",
  },
  {
    id: "2025-FY",
    label: "السنة المالية ٢٠٢٥",
    previous: "السنة المالية ٢٠٢٤",
  },
];
export function availablePeriods(results: FinancialResult[]) {
  if (!results.length) return periods;
  const names: Record<string, string> = { Q1: "الربع الأول", Q2: "الربع الثاني", Q3: "الربع الثالث", Q4: "الربع الرابع", H1: "النصف الأول (تراكمي)", "9M": "التسعة أشهر (تراكمي)", FY: "السنة المالية" };
  return [...new Set(results.map((r) => r.period))].filter((id) => /^20\d{2}-(Q[1-4]|H1|9M|FY)$/.test(id)).sort((a, b) => b.localeCompare(a)).map((id) => {
    const [year, period] = id.split("-");
    return { id, label: `${names[period]} ${year}`, previous: `${names[period]} ${Number(year) - 1}` };
  });
}
export function change(
  current: number | null,
  previous: number | null,
  comparable = true,
) {
  if (
    !comparable ||
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  )
    return { percent: null, label: "غير متاح للمقارنة" };
  if (previous === 0) return { percent: null, label: "أساس المقارنة صفر" };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  const label =
    previous < 0 && current > 0
      ? "تحوّل إلى الربح"
      : previous > 0 && current < 0
        ? "تحوّل إلى الخسارة"
        : previous < 0 && current < 0
          ? current > previous
            ? "تقلّص الخسارة"
            : current < previous
              ? "اتساع الخسارة"
              : "دون تغير"
          : "التغير السنوي";
  return { percent, label };
}
export function selectResults(
  rows: FinancialResult[],
  period: string,
  sort: string,
) {
  const value = (r: FinancialResult) =>
    r.status !== "verified"
      ? null
      : sort === "profit-desc"
        ? r.current
        : change(r.current, r.previous, r.comparable).percent;
  return rows
    .filter((r) => r.period === period)
    .sort((a, b) => {
      const av = value(a),
        bv = value(b);
      if (av === null)
        return bv === null ? a.company.localeCompare(b.company, "ar") : 1;
      if (bv === null) return -1;
      return sort === "change-asc" ? av - bv : bv - av;
    });
}
export function financialStats(rows: FinancialResult[]) {
  const valid = rows.filter(
    (r) => r.status === "verified" && r.current !== null,
  );
  return {
    total: new Set(rows.map((r) => r.company)).size,
    profit: valid.filter((r) => r.current! > 0).length,
    loss: valid.filter((r) => r.current! < 0).length,
    turnaround: valid.filter(
      (r) =>
        r.previous !== null && r.previous < 0 && r.current! > 0 && r.comparable,
    ).length,
  };
}
