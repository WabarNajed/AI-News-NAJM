"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpLeft,
  Search,
  SlidersHorizontal,
  X,
  Newspaper,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { categories, type Article, type SourceHealth } from "@/lib/types";
import { dateLabel, numberLabel } from "@/lib/format";
export function NewsFeed({
  articles,
  sources,
  loading,
  unavailable,
}: {
  articles: Article[];
  sources: SourceHealth[];
  loading: boolean;
  unavailable: boolean;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [source, setSource] = useState("all"),
    [days, setDays] = useState("all"),
    [order, setOrder] = useState("recent");
  const filtered = useMemo(
    () =>
      articles
        .filter(
          (a) =>
            (!query ||
              `${a.title} ${a.summary ?? ""} ${a.entity}`.includes(
                query.trim(),
              )) &&
            (category === "all" || a.category === category) &&
            (source === "all" || a.sourceId === source) &&
            (days === "all" ||
              (a.publishedAt &&
                Date.parse(a.publishedAt) >=
                  Date.now() - Number(days) * 86400000)),
        )
        .sort((a, b) =>
          order === "relevant"
            ? Number(b.category === "najm") * 10 +
                Number(b.category === "sector") * 5 -
                Number(a.category === "najm") * 10 -
                Number(a.category === "sector") * 5 ||
              (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
            : (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
        ),
    [articles, query, category, source, days, order],
  );
  const active =
    !!query || category !== "all" || source !== "all" || days !== "all";
  function reset() {
    setQuery("");
    setCategory("all");
    setSource("all");
    setDays("all");
  }
  return (
    <section className="panel news-panel" aria-labelledby="news-heading">
      <div className="section-heading">
        <div className="inline">
          <h2 id="news-heading">آخر الأخبار والمستجدات</h2>
          <span className="count">{numberLabel(filtered.length)}</span>
        </div>
        <label className="sort-label">
          الترتيب
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="recent">الأحدث نشرًا</option>
            <option value="relevant">الأكثر صلة</option>
          </select>
        </label>
      </div>
      <div className="news-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="البحث في الأخبار"
            placeholder="ابحث عن خبر، شركة، أو موضوع…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="مسح البحث" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <label className="compact-select">
          <span className="sr-only">المصدر</span>
          <select
            aria-label="المصدر"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">كل المصادر</option>
            {sources
              .filter((s) => s.connector)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label className="compact-select">
          <span className="sr-only">تاريخ النشر</span>
          <select
            aria-label="تاريخ النشر"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="all">كل الفترات</option>
            <option value="1">آخر ٢٤ ساعة</option>
            <option value="7">آخر ٧ أيام</option>
            <option value="30">آخر ٣٠ يومًا</option>
          </select>
        </label>
      </div>
      <div className="category-row">
        <SlidersHorizontal size={16} />
        {[["all", "الكل"], ...Object.entries(categories)].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={category === id}
            className={category === id ? "chip selected" : "chip"}
            onClick={() => setCategory(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {active && (
        <div className="active-filters">
          <span>
            فلاتر نشطة{query && ` · «${query}»`}
            {source !== "all" &&
              ` · ${sources.find((s) => s.id === source)?.name}`}
            {days !== "all" && ` · آخر ${numberLabel(Number(days))} يومًا`}
          </span>
          <button onClick={reset}>
            مسح الفلاتر
            <X size={14} />
          </button>
        </div>
      )}
      {loading && !articles.length ? (
        <div className="empty-state" role="status">
          <span className="spinner" />
          <h3>نجلب الأخبار من المصادر الرسمية</h3>
          <p>يُتحقّق من كل مصدر بصورة مستقلة.</p>
        </div>
      ) : filtered.length ? (
        <div className="news-list">
          {filtered.map((a) => (
            <article className="news-item" data-article-id={a.id} key={a.id}>
              <div className="article-top">
                <div className="inline">
                  <span className="category-tag">{categories[a.category]}</span>
                  <span className="publisher">
                    <ShieldCheck size={14} />
                    {a.source}
                  </span>
                </div>
                <span className="article-date">
                  <Clock3 size={13} />
                  <time dateTime={a.publishedAt ?? undefined}>
                    {dateLabel(a.publishedAt, !a.dateOnly)}
                  </time>
                </span>
              </div>
              <div className="article-title-row">
                <h3>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.title}
                  </a>
                </h3>
                <a
                  className="article-open"
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`فتح المصدر الأصلي: ${a.title}`}
                >
                  <ArrowUpLeft size={19} />
                </a>
              </div>
              <p className="article-summary">
                {a.summary ??
                  "المتاح هو عنوان الإعلان فقط؛ لا يتوفر نص كافٍ لعرض ملخص."}
              </p>
              <div className="article-bottom">
                <span>
                  {a.kind === "announcement"
                    ? "إعلان رسمي"
                    : a.kind === "forecast"
                      ? "توقع"
                      : a.kind === "commentary"
                        ? "رأي وتحليل"
                        : "تغطية منسوبة"}
                  {a.publishedAt &&
                  Date.now() - Date.parse(a.publishedAt) > 7 * 86400000
                    ? " · نُشر قبل أكثر من أسبوع"
                    : ""}
                </span>
                <details>
                  <summary>بيانات المصدر</summary>
                  <div>
                    الجهة: {a.entity}
                    <br />
                    جُلب: {dateLabel(a.retrievedAt, true)}
                    <br />
                    آخر تغير رُصد للمحتوى: {dateLabel(a.updatedAt, true)}
                    <br />
                    {a.dateOnly ? "المصدر يحدد يوم النشر دون ساعة." : ""}
                    <br />
                    النص المعروض مقتطف من المصدر، لا ملخص مولّد.
                    {a.related?.map((r) => (
                      <a
                        key={r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        تغطية مرتبطة · {r.source}
                      </a>
                    ))}
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Newspaper size={34} />
          <h3>
            {unavailable && !articles.length
              ? "المصادر غير متاحة حاليًا"
              : "لا توجد أخبار مطابقة"}
          </h3>
          <p>
            {unavailable && !articles.length
              ? "تعذّر جلب الأخبار؛ راجع حالة المصادر أو أعد المحاولة لاحقًا."
              : "جرّب توسيع الفترة الزمنية أو تغيير كلمات البحث. لا يعني ذلك عدم وجود تطورات خارج المصادر المرتبطة."}
          </p>
          {active && (
            <button className="button" onClick={reset}>
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      )}
      <div className="panel-footer">
        <ShieldCheck size={15} />
        <span>
          روابط أصلية · تواريخ نشر منفصلة عن أوقات الجلب · بتوقيت الرياض
        </span>
      </div>
    </section>
  );
}
