"use client";

import type { Match } from "@croebet/shared";
import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CroinIcon } from "@/components/shared/croin-icon";
import { cn } from "@/lib/utils";
import type { Game } from "./presentation";

function resultDuration(seconds: number | null | undefined) {
  if (seconds == null) return "Indisponível";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours) return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  if (minutes) return `${minutes} min ${remaining.toString().padStart(2, "0")} s`;
  return `${remaining} s`;
}

export function Flip7Result({ game, match, leaving, onPlayAgain }: { game: Game; match: Match | null; leaving: boolean; onPlayAgain: () => void }) {
  const standings = game.players.map((player, seat) => ({ ...player, seat })).sort((a, b) => b.total - a.total);
  const maxScore = standings[0].total;
  const winners = standings.filter(player => player.total === maxScore);
  function playerAvatar(player: typeof standings[number], prominent = false) {
    return <Avatar className={prominent ? "size-16" : "size-9"} aria-hidden="true">
      <AvatarImage src={match?.participants.find(person => person.seat === player.seat)?.avatarUrl ?? undefined} />
      <AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
    </Avatar>;
  }
  return <>
    <DialogTitle>Resultado da partida</DialogTitle>
    <div className="my-6 grid justify-items-center gap-3 text-center">
      <div className="flex flex-wrap justify-center gap-3">{winners.map(player => <div className="relative" key={player.seat}>{playerAvatar(player, true)}<span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-brand text-white"><Trophy className="size-3.5" aria-hidden="true" /></span></div>)}</div>
      <DialogDescription className="text-lg text-foreground"><span className="font-semibold">{winners.map(player => player.name).join(" e ")}</span> {winners.length > 1 ? "venceram a partida!" : "venceu a partida!"}</DialogDescription>
    </div>
    <dl className={cn("grid grid-cols-2 divide-x divide-contrast/6 rounded-lg bg-contrast/6 py-3", !!match?.entryAmount && "grid-cols-3")}>
      <div className="grid content-start justify-items-center gap-1 px-2 text-center"><dt className="flex items-center gap-1.5 text-xs text-muted">Duração</dt><dd className="text-sm font-semibold tabular-nums">{resultDuration(match?.durationSeconds)}</dd></div>
      <div className="grid content-start justify-items-center gap-1 px-2 text-center"><dt className="flex items-center gap-1.5 text-xs text-muted">Rodadas</dt><dd className="text-sm font-semibold tabular-nums">{game.round}</dd></div>
      {!!match?.entryAmount && <div className="grid content-start justify-items-center gap-1 px-2 text-center"><dt className="text-xs text-muted">Prêmio (Pote)</dt><dd className="flex items-center gap-1.5 text-sm font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />{match.potTotal.toLocaleString("pt-BR")}</dd></div>}
    </dl>
    <h2 className="mt-5 mb-3 text-sm font-semibold">Placar final</h2>
    <ol aria-label="Classificação final" className="grid gap-1.5">
      {standings.map(player => {
        const payout = match?.payouts.find(item => item.seat === player.seat);
        return <li key={player.seat} className={cn("flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm", player.total === maxScore ? "bg-selected" : "bg-contrast/6")}>
          <span className="w-5 shrink-0 text-xs text-muted tabular-nums">{standings.findIndex(person => person.total === player.total) + 1}º</span>
          {playerAvatar(player)}
          <span className="min-w-0 flex-1 break-words font-medium">{player.name}</span>
          <span className="grid shrink-0 justify-items-end gap-0.5"><span className="font-semibold tabular-nums">{player.total} <span className="text-xs font-normal text-muted">pts</span></span>{payout && <span className="flex items-center gap-1 text-xs text-muted tabular-nums"><CroinIcon className="size-3.5 text-[0.625rem]" />{payout.amount.toLocaleString("pt-BR")}{payout.house && " · Casa"}</span>}</span>
        </li>;
      })}
    </ol>
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <DialogClose asChild><Button variant="secondary">Fechar</Button></DialogClose>
      <Button disabled={leaving} onClick={onPlayAgain}>Jogar novamente</Button>
    </div>
  </>;
}
