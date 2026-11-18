"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { useDemoSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Balance } from "@/features/wallet/balance";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const filters = [
  { value: "all", label: "Tudo" },
  { value: "income", label: "Entradas" },
  { value: "expense", label: "Saídas" },
] as const;

export function WalletHistory({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { username, balance, transactions, openLogin } = useDemoSession();
  const [filter, setFilter] =
    useState<(typeof filters)[number]["value"]>("all");

  if (!username)
    return (
      <Card
        className={cn(
          "mt-6 flex flex-col items-center gap-4 py-12 text-center",
          className,
        )}
      >
        <p className="text-muted">
          Entre na sua conta para consultar seu histórico.
        </p>
        <Button onClick={openLogin}>Entrar</Button>
      </Card>
    );

  const income = transactions.reduce(
    (sum, entry) => sum + Math.max(0, entry.amount),
    0,
  );
  const expense = transactions.reduce(
    (sum, entry) => sum + Math.max(0, -entry.amount),
    0,
  );
  const entries = transactions.filter(
    (entry) =>
      filter === "all" ||
      (filter === "income" ? entry.amount > 0 : entry.amount < 0),
  );

  return (
    <div className={cn("mt-6 grid gap-6", className)}>
      <div
        className={cn(
          "grid gap-3",
          compact ? "lg:grid-cols-3" : "sm:grid-cols-3",
        )}
      >
        <Card className={cn("grid gap-3", compact && "bg-control-hover")}>
          <h2 className="text-sm text-muted">Saldo atual</h2>
          <div className="text-2xl font-semibold">
            <Balance value={balance} />
          </div>
        </Card>
        <Card className={cn("grid gap-3", compact && "bg-control-hover")}>
          <h2 className="text-sm text-muted">Entradas</h2>
          <p className="text-2xl font-semibold tabular-nums text-accent">
            +{formatBalance.format(income)}{" "}
            <span className="text-xs font-normal text-muted">Croins</span>
          </p>
        </Card>
        <Card className={cn("grid gap-3", compact && "bg-control-hover")}>
          <h2 className="text-sm text-muted">Saídas</h2>
          <p className="text-2xl font-semibold tabular-nums">
            −{formatBalance.format(expense)}{" "}
            <span className="text-xs font-normal text-muted">Croins</span>
          </p>
        </Card>
      </div>
      <section aria-labelledby="transactions-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex gap-1"
            role="group"
            aria-label="Filtrar movimentações"
          >
            {filters.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "ghost"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <Card
          className={cn(
            "overflow-hidden p-0 sm:p-0",
            compact && "bg-control-hover",
          )}
        >
          {entries.length ? (
            <ul className="divide-y divide-border">
              {entries.map((entry) => {
                const incoming = entry.amount > 0;
                const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 p-4 sm:gap-4 sm:px-6"
                  >
                    <span
                      className={cn(
                        "hidden size-10 shrink-0 place-items-center rounded-panel bg-control sm:grid",
                        compact && "bg-surface",
                      )}
                    >
                      <Icon
                        className={cn("size-4", incoming && "text-accent")}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        {entry.description}
                      </p>
                      <time
                        dateTime={entry.createdAt}
                        className="mt-1 block text-xs text-muted"
                      >
                        {dateFormat.format(new Date(entry.createdAt))}
                      </time>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          incoming && "text-accent",
                        )}
                      >
                        <span className="sr-only">
                          {incoming ? "Entrada de " : "Saída de "}
                        </span>
                        {incoming ? "+" : "−"}
                        {formatBalance.format(Math.abs(entry.amount))}{" "}
                        <span className="text-xs font-normal">Croins</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Saldo: {formatBalance.format(entry.balance)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-3 px-5 py-12 text-center text-muted">
              <History className="size-6" aria-hidden="true" />
              <p className="text-sm">
                {filter === "all"
                  ? "Nenhuma movimentação registrada ainda."
                  : "Nenhuma movimentação neste filtro."}
              </p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
