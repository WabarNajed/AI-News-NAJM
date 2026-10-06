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

export const westernDigits = (value: string) => value.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660)));
export const indicatorNumber = (value: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export function indicatorDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
