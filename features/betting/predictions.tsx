"use client";

import { useRef, useState } from "react";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { Card } from "@/components/ui/card";
import { MarketList } from "@/features/betting/market-list";
import { PredictionTicket } from "@/features/betting/prediction-ticket";
import type { Selection } from "@/features/betting/types";

export function Predictions() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const { username, openLogin, predictions } = useDemoSession();

  return (
    <div className="mt-6 grid gap-8">
      <MarketList
        onSelect={(next) => {
          if (!username) {
            openLogin();
            return;
          }
          selectionTrigger.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setSelection(next);
        }}
      />
      {selection && (
        <PredictionTicket
          selection={selection}
          onClose={() => setSelection(null)}
          onReturnFocus={() => selectionTrigger.current?.focus()}
        />
      )}
      {predictions.length > 0 && (
        <section aria-labelledby="predictions-title">
          <h2 id="predictions-title" className="mb-4 text-lg font-semibold">Minhas apostas</h2>
          <Card className="py-0 sm:py-0">
            <ul aria-live="polite" className="divide-y divide-border">
              {predictions.map(({ market, outcome, stake }, index) => (
                <li key={predictions.length - index} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{market}</p>
                    <p className="mt-1 text-muted">{outcome}</p>
                  </div>
                  <span className="shrink-0 text-muted tabular-nums">{formatBalance.format(stake)} {stake === 1 ? "Croin" : "Croins"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
