"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Clock3, Timer, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { acceptsPredictions } from "@/features/betting/settlement";
import { type Market } from "@/features/betting/markets";
import type { Selection } from "@/features/betting/types";
import { useSiteConfig } from "@/features/admin/site-config";
import { cn } from "@/lib/utils";

const filters = ["Todas", "Sim ou não", "Opções", "Número"] as const;
const marketIcons = { atraso: Clock3, peruca: Video, "duracao-live": Timer };

export function MarketList({
  onSelect,
}: {
  onSelect: (selection: Selection) => void;
}) {
  const { config } = useSiteConfig();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const markets = config.markets.filter((market) =>
    acceptsPredictions(market, now),
  );
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todas");
  const [details, setDetails] = useState<Market | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const visibleMarkets = markets.filter((market) => {
    const matchesType =
      filter === "Todas" ||
      (filter === "Sim ou não" && market.type === "binary") ||
      (filter === "Opções" && market.type === "choice") ||
      (filter === "Número" && market.type === "number");
    return (
      matchesType &&
      normalize(market.question).includes(normalize(search.trim()))
    );
  });

  return (
    <section className="min-w-0" aria-label="Apostas abertas">
      <div className="mb-4">
        <SearchInput
          aria-label="Buscar apostas"
          placeholder="Buscar apostas"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </div>
      <div
        className="mb-5 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar apostas"
      >
        {filters.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? "secondary" : "ghost"}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "text-sm font-medium",
              filter === item && "bg-contrast/10 text-foreground",
            )}
          >
            {item}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted" role="status">
          {visibleMarkets.length}{" "}
          {visibleMarkets.length === 1 ? "aposta" : "apostas"}
        </span>
      </div>
      <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-2">
        {visibleMarkets.map((market) => {
          const input = minutes[market.id] ?? "";
          const value = Number(input);
          const validMinutes =
            input.trim() !== "" && Number.isSafeInteger(value) && value >= 0;
          const Icon =
            marketIcons[market.id as keyof typeof marketIcons] ?? Video;
          return (
            <Card
              asChild
              className="flex min-w-0 scroll-mt-[calc(var(--header-height)+1rem)] flex-col p-4 sm:p-4"
              key={market.id}
            >
              <article id={market.id}>
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-panel bg-brand/10 text-brand">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base leading-snug font-semibold tracking-tight">
                      {market.question}
                    </h2>
                  </div>
                </div>
                {market.type === "number" ? (
                  <form
                    className="mt-auto"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (validMinutes)
                        onSelect({
                          marketId: market.id,
                          market: market.question,
                          outcome: `${value} ${market.unit}`,
                        });
                    }}
                  >
                    <div className="flex items-end gap-2">
                      <Field className="min-w-0 flex-1 text-xs">
                        {market.id === "atraso"
                          ? "Atraso em minutos"
                          : `Palpite em ${market.unit}`}
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          max={Number.MAX_SAFE_INTEGER}
                          placeholder="0"
                          required
                          value={input}
                          onChange={(event) =>
                            setMinutes({
                              ...minutes,
                              [market.id]: event.currentTarget.value,
                            })
                          }
                        />
                      </Field>
                      <Button
                        type="submit"
                        aria-haspopup="dialog"
                        disabled={!validMinutes}
                      >
                        Apostar
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div
                    className={cn(
                      "mt-auto grid gap-2",
                      market.type === "binary" && "grid-cols-2",
                    )}
                  >
                    {market.options.map((outcome) => (
                      <Button
                        key={outcome}
                        variant="secondary"
                        className={cn(
                          "justify-between px-3 font-medium",
                          market.type === "binary" &&
                            (outcome === "Sim"
                              ? "bg-prediction-yes/10 text-prediction-yes hover:bg-prediction-yes/20"
                              : "bg-prediction-no/10 text-prediction-no hover:bg-prediction-no/20"),
                        )}
                        aria-haspopup="dialog"
                        onClick={() =>
                          onSelect({
                            marketId: market.id,
                            market: market.question,
                            outcome,
                          })
                        }
                      >
                        {outcome}
                        <ChevronRight
                          className="size-4 opacity-60"
                          aria-hidden="true"
                        />
                      </Button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-contrast/6 pt-3">
                  <span className="text-xs text-muted">Croins</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-0 p-0 font-normal"
                    aria-label={`Regras: ${market.question}`}
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      detailsTrigger.current = event.currentTarget;
                      setDetails(market);
                    }}
                  >
                    Regras
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            </Card>
          );
        })}
      </div>
      {visibleMarkets.length === 0 && (
        <Card className="grid justify-items-center gap-3 py-10 text-center sm:py-10">
          <p className="font-medium">Nenhuma aposta encontrada.</p>
          <p className="text-sm text-muted">
            Tente outra busca ou escolha outro filtro.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilter("Todas");
            }}
          >
            Limpar filtros
          </Button>
        </Card>
      )}
      <Dialog
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailsTrigger.current?.focus();
          }}
        >
          <DialogTitle className="mb-5">{details?.question}</DialogTitle>
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="mb-1 font-semibold">Critério do palpite</dt>
              <dd className="leading-relaxed text-muted">
                {details?.criterion}
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-semibold">Encerramento</dt>
              <dd className="text-muted">
                {details?.endsAt
                  ? new Date(details.endsAt).toLocaleString("pt-BR")
                  : "Prazo ainda não definido."}
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-semibold">Apuração e retorno</dt>
              <dd className="leading-relaxed text-muted">
                O total apostado é dividido entre os vencedores
                proporcionalmente ao valor de cada aposta, sem taxa. Para
                números, vale o acerto exato. Sem vencedores, os valores são
                devolvidos.
              </dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </section>
  );
}
