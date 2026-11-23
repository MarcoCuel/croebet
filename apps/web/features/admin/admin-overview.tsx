import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AdminOverviewData } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const shortDay = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

export function AdminOverview({ data }: { data: AdminOverviewData }) {
  const maximum = Math.max(1, ...data.buckets.map(entry => entry.movements));
  return (
    <div className="grid min-w-0 gap-5">
      <h1 className="sr-only">Visão geral</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{data.days === 1 ? "Atividade de hoje" : `Atividade dos últimos ${data.days} dias`}</p>
        <nav aria-label="Período da visão geral" className="flex gap-1">
          {([[1, "Hoje"], [7, "7 dias"], [30, "30 dias"]] as const).map(([days, label]) => (
            <Button key={days} size="sm" variant={data.days === days ? "secondary" : "ghost"} asChild>
              <Link href={`/admin?days=${days}`} aria-current={data.days === days ? "page" : undefined} scroll={false}>{label}</Link>
            </Button>
          ))}
        </nav>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          ["Usuários cadastrados", data.totals.users, "Total atual de contas"],
          ["Participantes ativos", data.totals.activeUsers, "Com movimentação no período"],
          ["Movimentações", data.totals.movements, "Entradas e saídas no período"],
          ["Saldo dos usuários", data.totals.balance, "Saldo atual, independente do período"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="min-w-0 p-5 sm:p-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight">{formatBalance.format(Number(value))}</dd>
            <dd className="mt-2 text-xs leading-relaxed text-muted">{detail}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold">Atividade das carteiras</h2><p className="mt-1 text-xs text-muted">Movimentações por dia</p></div>
            <span className="text-sm font-semibold tabular-nums">{formatBalance.format(data.totals.movements)} <span className="font-normal text-muted">movimentações</span></span>
          </div>
          {data.totals.movements > 0 ? <>
            <div role="img" aria-label={data.buckets.map(entry => `${shortDay(entry.day)}: ${entry.movements} movimentações, ${formatBalance.format(entry.credits)} Croins recebidos e ${formatBalance.format(entry.debits)} retirados`).join("; ")} className="mt-6 flex h-44 items-end gap-1 border-b border-contrast/6 pb-2 sm:gap-2">
              {data.buckets.map(entry => <div key={entry.day} className="flex h-full min-w-0 flex-1 items-end" title={`${shortDay(entry.day)} · ${entry.movements} movimentações`}><div className={cn("w-full rounded-t-sm", entry.movements ? "bg-brand" : "bg-contrast/6")} style={{ height: entry.movements ? `${entry.movements / maximum * 100}%` : "0.25rem" }} /></div>)}
            </div>
            <div aria-hidden="true" className="mt-2 flex justify-between text-xs text-muted"><span>{shortDay(data.buckets[0].day)}</span>{data.days > 1 && <span>{shortDay(data.buckets.at(-1)!.day)}</span>}</div>
          </> : <div className="flex min-h-52 items-center justify-center text-center text-sm text-muted">Nenhuma movimentação registrada neste período.</div>}
        </Card>
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Resgates no período</h2><Button variant="link" size="sm" asChild className="px-0"><Link href="/admin/cupons">Ver cupons<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></div>
          <dl className="mt-4 divide-y divide-contrast/6 text-sm">
            {[["Resgates diários", data.rewards.dailyClaims], ["Cupons resgatados", data.rewards.couponRedemptions]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-4"><dt className="text-muted">{label}</dt><dd className="font-semibold tabular-nums">{formatBalance.format(Number(value))}</dd></div>)}
          </dl>
        </Card>
      </div>
      <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Cadastros recentes</h2><Button variant="link" size="sm" asChild className="px-0"><Link href="/admin/usuarios">Ver usuários<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></div>
          <ul className="mt-3 divide-y divide-contrast/6">
            {data.recentUsers.map(user => <li key={user.id}><Link href={`/admin/usuarios/${user.id}`} className="flex items-center justify-between gap-4 py-4 hover:text-brand"><div className="min-w-0"><p className="break-words text-sm font-medium">@{user.username}</p><p className="mt-1 text-xs text-muted">{dateFormat.format(new Date(user.createdAt))}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link></li>)}
          </ul>
          {!data.recentUsers.length && <p className="py-8 text-sm text-muted">Nenhum cadastro neste período.</p>}
        </Card>
        <Card className="min-w-0">
          <h2 className="font-semibold">Circulação de Croins</h2>
          <dl className="mt-4 divide-y divide-contrast/6 text-sm">
            {[["Bônus de cadastro", data.circulation.registration], ["Bônus diários distribuídos", data.circulation.daily], ["Cupons distribuídos", data.circulation.coupons], ["Ajustes manuais (saldo líquido)", data.circulation.adjustments], ["Total de entradas", data.circulation.credits], ["Total de saídas", data.circulation.debits]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3"><dt className="text-muted">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{formatBalance.format(Number(value))}</dd></div>)}
          </dl>
        </Card>
      </div>
      <Card className="min-w-0">
        <h2 className="font-semibold">Últimas movimentações</h2>
        <ul className="mt-4 divide-y divide-contrast/6">
          {data.transactions.map(entry => <li key={entry.id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{entry.description}</p><p className="mt-1 text-xs text-muted">{entry.userId ? <Link href={`/admin/usuarios/${entry.userId}`} className="hover:text-foreground">@{entry.username}</Link> : "Conta removida"} · {dateFormat.format(new Date(entry.createdAt))}</p></div><p className={cn("shrink-0 text-sm font-semibold tabular-nums", entry.amount > 0 ? "text-prediction-yes" : "text-prediction-no")}>{entry.amount > 0 ? "+" : ""}{formatBalance.format(entry.amount)} <span className="hidden text-xs font-normal sm:inline">Croins</span></p></li>)}
        </ul>
        {!data.transactions.length && <p className="py-8 text-sm text-muted">Nenhuma movimentação registrada neste período.</p>}
      </Card>
      <p className="text-xs leading-relaxed text-muted">Atualizado em {dateFormat.format(new Date(data.generatedAt))} · Horário de Brasília</p>
    </div>
  );
}
