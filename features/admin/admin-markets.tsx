"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { useSiteConfig } from "@/features/admin/site-config";
import { marketStatuses, type MarketStatus } from "@/features/betting/markets";
import { useMarketActivities } from "@/features/admin/market-activity";
import { formatBalance } from "@/features/wallet/wallet";

export function AdminMarkets() {
  const { config } = useSiteConfig();
  const { activities, error } = useMarketActivities(config.markets);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MarketStatus | "all">("all");
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const markets = config.markets.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      normalize(m.question).includes(normalize(search.trim())),
  );
  return (
    <>
      <h1 className="sr-only">Apostas</h1>
      <SearchInput
        aria-label="Buscar apostas no admin"
        placeholder="Buscar apostas"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div
        className="my-4 flex flex-wrap gap-1"
        role="group"
        aria-label="Status das apostas"
      >
        <Button
          size="sm"
          variant={status === "all" ? "secondary" : "ghost"}
          aria-pressed={status === "all"}
          onClick={() => setStatus("all")}
        >
          Todas
        </Button>
        {Object.entries(marketStatuses).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "secondary" : "ghost"}
            aria-pressed={status === value}
            onClick={() => setStatus(value as MarketStatus)}
          >
            {label}
          </Button>
        ))}
      </div>
      {error ? (
        <Card role="alert">{error}</Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {markets.map((market) => {
            const stats = activities.get(market.id);
            return (
              <li key={market.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-lg bg-control px-2 py-1">
                      {marketStatuses[market.status]}
                    </span>
                    {market.endsAt && (
                      <span>
                        {new Date(market.endsAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold">{market.question}</h2>
                  <dl className="mt-auto grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Croins apostados</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {formatBalance.format(stats?.total ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Participantes</dt>
                      <dd className="mt-1 font-semibold">
                        {stats?.participants ?? 0}
                      </dd>
                    </div>
                  </dl>
                  {!!stats?.legacyCount && (
                    <p className="text-xs text-muted">
                      {stats.legacyCount} registros antigos fora do total
                    </p>
                  )}
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="self-start"
                  >
                    <Link
                      href={`/admin/apostas/${market.id}`}
                      aria-label={`Gerenciar ${market.question}`}
                    >
                      Gerenciar
                    </Link>
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {!error && markets.length === 0 && (
        <Card className="text-sm text-muted">Nenhuma aposta encontrada.</Card>
      )}
    </>
  );
}
