"use client";

import Link from "next/link";
import type { Ranking } from "@croebet/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

const format = new Intl.NumberFormat("pt-BR");

function wins(value: number) {
  return <>{format.format(value)}<span className="ml-1 font-normal text-muted">{value === 1 ? "vitória" : "vitórias"}</span></>;
}

/** Compact all-time wins ranking for one catalog game. */
export function GameRanking({ gameName, data, className }: { gameName: string; data: Ranking | null; className?: string }) {
  const shown = data?.items.slice(0, 5) ?? [];
  const own = data?.own ?? null;
  const ownOutside = own && !shown.some(item => item.userId === own.userId) ? own : null;
  return <Card asChild className={cn("space-y-3 p-0", className)}>
    <section aria-labelledby="game-ranking-title" data-lenis-prevent>
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        <h2 id="game-ranking-title" className="text-lg font-semibold leading-tight">Mais vitoriosos</h2>
      </div>
      {!data ? <p className="text-sm text-muted">Ranking indisponível agora.</p> : !shown.length ? <EmptyState title="Ninguém venceu ainda" description="A primeira vitória pode ser sua." /> : <>
        <ol aria-label={`Ranking de vitórias em ${gameName}`} className="space-y-1">
          {shown.map(item => <li key={item.userId} className="flex items-center gap-3 p-2 border-t border-contrast/6 first:border-0">
            <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted tabular-nums" aria-hidden="true">{item.position}</span>
            <Avatar className="size-8 shrink-0" aria-hidden="true"><AvatarImage src={item.avatarUrl ?? undefined} /><AvatarFallback className="bg-contrast/6 text-[0.625rem]">{item.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <Link href={`/perfil/${encodeURIComponent(item.username)}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand" title={item.displayName}>{item.displayName}{item.userId === own?.userId && <span className="ml-1.5 text-xs font-normal text-brand">Você</span>}</Link>
            <span className="shrink-0 text-xs font-semibold tabular-nums">{wins(item.value)}</span>
          </li>)}
        </ol>
        {ownOutside && <p className="border-t border-contrast/6 pt-3 text-sm text-muted">Sua posição: <span className="font-semibold text-foreground">{ownOutside.position}º</span><span className="float-right text-foreground">{wins(ownOutside.value)}</span></p>}
      </>}
    </section>
  </Card>;
}
