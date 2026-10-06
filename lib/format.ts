export function dateLabel(value: string | null, time = false) {
  if (!value) return "تاريخ النشر غير متاح";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "تاريخ غير متاح";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
export const numberLabel = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n);
