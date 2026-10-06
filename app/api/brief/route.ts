import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readCache, writeCache } from "@/lib/db";
import { getDashboard } from "@/lib/news-service";
import { buildBrief, isNajmRelevant } from "@/lib/brief";
import type { Brief } from "@/lib/types";
export const dynamic = "force-dynamic";
const key = "deterministic-brief:najm-v2";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  let previous: { revision: string; brief: Brief } | undefined;
  try {
    previous = (await readCache(key))?.payload as typeof previous;
    const dashboard = await getDashboard();
    const brief = buildBrief(dashboard.articles);
    const revision = createHash("sha256").update(JSON.stringify(brief.items)).digest("hex");
    const response = previous?.revision === revision ? previous.brief : brief;
    if (brief.items.length && previous?.revision !== revision) await writeCache(key, { revision, brief });
    return NextResponse.json({ ...response, stale: dashboard.stale }, { headers });
  } catch {
    const items = previous?.brief?.items.filter((item) => {
      const publishedAt = Date.parse(item.publishedAt ?? "");
      return isNajmRelevant(item.fact) && Number.isFinite(publishedAt) && publishedAt <= Date.now() && Date.now() - publishedAt <= 30 * 86400000;
    }) ?? [];
    if (items.length) return NextResponse.json({ ...previous!.brief, items, stale: true, message: "تعذّر التحديث؛ نعرض فقط الأخبار الحديثة ذات الصلة من آخر موجز ناجح." }, { headers });
    return NextResponse.json({ status: "unavailable", items: [], generatedAt: null }, { status: 503, headers });
  }
}
