import {
  ArrowUpLeft,
  CircleHelp,
  ShieldCheck,
  ArrowLeft,
  Link2,
} from "lucide-react";
import type { SourceHealth } from "@/lib/types";
import { dateLabel, numberLabel, westernDigits, indicatorNumber, indicatorDate } from "@/lib/format";
import { useMarketData } from "./use-market-data";
export function MarketIndicators() {
  const { data, error } = useMarketData();
  const labels = { tasi: "مؤشر السوق الرئيسية (تاسي)", insurance: "مؤشر قطاع التأمين", repo: "معدل إعادة الشراء" };
  return (
    <section className="market-strip" aria-label="المؤشرات السوقية">
      <div className="market-intro">
        <span className="eyebrow">نبض السوق</span>
        <strong>بيانات قابلة للتتبّع</strong>
        <span>أسعار متأخرة · مصادر عامة</span>
      </div>
      {(["tasi", "insurance", "repo"] as const).map((id) => {
        const record = data?.indicators.find((item) => item.id === id);
        const item = record?.data;
        return (
          <div className="market-item" key={id} data-market-indicator={id}>
            <span>{labels[id]}</span>
            <div>
              <strong><bdi dir="ltr">{item ? indicatorNumber(item.value) : "—"}{item?.unit === "٪" ? "%" : ""}</bdi></strong>
              <span className="neutral-tag">{item?.delayed ? "متأخر 15 دقيقة" : item ? "معدل منشور" : "قيد التحقق"}</span>
            </div>
            {item && <>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.source}<ArrowUpLeft size={13} /></a>
              <small>تاريخ المصدر: <bdi dir={/[\u0600-\u06ff]/.test(item.sourceDate) ? "rtl" : "ltr"}>{westernDigits(item.sourceDate)}</bdi></small>
              <small>آخر رصد ناجح: <bdi dir="rtl">{indicatorDate(item.observedAt)}</bdi></small>
            </>}
            {(record?.error || error) && <small role="status">تعذّر التحديث؛ {item ? "نعرض آخر رصد ناجح." : "لا توجد قيمة موثقة بعد."}</small>}
          </div>
        );
      })}
    </section>
  );
}
export function SourceSidebar({
  sources,
  onDirectory,
}: {
  sources: SourceHealth[];
  onDirectory: () => void;
}) {
  return (
    <aside className="source-sidebar">
      <section className="panel side-panel">
        <div className="section-heading">
          <h2>رادار المصادر</h2>
          <ShieldCheck size={18} />
        </div>
        <p className="side-intro">حالة الجلب من الجهات الرسمية</p>
        <div className="source-status-list">
          {sources.slice(0, 6).map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span
                className={`status-dot ${s.status === "connected" ? "connected" : ""}`}
              />
              <span>
                <strong>{s.name}</strong>
                <small>
                  {s.status === "connected"
                    ? "آخر جلب ناجح"
                    : s.status === "unavailable"
                      ? "تعذّر الاتصال"
                      : "رابط مرجعي فقط"}
                  {s.lastSuccess &&
                    ` · ${new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(s.lastSuccess))}`}
                </small>
              </span>
              <ArrowUpLeft size={14} />
            </a>
          ))}
        </div>
        <button className="directory-button" onClick={onDirectory}>
          جميع المصادر وحالة الربط
          <ArrowLeft size={16} />
        </button>
      </section>
      <section className="side-note">
        <CircleHelp size={19} />
        <h3>المصدر أولًا، ثم التحليل</h3>
        <p>
          نميّز الإعلان الرسمي عن التوقع، وتاريخ النشر عن وقت الجلب. التحديث
          الدوري لا يعني بيانات لحظية.
        </p>
        <div className="note-divider" />
        <p>الأسعار والنتائج المالية لا تظهر إلا عند توفر مصدر قابل للتحقق.</p>
      </section>
      <div className="sidebar-footer">
        <span>مخصص للخزينة والاستثمار</span>
        <strong>رؤية أوضح. قرار أكثر اطلاعًا.</strong>
      </div>
    </aside>
  );
}
export function SourceDirectory({ sources }: { sources: SourceHealth[] }) {
  return (
    <section className="panel directory-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">الشفافية في التغطية</span>
          <h2>المصادر والمنصات</h2>
        </div>
        <Link2 size={22} />
      </div>
      <p className="directory-intro">
        «متصل» يعني نجاح جلب أخبار فعلية. الروابط المرجعية لا تعني وجود تكامل أو
        اشتراك لدى المزود. لا يجري تجاوز جدران الدفع أو قيود الوصول.
      </p>
      {(["official", "media", "social"] as const).map((type) => (
        <div className="directory-group" key={type}>
          <h3>
            {type === "official"
              ? "الجهات الرسمية"
              : type === "media"
                ? "المنصات الإخبارية والمالية"
                : "حسابات مرجعية على إكس"}
          </h3>
          <div className="directory-grid">
            {sources
              .filter((s) => s.type === type)
              .map((s) => (
                <article key={s.id} className="source-card">
                  <div className="inline spread">
                    <h4>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.name}
                        <ArrowUpLeft size={16} />
                      </a>
                    </h4>
                    <span
                      className={`source-badge ${s.status === "connected" ? "good" : ""}`}
                    >
                      {s.status === "connected"
                        ? "متصل"
                        : s.status === "unavailable"
                          ? "غير متاح"
                          : "دليل فقط"}
                    </span>
                  </div>
                  <p>{s.note}</p>
                  {s.error && <p className="source-error">{s.error}</p>}
                  {s.connector && (
                    <small>
                      الأخبار المحفوظة: {new Intl.NumberFormat("ar-SA").format(s.count)}
                      <br />
                      آخر نجاح:{" "}
                      {s.lastSuccess
                        ? dateLabel(s.lastSuccess, true)
                        : "لم يُسجّل"}
                      <br />
                      آخر محاولة:{" "}
                      {s.lastAttempt
                        ? dateLabel(s.lastAttempt, true)
                        : "لم تُسجّل"}
                    </small>
                  )}
                </article>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
