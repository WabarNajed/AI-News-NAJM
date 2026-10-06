import { dedupe, safeUrl } from "./news-utils";
import type { Article, Brief } from "./types";
const tokens = (title: string) => new Set(title.replace(/[\u064b-\u065f\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 2 && !["تعلن", "تصدر", "صدور", "عدد"].includes(word)));
function similar(a: string, b: string) {
  const left = tokens(a), right = tokens(b);
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / Math.max(1, Math.min(left.size, right.size)) >= 0.75;
}
export function isNajmRelevant(title: string): boolean {
  const text = title.replace(/[\u064b-\u065f\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const najm = /(?:^|\s)نجم(?:\s|$)/.test(text) && !/كرة|مباراة|نادي|لاعب|فنان/.test(text);
  const motor = /تامين (?:على )?(?:المركبات|السيارات)|تامين ضد الغير|التامين الالزامي.*(?:مركبات|سيارات)|(?:مركبات|سيارات).*التامين|السلامة المرورية|السلامة على الطرق|سلامة الطرق|سلامة المرور|الحوادث المرورية|الحوادث المرو?رية|تقرير (?:الحادث|الحوادث)|مباشرة الحوادث|الابلاغ عن الحوادث/.test(text);
  if (najm || motor) return true;
  if (/صندوق|صناديق|مستشار.*استثمار|مشورة.*اوراق مالية|ترخيص.*استثمار|ممارسة.*(?:الترتيب|المشورة)/.test(text)) return false;
  const claims = /مطالبات|تعويضات|تسوية الحوادث/.test(text) && /تامين|مركبات|حوادث|سيارات/.test(text);
  const regulation = /هيئة التامين|نظام التامين|لائحة.*التامين|تنظيم.*التامين/.test(text) && /قرار|لائحة|ترخيص|تراخيص|اعتماد|قواعد|ضوابط|نظام|تعديل|الزام|رقابة|مخالفة|حماية|اندماج|استحواذ/.test(text);
  const insurer = /شركة.*(?:للتامين|تامين)|شركات التامين|قطاع التامين|التعاونية|ميدغلف|بوبا العربية|تكافل الراجحي|الاعادة السعودية|اتحاد الخليج الاهلية|جي اي جي|جزيرة تكافل|الدرع العربي|ملاذ للتامين|اسيج|سايكو|(?:الوطنية|الاتحاد|سلامة|ولاء|الصقر|امانة|عناية|متكاملة|ليفا|تشب).*للتامين/.test(text);
  const development = /ارباح|خسائر|نتائج|صافي الدخل|اقساط|اندماج|استحواذ|رأس مال|راس مال|ملاءة|تصنيف ائتماني|عقد|اتفاقية|مطالبات|تعويضات|ايقاف|تعليق|الغاء|ترخيص|تراخيص/.test(text);
  return claims || regulation || (insurer && development);
}
export function buildBrief(articles: Article[], now = Date.now()): Brief {
  const eligible = dedupe(articles.filter((article) => {
    const date = Date.parse(article.publishedAt ?? "");
    return Number.isFinite(date) && date <= now && now - date <= 30 * 86400000 && /[\u0600-\u06ff]/.test(article.title) && safeUrl(article.url) && isNajmRelevant(article.title);
  }));
  const score = (a: Article) => {
    const ageDays = (now - Date.parse(a.publishedAt!)) / 86400000;
    return ({ najm: 10, sector: 8, reg: 7, econ: 4, global: 2 }[a.category]) + (a.kind === "announcement" ? 2 : 0) - ageDays;
  };
  eligible.sort((a, b) => score(b) - score(a) || b.publishedAt!.localeCompare(a.publishedAt!) || a.id.localeCompare(b.id));
  const selected: Article[] = [];
  for (const sourceLimit of [2, 5]) {
    for (const article of eligible) {
      if (selected.length === 5) break;
      if (selected.filter((old) => old.sourceId === article.sourceId).length >= sourceLimit) continue;
      if (selected.some((old) => old.id === article.id || similar(old.title, article.title))) continue;
      selected.push(article);
    }
  }
  return {
    status: selected.length ? "ready" : "insufficient",
    generatedAt: selected.length ? new Date(now).toISOString() : null,
    items: selected.map((a) => ({ articleId: a.id, fact: a.title, evidence: a.title, url: a.url, source: a.source, publishedAt: a.publishedAt })),
    ...(selected.length === 0 ? { message: "لا توجد أخبار عربية موثقة خلال آخر ٣٠ يومًا عن نجم أو ذات صلة مباشرة بأعمالها. لا نستبدلها بأخبار مالية غير مرتبطة." } : selected.length < 3 ? { message: "الأخبار الحديثة ذات الصلة بنجم وأعمالها أقل من ثلاثة عناوين؛ لا نضيف أخبارًا غير مرتبطة لإكمال العدد." } : {}),
  };
}
