"use client";
import { useState } from "react";
import { ArrowUpLeft, FileSearch } from "lucide-react";
import { dateLabel, numberLabel } from "@/lib/format";
import type { Disclosure } from "@/lib/types";
export function DisclosuresPanel({ disclosures, lastSuccess, error, loading }: { disclosures: Disclosure[]; lastSuccess: string | null; error?: string | null; loading: boolean }) {
  const [type, setType] = useState("all");
  const rows = disclosures.filter((row) => type === "all" || row.type === type).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return <section className="panel financial-panel">
    <div className="section-heading"><div><span className="eyebrow">إعلانات أصلية · الأحدث أولًا</span><h2>إفصاحات الشركات</h2></div><span className="subtle">{lastSuccess ? `آخر جلب ناجح: ${dateLabel(lastSuccess, true)}` : "بانتظار المصدر"}</span></div>
    <p className="subtle">التغطية الحالية: إعلانات الإعادة السعودية من موقعها الرسمي. تُعرض العناوين بلغتها الأصلية؛ القائمة ليست حصرًا لإفصاحات السوق.</p>
    {error && <p role="status">تعذّر تحديث بعض الإعلانات؛ نعرض آخر بيانات ناجحة.</p>}
    <div className="filter-toolbar"><label>نوع الإعلان<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">جميع الإعلانات</option>{[...new Set(disclosures.map((row) => row.type))].map((value) => <option key={value}>{value}</option>)}</select></label><span>{numberLabel(rows.length)} إعلانات</span></div>
    <div className="disclosure-list">{rows.map((row) => <a key={row.id} href={row.url} target="_blank" rel="noopener noreferrer"><span><strong>{row.company}</strong><small>{row.type} · <time dateTime={row.publishedAt}>{dateLabel(row.publishedAt)}</time></small><span lang={row.language} dir={row.language === "en" ? "ltr" : "rtl"} style={{ display: "block", textAlign: "start" }}>{row.title}</span><small>{row.source} · الإعلان الأصلي</small></span><ArrowUpLeft size={18} /></a>)}</div>
    {!rows.length && <div className="empty-state"><FileSearch size={32} /><h3>{loading ? "جارٍ جلب الإعلانات الرسمية" : "لا توجد إعلانات متاحة لهذا النوع"}</h3></div>}
  </section>;
}
