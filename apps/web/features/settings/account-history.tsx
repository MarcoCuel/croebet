"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Gamepad2, History, ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { accountHistorySchema, type AccountHistory } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

async function readHistory(offset: number, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/me/history?limit=20&offset=${offset}`, { cache: "no-store", credentials: "same-origin", signal });
  if (!response.ok) throw new Error(response.status === 401 ? "Entre novamente para consultar seu histórico." : "Não foi possível carregar o histórico.");
  return accountHistorySchema.parse(await response.json());
}

export function AccountHistoryPanel({ onNavigate }: { onNavigate?: () => void }) {
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void readHistory(0, controller.signal).then(setHistory).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível carregar o histórico.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  async function loadMore() {
    if (!history || pending.current) return;
    pending.current = true; setLoading(true); setError(null);
    try {
      const next = await readHistory(history.items.length);
      setHistory(current => ({ items: [...(current?.items ?? []), ...next.items], hasMore: next.hasMore }));
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível carregar o histórico."); }
    finally { pending.current = false; setLoading(false); }
  }

  return <div className="grid gap-4">
    <h2 className="text-sm font-medium">Seu histórico</h2>
    {history && (history.items.length ? <ul className="divide-y divide-contrast/6">
      {history.items.map(entry => {
        const incoming = entry.amount !== null && entry.amount > 0;
        const Icon = entry.kind === "game" ? Gamepad2 : incoming ? ArrowDownLeft : ArrowUpRight;
        const content = <>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-contrast/6"><Icon className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm">{entry.description}</p>
            <time dateTime={entry.createdAt} className="mt-1 block text-xs text-muted">{date.format(new Date(entry.createdAt))}</time>
          </div>
          {entry.amount !== null && <span className={cn("shrink-0 text-xs tabular-nums", incoming && "text-brand")}>
            {incoming ? "+" : "−"}{formatBalance.format(Math.abs(entry.amount))} Croins
          </span>}
        </>;
        return <li key={entry.id}>{entry.kind === "game" && entry.matchCode && entry.gameSlug
          ? <Link href={`/jogos/${encodeURIComponent(entry.gameSlug)}?partida=${entry.matchCode}`} prefetch={false} onClick={onNavigate} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-contrast/6 focus-visible:outline-foreground">{content}<ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" /></Link>
          : <div className="flex items-center gap-4 py-4">{content}</div>}</li>;
      })}
    </ul> : <EmptyState title="Nenhuma atividade registrada ainda." icon={<History className="size-6" />} />)}
    {loading && !history && <p role="status" className="text-sm text-muted">Carregando histórico…</p>}
    {error && <div className="grid justify-items-start gap-3">
      <p role="alert" className="text-sm text-muted">{error}</p>
      {!history && <Button variant="secondary" onClick={() => { setLoading(true); setError(null); setAttempt(value => value + 1); }}>Tentar novamente</Button>}
    </div>}
    {history?.hasMore && <Button variant="secondary" className="justify-self-center" loading={loading} disabled={loading} onClick={loadMore}>Carregar mais</Button>}
  </div>;
}
