"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Gift, History, RotateCcw, Ticket, Trophy } from "lucide-react";
import { transactionsSchema } from "@croebet/shared";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";
import type { getWalletHistory } from "@/features/wallet/server-wallet";

type WalletData = Awaited<ReturnType<typeof getWalletHistory>>;
const zone = "America/Sao_Paulo";
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: zone });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: zone });
const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: zone });
function dateLabel(value: string, now: string) {
  const date = new Date(value);
  const today = new Date(now);
  const yesterday = new Date(today.getTime() - 86400000);
  const day = dayKey.format(date);
  const label = day === dayKey.format(today) ? "Hoje" : day === dayKey.format(yesterday) ? "Ontem" : shortDate.format(date);
  const year = day.slice(0, 4) !== dayKey.format(today).slice(0, 4) ? ` ${day.slice(0, 4)}` : "";
  return `${label}${year}, ${time.format(date)}`;
}
function originIcon(description: string, amount: number) {
  if (/cupom/i.test(description)) return Ticket;
  if (/bônus|cadastro|diário|resgate/i.test(description)) return Gift;
  if (/devol|reembols/i.test(description)) return RotateCcw;
  if (/vitória|prêmio/i.test(description)) return Trophy;
  return amount > 0 ? ArrowDownLeft : ArrowUpRight;
}
const filters = [
  { value: "all", label: "Todos" },
  { value: "income", label: "Entradas" },
  { value: "expense", label: "Saídas" },
] as const;

export function WalletHistory({ initial, direction, now }: {
  initial: WalletData; direction: "all" | "income" | "expense"; now: string;
}) {
  const { username, sessionReady, openLogin, balance, walletReady } = useSession();
  const [owner] = useState(username);
  const router = useRouter();
  const [history, setHistory] = useState(initial.status === "ready" ? initial.history : { items: [], hasMore: false });
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  async function loadMore() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/me/transactions?limit=20&offset=${history.items.length}&direction=${direction}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(response.status === 401 ? "Entre novamente para consultar sua carteira." : "Não foi possível carregar as movimentações.");
      const next = transactionsSchema.parse(await response.json());
      setHistory(current => ({ items: [...current.items, ...next.items], hasMore: next.hasMore }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as movimentações.");
    } finally { pending.current = false; setLoading(false); }
  }

  if (initial.status === "signed-out" || (sessionReady && !username)) return (
    <Card className="grid justify-items-center gap-4 py-12 text-center">
      <p className="text-muted">Entre na sua conta para consultar sua carteira.</p>
      <Button onClick={openLogin}>Entrar</Button>
    </Card>
  );
  if (initial.status === "unavailable") return (
    <Card className="grid justify-items-center gap-4 py-12 text-center">
      <p role="alert">Não foi possível carregar sua carteira.</p>
      <Button variant="secondary" onClick={() => router.refresh()}>Tentar novamente</Button>
    </Card>
  );

  if (owner !== username) return <p role="status" className="text-sm text-muted">Atualizando carteira…</p>;

  return (
    <div className="grid gap-8">
      <Card className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Saldo disponível</p>
          <div className="md:hidden"><RedeemButton /></div>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-3xl font-semibold tabular-nums sm:text-4xl">
          <Balance key={username} value={walletReady ? balance : initial.balance} /> <span aria-hidden="true" className="text-lg font-normal text-muted">Croins</span>
        </p>
      </Card>
      <section aria-labelledby="transactions-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="transactions-title" className="text-lg font-semibold">Histórico de transações</h2>
          <nav aria-label="Filtrar movimentações" className="flex gap-1">
            {filters.map(({ value, label }) => (
              <Button key={value} asChild size="sm" variant={direction === value ? "secondary" : "ghost"}>
                <Link href={value === "all" ? "/carteira" : `/carteira?direction=${value}`} scroll={false} aria-current={direction === value ? "page" : undefined}>{label}</Link>
              </Button>
            ))}
          </nav>
        </div>
        <Card className="overflow-hidden p-0 sm:p-0">
          {history.items.length ? (
            <ul className="divide-y divide-contrast/6">
              {history.items.map(entry => {
                const incoming = entry.amount > 0;
                const Icon = originIcon(entry.description, entry.amount);
                const amount = `${incoming ? "+" : "−"}${formatBalance.format(Math.abs(entry.amount))} Croins`;
                return (
                  <li key={entry.id}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-3 rounded-none px-4 py-4 text-left font-normal text-foreground sm:gap-4 sm:px-6">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-contrast/6"><Icon className="size-4" aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">{entry.description}</span>
                            <time dateTime={entry.createdAt} className="mt-1 block text-xs text-muted">{dateLabel(entry.createdAt, now)}</time>
                          </span>
                          <span className={cn("shrink-0 text-xs font-semibold tabular-nums sm:text-sm", incoming && "text-brand")}>{amount}</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent aria-describedby={undefined}>
                        <DialogTitle>{entry.description}</DialogTitle>
                        <p className={cn("mt-6 text-2xl font-semibold tabular-nums", incoming && "text-brand")}>{amount}</p>
                        <dl className="mt-6 grid gap-4 text-sm">
                          <div className="flex justify-between gap-4"><dt className="text-muted">Saldo após a operação</dt><dd className="text-right tabular-nums">{formatBalance.format(entry.balance)} Croins</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-muted">Data</dt><dd className="text-right"><time dateTime={entry.createdAt}>{fullDate.format(new Date(entry.createdAt))}</time></dd></div>
                          {entry.reference && <div className="grid gap-1"><dt className="text-muted">Referência</dt><dd className="break-words">{entry.reference}</dd></div>}
                        </dl>
                      </DialogContent>
                    </Dialog>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title={direction === "all" ? "Nenhuma movimentação registrada ainda." : "Nenhuma movimentação neste filtro."} icon={<History className="size-6" />} />
          )}
        </Card>
        {history.hasMore && <div className="mt-4 flex justify-center"><Button variant="secondary" loading={loading} onClick={loadMore}>Carregar mais</Button></div>}
      </section>
    </div>
  );
}
