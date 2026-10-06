"use client";
import useSWR from "swr";
import type { MarketData } from "@/lib/types";
export function useMarketData() {
  return useSWR<MarketData>("/api/market", async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("تعذّر تحديث بيانات السوق");
    return response.json();
  }, {
    refreshInterval: (data) => data?.refreshing ? 3000 : 60000,
    revalidateOnFocus: false, keepPreviousData: true, dedupingInterval: 2000,
  });
}
