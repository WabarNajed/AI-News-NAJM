import { after, NextResponse } from "next/server";
import { getDashboard, refreshNews, unavailableDashboard } from "@/lib/news-service";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  try {
    const data = await getDashboard();
    if (data.refreshDue) after(async () => { await refreshNews(); });
    return NextResponse.json({ ...data, refreshing: data.refreshing || data.refreshDue }, { headers });
  } catch {
    return NextResponse.json(unavailableDashboard(), { status: 503, headers });
  }
}
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  try {
    await refreshNews(true);
    return NextResponse.json(await getDashboard(), { headers });
  } catch {
    return NextResponse.json(unavailableDashboard(), { status: 503, headers });
  }
}
