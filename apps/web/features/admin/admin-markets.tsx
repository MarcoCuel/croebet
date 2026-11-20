"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { catalogMarketStatuses as marketStatuses, type CatalogMarket } from "@croebet/shared";
type MarketStatus = CatalogMarket["status"];

export function AdminMarkets({ markets: items }: { markets: CatalogMarket[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MarketStatus | "all">("all");
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const markets = items.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      normalize(m.question).includes(normalize(search.trim())),
  );
  return (
    <div className="grid min-w-0 gap-4">
      <h1 className="sr-only">Apostas</h1>
      <AdminListHeader
        filterLabel="Status das apostas"
        search={
          <SearchInput
            aria-label="Buscar apostas no admin"
            placeholder="Buscar apostas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={<>
          <Button
            size="sm"
            variant={status === "all" ? "secondary" : "ghost"}
            aria-pressed={status === "all"}
            onClick={() => setStatus("all")}
          >
            Todas {status === "all" && <AdminFilterCount count={items.length} />}
          </Button>
          {Object.entries(marketStatuses).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? "secondary" : "ghost"}
              aria-pressed={status === value}
              onClick={() => setStatus(value as MarketStatus)}
            >
              {label} {status === value && <AdminFilterCount count={items.filter(market => market.status === value).length} />}
            </Button>
          ))}
        </>}
      />
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {markets.map((market) => {
            return (
              <li key={market.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-lg bg-contrast/6 px-2 py-1">
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
      {markets.length === 0 && (
        <Card className="p-0 sm:p-0"><EmptyState title="Nenhuma aposta encontrada." /></Card>
      )}
    </div>
  );
}
