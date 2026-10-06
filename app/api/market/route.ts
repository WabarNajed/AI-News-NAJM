import { after, NextResponse } from "next/server";
import { getMarketData, refreshMarket } from "@/lib/market-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  try {
    await refreshMarket(true);
    return NextResponse.json(await getMarketData(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذّر التحديث؛ نحتفظ بآخر بيانات ناجحة." }, { status: 503 });
  }
}
export async function GET() {
  try {
    const data = await getMarketData();
    if (data.refreshDue) after(async () => { await refreshMarket(); });
    return NextResponse.json({ ...data, refreshing: data.refreshing || data.refreshDue }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة ذاكرة البيانات المشتركة؛ تبقى آخر بيانات الصفحة معروضة." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
