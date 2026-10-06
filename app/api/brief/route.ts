import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readCache, writeCache } from "@/lib/db";
import { getDashboard } from "@/lib/news-service";
import { buildBrief } from "@/lib/brief";
import type { Brief } from "@/lib/types";
export const dynamic = "force-dynamic";
const key = "deterministic-brief:v1";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  let previous: { revision: string; brief: Brief } | undefined;
  try {
    previous = (await readCache(key))?.payload as typeof previous;
    const dashboard = await getDashboard();
    const brief = buildBrief(dashboard.articles);
    if (!brief.items.length && previous?.brief?.items.length) {
      return NextResponse.json({ ...previous.brief, stale: true, message: "نعرض آخر موجز ناجح بتاريخ إعداده؛ لا تتوفر مادة حديثة كافية الآن." }, { headers });
    }
    const revision = createHash("sha256").update(JSON.stringify(brief.items)).digest("hex");
    const response = previous?.revision === revision ? previous.brief : brief;
    if (brief.items.length && previous?.revision !== revision) await writeCache(key, { revision, brief });
    return NextResponse.json({ ...response, stale: dashboard.stale }, { headers });
  } catch {
    if (previous?.brief?.items.length) return NextResponse.json({ ...previous.brief, stale: true, message: "تعذّر التحديث؛ نعرض آخر موجز ناجح ووقت إعداده الأصلي." }, { headers });
    return NextResponse.json({ status: "unavailable", items: [], generatedAt: null }, { status: 503, headers });
  }
}
