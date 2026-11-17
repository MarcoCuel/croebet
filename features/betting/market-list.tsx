"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { markets } from "@/features/betting/markets";
import type { Selection } from "@/features/betting/types";

export function MarketList({
  onSelect,
}: {
  onSelect: (selection: Selection) => void;
}) {
  const [minutes, setMinutes] = useState("");
  const value = Number(minutes);
  const validMinutes =
    minutes.trim() !== "" && Number.isSafeInteger(value) && value >= 0;

  return (
    <section
      className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Apostas abertas"
    >
      {markets.map((market) => (
        <Card
          asChild
          className="flex scroll-mt-[calc(var(--header-height)+1rem)] flex-col"
          key={market.id}
        >
          <article id={market.id}>
            <p className="text-xs text-muted">{market.topic}</p>
            <h2 className="mt-2 mb-6 text-lg font-semibold">{market.question}</h2>
            {market.type === "number" ? (
              <form
                className="mt-auto grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (validMinutes) {
                    onSelect({
                      market: market.question,
                      outcome: `${value} ${market.unit}`,
                    });
                  }
                }}
              >
                <Field>
                  Atraso em minutos
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    max={Number.MAX_SAFE_INTEGER}
                    placeholder="0"
                    required
                    value={minutes}
                    onChange={(event) => setMinutes(event.currentTarget.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="secondary"
                  aria-haspopup="dialog"
                  disabled={!validMinutes}
                >
                  Apostar
                </Button>
              </form>
            ) : (
              <div className="mt-auto grid grid-cols-2 gap-2">
                {market.options.map((outcome) => (
                  <Button
                    key={outcome}
                    variant="secondary"
                    className="font-normal"
                    aria-haspopup="dialog"
                    onClick={() => onSelect({ market: market.question, outcome })}
                  >
                    {outcome}
                  </Button>
                ))}
              </div>
            )}
          </article>
        </Card>
      ))}
    </section>
  );
}
