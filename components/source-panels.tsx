import {
  ArrowUpLeft,
  CircleHelp,
  ShieldCheck,
  ArrowLeft,
  Link2,
} from "lucide-react";
import type { SourceHealth } from "@/lib/types";
import { dateLabel } from "@/lib/format";
export function MarketIndicators() {
  return (
    <section className="market-strip" aria-label="المؤشرات السوقية">
      <div className="market-intro">
        <span className="eyebrow">نبض السوق</span>
        <strong>بيانات قابلة للتتبّع</strong>
        <span>لا تُعرض قيم دون مصدر</span>
      </div>
      {[
        [
          "مؤشر السوق الرئيسية",
          "تداول السعودية",
          "https://www.saudiexchange.sa/",
        ],
        [
          "مؤشر قطاع التأمين",
          "تداول السعودية",
          "https://www.saudiexchange.sa/",
        ],
        [
          "معدل إعادة الشراء",
          "البنك المركزي السعودي",
          "https://www.sama.gov.sa/",
        ],
      ].map(([label, source, url]) => (
        <div className="market-item" key={label}>
          <span>{label}</span>
          <div>
            <strong aria-label="غير متاح">—</strong>
            <span className="neutral-tag">غير مربوط</span>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {source}
            <ArrowUpLeft size={13} />
          </a>
          <small>تاريخ الرصد: غير متاح</small>
        </div>
      ))}
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
