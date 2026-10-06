"use client";
import useSWR from "swr";
import { ArrowUpLeft, Sparkles, FileText } from "lucide-react";
import { dateLabel } from "@/lib/format";
import type { Brief } from "@/lib/types";
const fetchBrief = async (url: string): Promise<Brief> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("brief");
  return r.json();
};
export function Briefing({
  ready,
  expanded = false,
}: {
  ready: boolean;
  expanded?: boolean;
}) {
  const { data, isLoading, error } = useSWR<Brief>(
    ready ? "/api/brief" : null,
    fetchBrief,
    {
      revalidateOnFocus: false,
      dedupingInterval: 900000,
      refreshInterval: 900000,
      shouldRetryOnError: false,
    },
  );
  const items = data?.status === "ready" ? data.items : [];
  return (
    <section
      className={`brief-panel ${expanded ? "expanded" : ""}`}
      aria-labelledby={expanded ? "brief-detail-title" : "brief-title"}
    >
      <div className="brief-heading">
        <div className="inline">
          <Sparkles size={19} />
          <h2 id={expanded ? "brief-detail-title" : "brief-title"}>
            الموجز التنفيذي
          </h2>
          <span className="brief-tag">مدعوم بالذكاء الاصطناعي</span>
        </div>
        <span className="brief-time">
          {data?.generatedAt
            ? `أُعدّ ${dateLabel(data.generatedAt, true)}`
            : "قراءة موجزة · مصادر معلنة"}
        </span>
      </div>
      {items.length ? (
        <div className="brief-grid">
          {items.map((item) => (
            <article className="brief-item" key={item.articleId}>
              <span className="eyebrow">المستجد</span>
              <h3>{item.fact}</h3>
              <p>
                <span className="analysis-label">تحليل محتمل</span>{" "}
                {item.analysis}
              </p>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.source}
                <ArrowUpLeft size={15} />
              </a>
              {expanded && (
                <details>
                  <summary>الاقتباس الداعم</summary>
                  <blockquote>{item.evidence}</blockquote>
                </details>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="brief-empty">
          <FileText size={24} />
          <div>
            <h3>
              {isLoading
                ? "نُعدّ موجزًا من الأخبار المتاحة"
                : data?.status === "insufficient"
                  ? "لا تتوفر مادة حديثة كافية لإعداد الموجز"
                  : data?.status === "unavailable" || error
                    ? "الموجز غير متاح حاليًا"
                    : data?.status === "pending"
                      ? "الموجز قيد الإعداد أو ينتظر المحاولة التالية"
                      : "بانتظار الأخبار المسندة"}
            </h3>
            <p>
              {data?.message ??
                "لن نولّد استنتاجات من العناوين وحدها. تبقى الأخبار ومصادرها متاحة بصورة مستقلة."}
            </p>
          </div>
        </div>
      )}
      <div className="brief-foot">
        الوقائع من المصادر المشار إليها؛ الدلالات التحليلية ليست معلومات عن
        الوضع الداخلي لنجم ولا توصية استثمارية.
      </div>
    </section>
  );
}
