"use client";

import { useRef, useState } from "react";
import { Ticket } from "lucide-react";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketList } from "@/features/betting/market-list";
import { PredictionTicket } from "@/features/betting/prediction-ticket";
import type { Selection } from "@/features/betting/types";
import { cn } from "@/lib/utils";

export function Predictions({ className }: { className?: string }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectionTrigger = useRef<HTMLElement | null>(null);
  const { username, openLogin, predictions, clearPredictions } = useDemoSession();

  return (
    <div className={cn("mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", className)}>
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
      <section className="min-w-0 xl:sticky xl:top-[calc(var(--header-height)+1rem)]" aria-labelledby="predictions-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="predictions-title" className="text-lg font-semibold">Minhas apostas</h2>
          {process.env.NODE_ENV === "development" && (
            <Button
              variant="link"
              size="sm"
              className="min-h-0 p-0 text-sm font-normal text-brand"
              disabled={predictions.length === 0}
              onClick={clearPredictions}
            >
              Limpar apostas
            </Button>
          )}
        </div>
        <Card className="p-4 sm:p-4">
          {predictions.length === 0 ? (
            <div className="grid justify-items-center gap-3 py-8 text-center">
              <Ticket className="size-6 text-muted" aria-hidden="true" />
              <p className="text-sm font-medium">Você ainda não fez nenhuma aposta.</p>
              <p className="max-w-56 text-xs leading-relaxed text-muted">Escolha um resultado e registre seu palpite com Croins.</p>
            </div>
          ) : (
            <>
            <div className="mb-1 flex items-center justify-between gap-3 border-b border-border pb-4 text-xs text-muted">
              <span>{predictions.length} {predictions.length === 1 ? "palpite registrado" : "palpites registrados"}</span>
              <span className="tabular-nums">{formatBalance.format(predictions.reduce((total, prediction) => total + prediction.stake, 0))} Croins apostados</span>
            </div>
            <ul aria-live="polite" className="divide-y divide-border">
              {predictions.map(({ market, outcome, stake }, index) => (
                <li key={predictions.length - index} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{market}</p>
                    <p className="mt-2 inline-flex rounded-md bg-control-hover px-2 py-1 text-xs">{outcome}</p>
                  </div>
                  <span className="shrink-0 text-muted tabular-nums">{formatBalance.format(stake)} {stake === 1 ? "Croin" : "Croins"}</span>
                </li>
              ))}
            </ul>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
