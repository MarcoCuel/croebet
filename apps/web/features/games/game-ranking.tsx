"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import type { Ranking } from "@croebet/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

const format = new Intl.NumberFormat("pt-BR");

function wins(value: number) {
  return <>{format.format(value)}<span className="ml-1 font-normal text-muted">{value === 1 ? "vitória" : "vitórias"}</span></>;
}

/** Compact all-time wins ranking for one catalog game. */
export function GameRanking({ gameName, data }: { gameName: string; data: Ranking | null }) {
  const shown = data?.items.slice(0, 5) ?? [];
  const own = data?.own ?? null;
  const ownOutside = own && !shown.some(item => item.userId === own.userId) ? own : null;
  return <Card asChild className="space-y-3">
    <section aria-labelledby="game-ranking-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="game-ranking-title" className="text-lg font-semibold leading-tight">Mais vitoriosos</h2>
          <p className="truncate text-sm text-muted">{gameName} · Geral</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-contrast/6 text-muted" aria-hidden="true"><Trophy className="size-4" /></span>
      </div>
      {!data ? <p className="text-sm text-muted">Ranking indisponível agora.</p> : !shown.length ? <p className="text-sm text-muted">Ninguém venceu ainda. A primeira vitória pode ser sua.</p> : <>
        <ol aria-label={`Ranking de vitórias em ${gameName}`} className="space-y-1">
          {shown.map(item => <li key={item.userId} className="flex items-center gap-3 px-1 py-1.5">
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
