"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSiteConfig } from "@/features/admin/site-config";
import { buildOverview } from "@/features/admin/overview-data";
import { readAdminWallets } from "@/features/betting/betting-storage";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const shortDay = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

export function AdminOverview() {
  const { config, revision } = useSiteConfig();
  const [days, setDays] = useState(7);
  const snapshot = useMemo(() => {
    void revision;
    try {
      return { data: buildOverview(readAdminWallets(), config.markets, days, new Date()), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "Não foi possível carregar a visão geral." };
    }
  }, [config.markets, days, revision]);
  if (!snapshot.data) return <Card role="alert">{snapshot.error}</Card>;
  const data = snapshot.data;
  const maximum = Math.max(1, ...data.buckets.map((entry) => entry.count));
  return (
    <div className="grid min-w-0 gap-5">
      <h1 className="sr-only">Visão geral</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{days === 1 ? "Atividade de hoje" : `Atividade dos últimos ${days} dias`}</p>
        <div role="group" aria-label="Período da visão geral" className="flex gap-1">
          {([ [1, "Hoje"], [7, "7 dias"], [30, "30 dias"] ] as const).map(([value, label]) => (
            <Button key={value} size="sm" variant={days === value ? "secondary" : "ghost"} aria-pressed={days === value} onClick={() => setDays(value)}>{label}</Button>
          ))}
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          ["Participantes ativos", data.active, "Com movimentação ou palpite no período"],
          ["Palpites registrados", data.predictionCount, "Nas apostas da comunidade"],
          ["Croins apostados", data.volume, "Volume dos palpites no período"],
          ["Saldo dos usuários", data.balance, "Saldo atual, independente do período"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="min-w-0 p-5 sm:p-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight">{formatBalance.format(Number(value))}</dd>
            <dd className="mt-2 text-xs leading-relaxed text-muted">{detail}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold">Atividade das apostas</h2><p className="mt-1 text-xs text-muted">Palpites por dia</p></div>
            <span className="text-sm font-semibold tabular-nums">{formatBalance.format(data.predictionCount)} <span className="font-normal text-muted">palpites</span></span>
          </div>
          {data.predictionCount > 0 ? (
            <>
              <div role="img" aria-label={data.buckets.map((entry) => `${shortDay(entry.day)}: ${entry.count} palpites, ${formatBalance.format(entry.total)} Croins`).join("; ")} className="mt-6 flex h-44 items-end gap-1 border-b border-contrast/6 pb-2 sm:gap-2">
                {data.buckets.map((entry) => <div key={entry.day} className="flex h-full min-w-0 flex-1 items-end" title={`${shortDay(entry.day)} · ${entry.count} palpites · ${formatBalance.format(entry.total)} Croins`}><div className={cn("w-full rounded-t-sm", entry.count ? "bg-brand" : "bg-contrast/6")} style={{ height: entry.count ? `${(entry.count / maximum) * 100}%` : "0.25rem" }} /></div>)}
              </div>
              <div aria-hidden="true" className="mt-2 flex justify-between text-xs text-muted"><span>{shortDay(data.buckets[0].day)}</span>{days > 1 && <span>{shortDay(data.buckets.at(-1)!.day)}</span>}</div>
            </>
          ) : <div className="flex min-h-52 items-center justify-center text-center text-sm text-muted">Nenhum palpite registrado neste período.</div>}
        </Card>
        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Precisam de atenção</h2><Badge variant={data.pending.length ? "default" : "secondary"}>{data.pending.length}</Badge></div>
          {data.pending.length ? (
            <ul className="mt-4 max-h-64 divide-y divide-contrast/6 overflow-y-auto" data-lenis-prevent>
              {data.pending.map(({ market, label }) => <li key={market.id}><Link href={`/admin/apostas/${market.id}`} className="flex items-center gap-3 rounded-lg py-4 transition-colors hover:text-brand motion-reduce:transition-none"><Clock3 className="size-4 shrink-0 text-muted" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{market.question}</p><p className="mt-1 text-xs text-muted">{label}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link></li>)}
            </ul>
          ) : <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center"><Check className="size-5 text-prediction-yes" aria-hidden="true" /><p className="text-sm text-muted">Nenhuma pendência nas apostas.</p></div>}
        </Card>
      </div>
      <div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Apostas mais movimentadas</h2><Button variant="link" size="sm" asChild className="px-0"><Link href="/admin/apostas">Ver apostas<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></div>
          <ul className="mt-3 divide-y divide-contrast/6">
            {data.topMarkets.map(({ market, count, total, participants }) => <li key={market.id}><Link href={`/admin/apostas/${market.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-brand"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{market.question}</p><p className="mt-1 text-xs text-muted">{count} {count === 1 ? "palpite" : "palpites"} · {participants} {participants === 1 ? "participante" : "participantes"}</p></div><p className="text-sm font-semibold tabular-nums">{formatBalance.format(total)} <span className="text-xs font-normal text-muted">Croins</span></p></Link></li>)}
          </ul>
          {!data.topMarkets.length && <p className="py-8 text-sm text-muted">Nenhuma aposta movimentada neste período.</p>}
        </Card>
        <Card className="min-w-0">
          <h2 className="font-semibold">Circulação de Croins</h2>
          <dl className="mt-4 divide-y divide-contrast/6 text-sm">
            {[["Bônus diários distribuídos", data.bonus], ["Ajustes manuais (saldo líquido)", data.adjustments], ["Volume nas apostas", data.volume]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="text-muted">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{formatBalance.format(Number(value))}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted">O volume das apostas circula entre os participantes e não representa ganho da casa.</p>
        </Card>
      </div>
      <Card className="min-w-0">
        <h2 className="font-semibold">Últimas movimentações</h2>
        <ul className="mt-4 divide-y divide-contrast/6">
          {data.transactions.slice(0, 8).map((entry) => <li key={`${entry.username}:${entry.id}`} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{entry.description}</p><p className="mt-1 text-xs text-muted">@{entry.username} · {dateFormat.format(new Date(entry.createdAt))}</p></div><p className={cn("shrink-0 text-sm font-semibold tabular-nums", entry.amount > 0 ? "text-prediction-yes" : "text-prediction-no")}>{entry.amount > 0 ? "+" : ""}{formatBalance.format(entry.amount)} <span className="hidden text-xs font-normal sm:inline">Croins</span></p></li>)}
        </ul>
        {!data.transactions.length && <p className="py-8 text-sm text-muted">Nenhuma movimentação registrada neste período.</p>}
      </Card>
      <p className="text-xs leading-relaxed text-muted">Registros disponíveis neste navegador. Partidas, novos cadastros e resultado da casa ainda não possuem histórico consolidado.</p>
    </div>
  );
}
