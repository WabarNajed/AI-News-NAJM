"use client";
import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  RefreshCw,
  Maximize,
  Pause,
  Play,
  Newspaper,
  ChartNoAxesCombined,
  Files,
  Globe2,
  Sparkles,
  ArrowUp,
  CircleAlert,
  ArrowDown,
  ChevronLeft,
} from "lucide-react";
import type { Article, DashboardData } from "@/lib/types";
import { sources, REFRESH_MINUTES } from "@/lib/sources";
import { dateLabel, numberLabel } from "@/lib/format";
import { useAutoScroll } from "./use-auto-scroll";
import { Briefing } from "./briefing";
import { NewsFeed } from "./news-feed";
import { FinancialPanel } from "./financial-panel";
import { DisclosuresPanel } from "./disclosures-panel";
import { useMarketData } from "./use-market-data";
import {
  MarketIndicators,
  SourceSidebar,
  SourceDirectory,
} from "./source-panels";
const tabs = [
  { id: "news", label: "الأخبار والمستجدات", icon: Newspaper },
  { id: "financial", label: "النتائج المالية", icon: ChartNoAxesCombined },
  { id: "disclosures", label: "إفصاحات الشركات", icon: Files },
  { id: "sources", label: "المصادر والمنصات", icon: Globe2 },
  { id: "brief", label: "الملخص التنفيذي", icon: Sparkles },
];
const revision = (a: Article[]) => a.map((i) => i.id + i.updatedAt + (i.related ?? []).map((r) => r.id + r.updatedAt).join(",")).join("|");
export function Dashboard() {
  const { data: market, error: marketError, isLoading: marketLoading, mutate: mutateMarket } = useMarketData();
  const { mutate: mutateShared } = useSWRConfig();
  const [tab, setTab] = useState("news"),
    [visible, setVisible] = useState<Article[] | null>(null),
    [pending, setPending] = useState<Article[] | null>(null),
    [notice, setNotice] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const current = useRef<Article[] | null>(null);
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DashboardData>(
      "/api/news",
      async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error("news");
        return r.json();
      },
      {
        refreshInterval: (latest) =>
          latest?.refreshing ? 3000 : REFRESH_MINUTES * 60000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        onSuccess: (incoming) => {
          if (current.current === null || current.current.length === 0) {
            current.current = incoming.articles;
            setVisible(incoming.articles);
            setPending(null);
          } else if (
            revision(incoming.articles) !== revision(current.current)
          ) {
            setPending(incoming.articles);
          }
        },
      },
    );
  const auto = useAutoScroll(tab !== "news" || !!visible?.length, tab);
  const health =
    data?.sources ??
    sources.map((s) => ({
      ...s,
      status: s.connector ? ("unavailable" as const) : ("directory" as const),
      lastSuccess: null,
      lastAttempt: null,
      error: null,
      count: 0,
    }));
  const articles = visible ?? [];
  async function refresh() {
    setRefreshing(true);
    try {
      const responses = await Promise.all([
        fetch("/api/news", { method: "POST" }),
        fetch("/api/market", { method: "POST" }),
      ]);
      await Promise.all([mutate(), mutateMarket(), mutateShared("/api/brief")]);
      if (responses.some((response) => !response.ok)) throw new Error("refresh");
      setNotice("");
    } catch {
      setNotice("تعذّر التحديث؛ نحتفظ بآخر أخبار ناجحة ووقت جلبها الأصلي.");
    } finally { setRefreshing(false); }
  }
  function acceptUpdates() {
    if (!pending) return;
    const anchor = [
      ...document.querySelectorAll<HTMLElement>("[data-article-id]"),
    ].find((el) => el.getBoundingClientRect().top >= 0);
    const top = anchor?.getBoundingClientRect().top;
    const id = anchor?.dataset.articleId;
    current.current = pending;
    setVisible(pending);
    setPending(null);
    requestAnimationFrame(() => {
      if (id && top !== undefined) {
        const el = document.querySelector(`[data-article-id="${id}"]`);
        if (el) window.scrollBy(0, el.getBoundingClientRect().top - top);
      }
    });
  }
  async function fullScreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setNotice("");
    } catch {
      setNotice(
        "العرض الكامل غير متاح داخل نافذة المعاينة؛ افتح الموقع في نافذة مستقلة.",
      );
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        انتقل إلى المحتوى
      </a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <img
              src="/images/najm-logo.png"
              alt="نجم لخدمات التأمين"
              width="229"
              height="202"
            />
            <div className="brand-divider" />
            <div>
              <h1>مركز ذكاء السوق</h1>
              <p>الخزينة والاستثمار | نجم لخدمات التأمين</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="update-label">
              <span className="inline">
                <span className="status-dot connected" />
                تحديث دوري
              </span>
              <small>
                {data?.lastSuccess
                  ? `آخر نجاح: ${dateLabel(data.lastSuccess, true)}`
                  : "لم يُسجّل تحديث ناجح بعد"}
              </small>
            </div>
            <button
              className="icon-button"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
              disabled={isValidating || refreshing || data?.refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw size={18} className={isValidating || refreshing || data?.refreshing ? "spinning" : ""} />
            </button>
            <button
              className="icon-button"
              title="عرض ملء الشاشة"
              aria-label="عرض ملء الشاشة"
              onClick={fullScreen}
            >
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="context-bar">
        <div className="content-width context-inner">
          <div className="inline">
            <span>ذكاء السوق</span>
            <ChevronLeft size={13} />
            <span>نظرة شاملة</span>
          </div>
          <div className="inline">
            <span className="context-date">
              {dateLabel(new Date().toISOString())}
            </span>
            <span className="separator">|</span>
            <span>
              الرياض <bdi>GMT+3</bdi>
            </span>
          </div>
        </div>
      </div>
      <main id="main" className="content-width">
        <MarketIndicators />
        <Briefing ready={!!data?.lastSuccess} />
        <nav className="section-tabs" aria-label="أقسام مركز ذكاء السوق">
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-current={tab === t.id ? "page" : undefined}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={18} />
              {t.label}
              {t.id === "news" && !!articles.length && (
                <span>{numberLabel(articles.length)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="refresh-slot" role="status">
          {pending ? (
            <button className="new-articles" onClick={acceptUpdates}>
              <ArrowUp size={15} />
              تتوفر أخبار أو تحديثات جديدة · اضغط لعرضها
            </button>
          ) : error ? (
            <span>
              <CircleAlert size={16} />
              تعذّر التحديث؛{" "}
              {articles.length
                ? "نعرض آخر بيانات متاحة."
                : "أعد المحاولة باستخدام زر التحديث."}
            </span>
          ) : data?.refreshing || refreshing ? (
            <span><RefreshCw size={16} className="spinning" /> جارٍ تحديث المصادر؛ تبقى الأخبار المعروضة في موضعها.</span>
          ) : data?.stale ? (
            <span>
              <CircleAlert size={16} />
              تعذّر تحديث بعض المصادر؛ نعرض آخر أخبار ناجحة. راجع حالة المصادر وأوقات الجلب.
            </span>
          ) : (
            <span>
              <span className="status-dot connected" />
              {data
                ? `متابعة ${numberLabel(health.filter((s) => s.status === "connected").length)} مصادر متصلة · تحديث كل ${numberLabel(data.refreshMinutes)} دقيقة`
                : "التحقق من الاتصال بالمصادر…"}
            </span>
          )}
          <span className="subtle">
            {tab === "news"
              ? "العرض حسب تاريخ النشر الأصلي"
              : "بيانات مسندة فقط"}
          </span>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>إغلاق</button>
          </div>
        )}
        {tab === "news" ? (
          <div className="dashboard-columns">
            <NewsFeed
              articles={articles}
              sources={health}
              loading={isLoading || !!data?.refreshing}
              unavailable={!!error || !!data?.stale}
            />
            <SourceSidebar
              sources={health}
              onDirectory={() => setTab("sources")}
            />
          </div>
        ) : tab === "financial" ? (
          <FinancialPanel
            results={market?.results ?? []}
            lastSuccess={market?.companyLastSuccess ?? null}
            error={marketError ? "تعذّر الاتصال" : market?.companyError}
            limitations={market?.limitations ?? []}
            loading={marketLoading || !!market?.refreshing}
          />
        ) : tab === "disclosures" ? (
          <DisclosuresPanel
            disclosures={market?.disclosures ?? []}
            lastSuccess={market?.companyLastSuccess ?? null}
            error={marketError ? "تعذّر الاتصال" : market?.companyError}
            loading={marketLoading || !!market?.refreshing}
          />
        ) : tab === "sources" ? (
          <SourceDirectory sources={health} />
        ) : (
          <div className="brief-detail">
            <Briefing ready={!!data?.lastSuccess} expanded />
            <div className="methodology">
              <p>
                نختار حتى خمسة عناوين عربية حديثة، بحسب الصلة بالتأمين والتنظيم والخزينة، بعد إزالة التكرار. تُنقل العناوين حرفيًا مع روابطها وتواريخها، دون نموذج ذكاء اصطناعي أو استنتاجات مولّدة.
              </p>
            </div>
          </div>
        )}
        <footer className="site-footer">
          <span>نجم لخدمات التأمين · مركز ذكاء السوق</span>
          <span>للمتابعة والاطلاع، وليس توصية استثمارية</span>
        </footer>
      </main>
      <div className="presentation-bar">
        <div className="content-width presentation-inner">
          <div className="inline">
            <span className="presentation-icon">
              <ArrowDown size={16} />
            </span>
            <strong>العرض التلقائي</strong>
            <span className="scroll-status" data-scroll-status>
              {auto.status}
            </span>
          </div>
          <div className="scroll-controls">
            <label htmlFor="scroll-speed">السرعة</label>
            <select
              id="scroll-speed"
              value={auto.speed}
              onChange={(e) => auto.setSpeed(e.target.value)}
            >
              <option value="slow">بطيئة</option>
              <option value="normal">عادية</option>
              <option value="fast">سريعة</option>
            </select>
            <button
              className="play-button"
              aria-pressed={auto.enabled}
              aria-label={auto.enabled ? "إيقاف التمرير التلقائي" : "تشغيل التمرير التلقائي"}
              onClick={(e) => {
                auto.toggle();
                e.currentTarget.blur();
              }}
            >
              {auto.enabled ? <Pause size={15} /> : <Play size={15} />}
              <span>{auto.enabled ? "إيقاف مؤقت" : "تشغيل"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
