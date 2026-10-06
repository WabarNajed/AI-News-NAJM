"use client";
import { useState } from "react";
import { ArrowUpLeft, FileSearch, Info } from "lucide-react";
import {
  change,
  financialStats,
  periods,
  selectResults,
} from "@/lib/financial";
import { dateLabel, numberLabel } from "@/lib/format";
import type { Article, FinancialResult } from "@/lib/types";
export function FinancialPanel({
  results,
  disclosures = false,
  articles,
}: {
  results: FinancialResult[];
  disclosures?: boolean;
  articles: Article[];
}) {
  const [period, setPeriod] = useState("2026-Q1"),
    [sort, setSort] = useState("change-desc"),
    [company, setCompany] = useState("all");
  const selection = periods.find((p) => p.id === period)!;
  const rows = selectResults(results, period, sort).filter(
    (r) => company === "all" || r.company === company,
  );
  const stats = financialStats(rows);
  return (
    <section className="panel financial-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {disclosures ? "إعلانات السوق" : "أداء القطاع"}
          </span>
          <h2>
            {disclosures ? "إفصاحات الشركات" : "النتائج المالية لشركات التأمين"}
          </h2>
        </div>
        <a
          className="text-link"
          href="https://www.saudiexchange.sa/"
          target="_blank"
          rel="noopener noreferrer"
        >
          دليل تداول السعودية
          <ArrowUpLeft size={16} />
        </a>
      </div>
      <div className="filter-toolbar">
        <label>
          الفترة المالية
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
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
            {[...new Set(results.map((r) => r.company))].map((c) => (
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
        <span>مقارنة بالفترة المماثلة · العملة والوحدة حسب الإفصاح</span>
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
                        الإفصاح الأصلي
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
          <h3>لا توجد نتائج موثقة لهذه الفترة</h3>
          <p>
            حُجبت الأرقام السابقة لغياب روابط الإفصاحات المؤيدة لها. عدم توفر
            البيانات هنا لا يعني أن الشركات لم تنشر نتائجها.
          </p>
          <a
            className="button"
            href="https://www.saudiexchange.sa/"
            target="_blank"
            rel="noopener noreferrer"
          >
            الانتقال إلى مصدر الإفصاحات
            <ArrowUpLeft size={16} />
          </a>
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
      {disclosures && (
        <div className="disclosure-list">
          <h3>إعلانات تنظيمية مرتبطة بالشركات · ليست قوائم مالية</h3>
          {articles
            .filter((a) => /شركة|شركات/.test(a.title))
            .slice(0, 8)
            .map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  {a.title}
                  <small>
                    {a.source} · {dateLabel(a.publishedAt)}
                  </small>
                </span>
                <ArrowUpLeft size={18} />
              </a>
            ))}
        </div>
      )}
    </section>
  );
}
