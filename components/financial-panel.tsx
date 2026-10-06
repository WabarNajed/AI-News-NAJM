"use client";
import { useState } from "react";
import { ArrowUpLeft, FileSearch, Info } from "lucide-react";
import {
  change,
  financialStats,
  availablePeriods,
  selectResults,
} from "@/lib/financial";
import { dateLabel, numberLabel } from "@/lib/format";
import type { FinancialResult, CompanyCoverage as Coverage } from "@/lib/types";
import { CompanyCoverage } from "./company-coverage";
export function FinancialPanel({
  results, lastSuccess, error, limitations, loading, companyCoverage, directoryCheckedAt,
}: {
  results: FinancialResult[];
  companyCoverage: Coverage[];
  directoryCheckedAt: string | null;
  lastSuccess: string | null;
  error?: string | null;
  limitations: string[];
  loading: boolean;
}) {
  const [selectedPeriod, setPeriod] = useState(""),
    [sort, setSort] = useState("change-desc"),
    [company, setCompany] = useState("all");
  const periods = availablePeriods(results);
  const period = selectedPeriod || periods[0].id;
  const selection = periods.find((p) => p.id === period)!;
  const rows = selectResults(results, period, sort).filter(
    (r) => company === "all" || r.company === company,
  );
  const stats = financialStats(rows);
  return (
    <section className="panel financial-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">أداء القطاع · تغطية محدودة معلنة</span>
          <h2>النتائج المالية لشركات التأمين</h2>
        </div>
        <span className="subtle">{lastSuccess ? `آخر جلب ناجح: ${dateLabel(lastSuccess, true)}` : "بانتظار أول جلب موثق"}</span>
      </div>
      {error && <p role="status">تعذّر تحديث بعض البيانات؛ نحتفظ بآخر نتائج ناجحة وتاريخها.</p>}
      <details className="methodology">
        <summary>تغطية المصادر وحدود البيانات</summary>
        {limitations.map((text) => <p key={text}>{text}</p>)}
        <CompanyCoverage companies={companyCoverage} period={period} checkedAt={directoryCheckedAt} />
      </details>
      <div className="filter-toolbar">
        <label>
          الفترة المالية
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setCompany("all"); }}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          ترتيب النتائج
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="change-desc">الأعلى تغيرًا</option>
            <option value="change-asc">الأقل تغيرًا</option>
            <option value="profit-desc">الأعلى ربحًا</option>
          </select>
        </label>
        <label>
          الشركة
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="all">جميع الشركات المتاحة</option>
            {[...new Set(results.filter((r) => r.period === period).map((r) => r.company))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="financial-stats">
        {[
          ["الشركات في البيانات", stats.total],
          ["شركات رابحة", stats.profit],
          ["شركات خاسرة", stats.loss],
          ["تحوّل إلى الربح", stats.turnaround],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{numberLabel(Number(value))}</strong>
          </div>
        ))}
      </div>
      <div className="table-caption">
        <h3>{selection.label}</h3>
        <span>مقارنة بالفترة المماثلة · جميع القيم بمليون ريال سعودي</span>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="جدول النتائج المالية"
      >
        <table>
          <thead>
            <tr>
              <th>الشركة</th>
              <th>{selection.label}</th>
              <th>{selection.previous}</th>
              <th>التغير السنوي</th>
              <th>الوحدة / التعريف</th>
              <th>حالة الإفصاح</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = change(r.current, r.previous, r.comparable);
              return (
                <tr key={`${r.company}-${r.period}`}>
                  <th>{r.company}</th>
                  <td>
                    <bdi>
                      {r.current === null ? "—" : numberLabel(r.current)}
                    </bdi>
                  </td>
                  <td>
                    <bdi>
                      {r.previous === null ? "—" : numberLabel(r.previous)}
                    </bdi>
                  </td>
                  <td>
                    <bdi>
                      {c.percent === null ? "—" : `${numberLabel(c.percent)}٪`}
                    </bdi>
                    <small>{c.label}</small>
                  </td>
                  <td>
                    {r.unit} · {r.currency}
                    <small>{r.definition}</small>
                  </td>
                  <td>
                    {r.status === "not_published" ? (
                      "لم يُنشر بحسب المصدر"
                    ) : r.status === "retrieval_failed" ? (
                      "تعذّر الجلب أو التحليل"
                    ) : r.disclosureUrl ? (
                      <a
                        className="text-link"
                        href={r.disclosureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        التقرير المصدر
                        <ArrowUpLeft size={14} />
                      </a>
                    ) : (
                      "رابط الإفصاح غير متاح"
                    )}
                    <small>{dateLabel(r.publishedAt)}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <FileSearch size={34} />
          <h3>{loading ? "جارٍ جلب النتائج الرسمية" : "لا توجد نتائج موثقة لهذه الفترة ضمن التغطية الحالية"}</h3>
          <p>عدم توفر البيانات هنا لا يعني أن الشركات لم تنشر نتائجها. القيم المفقودة ليست صفرًا.</p>
        </div>
      )}
      <div className="methodology">
        <Info size={18} />
        <p>
          المنهجية: التغير = (الحالي − المقارن) ÷ القيمة المطلقة للمقارن × ١٠٠.
          لا تُحسب نسبة عند أساس صفري أو فترات أو تعريفات غير متطابقة. الربع
          الثاني مستقل عن النصف الأول التراكمي؛ القيم المفقودة ليست صفرًا.
        </p>
      </div>
    </section>
  );
}
