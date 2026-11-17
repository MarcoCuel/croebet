"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markets, formatOdds } from "./markets";
import type { Selection } from "./types";

export function MarketList({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <section className="grid gap-3.5" aria-label="Palpites de demonstração">
      {markets.map(({ id, topic, question, options }) => (
        <Card
          asChild
          className="border-(length:--border-width-hairline) border-transparent p-4 target:border-accent/50 sm:p-5"
          key={id}
        >
          <article id={id}>
            <p className="text-sm text-accent">{topic}</p>
            <h2 className="mt-1 text-xl font-bold">{question}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {options.map(({ outcome, odds }) => (
                <Button
                  key={outcome}
                  variant="secondary"
                  className="flex-wrap justify-between gap-x-2 rounded-lg px-3 text-left font-normal aria-pressed:border-accent aria-pressed:bg-selected"
                  aria-pressed={
                    selection?.market === question &&
                    selection.outcome === outcome
                  }
                  onClick={() => onSelect({ market: question, outcome, odds })}
                >
                  {outcome}
                  <span className="font-semibold text-accent tabular-nums">
                    {formatOdds.format(odds / 100)}×
                  </span>
                </Button>
              ))}
            </div>
            {selection?.market === question && (
              <Button
                asChild
                variant="link"
                size="sm"
                className="mt-3 min-h-9 lg:hidden"
              >
                <a href="#bilhete">Ver bilhete</a>
              </Button>
            )}
          </article>
        </Card>
      ))}
    </section>
  );
}
