import { NextResponse } from "next/server";
import {
  getDashboard,
  refreshNews,
  unavailableDashboard,
} from "@/lib/news-service";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await refreshNews();
    return NextResponse.json(await getDashboard(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(unavailableDashboard(), { status: 503 });
  }
}
