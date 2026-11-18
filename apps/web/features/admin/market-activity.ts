"use client";

import { useMemo } from "react";
import { useSiteConfig } from "@/features/admin/site-config";
import {
  marketActivity,
  type MarketActivity,
} from "@/features/betting/betting-storage";
import type { Market } from "@/features/betting/markets";

export function useMarketActivities(markets: Market[]) {
  const { revision } = useSiteConfig();
  return useMemo(() => {
    void revision;
    try {
      return {
        activities: new Map(
          markets.map((market) => [market.id, marketActivity(market)]),
        ),
        error: null,
      };
    } catch (error) {
      return {
        activities: new Map<string, MarketActivity>(),
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler os participantes.",
      };
    }
  }, [markets, revision]);
}
