"use client";

import type { GameRoom } from "@croebet/shared";
import { Trophy, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CroinIcon } from "@/components/shared/croin-icon";
import { cn } from "@/lib/utils";
export type ResultMetadata = Pick<Exclude<GameRoom, { status: "lobby" }>, "participants" | "entryAmount" | "potTotal" | "payouts" | "durationSeconds"> & { activeDurationSeconds?: number | null };
export type GameResultSummary = {
  round: number;
  scoreLabel: string;
  players: { seat: number; name: string; score: number; winner: boolean }[];
};

export function resultDuration(seconds: number | null | undefined) {
  if (seconds == null) return "Indisponível";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours) return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  if (minutes) return `${minutes} min ${remaining.toString().padStart(2, "0")} s`;
  return `${remaining} s`;
}

export function GameResult({ result, match, leaving, onPlayAgain, onReplay, replayLoading = false }: { result: GameResultSummary; match: ResultMetadata | null; leaving: boolean; onPlayAgain: () => void; onReplay?: () => void; replayLoading?: boolean }) {
  const standings = [...result.players].sort((a, b) => b.score - a.score);
  const winners = standings.filter(player => player.winner);
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
      <div className="grid content-start justify-items-center gap-1 px-2 text-center"><dt className="flex items-center gap-1.5 text-xs text-muted">Rodadas</dt><dd className="text-sm font-semibold tabular-nums">{result.round}</dd></div>
      {!!match?.entryAmount && <div className="grid content-start justify-items-center gap-1 px-2 text-center"><dt className="text-xs text-muted">Prêmio (Pote)</dt><dd className="flex items-center gap-1.5 text-sm font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />{match.potTotal.toLocaleString("pt-BR")}</dd></div>}
    </dl>
    {match?.activeDurationSeconds != null && <p className="mt-2 text-center text-xs text-muted">Em reprodução: {resultDuration(match.activeDurationSeconds)} · pausas descontadas</p>}
    <h2 className="mt-5 mb-3 text-sm font-semibold">Placar final</h2>
    <ol aria-label="Classificação final" className="grid gap-1.5">
      {standings.map(player => {
        const payout = match?.payouts.find(item => item.seat === player.seat);
        return <li key={player.seat} className={cn("flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm", player.winner ? "bg-selected" : "bg-contrast/6")}>
          <span className="w-5 shrink-0 text-xs text-muted tabular-nums">{standings.findIndex(person => person.score === player.score) + 1}º</span>
          {playerAvatar(player)}
          <span className="min-w-0 flex-1 break-words font-medium">{player.name}</span>
          <span className="grid shrink-0 justify-items-end gap-0.5"><span className="font-semibold tabular-nums">{player.score} <span className="text-xs font-normal text-muted">{result.scoreLabel}</span></span>{payout && <span className="flex items-center gap-1 text-xs text-muted tabular-nums"><CroinIcon className="size-3.5 text-[0.625rem]" />{payout.amount.toLocaleString("pt-BR")}{payout.house && " · Casa"}</span>}</span>
        </li>;
      })}
    </ol>
    <div className={cn("mt-6 grid gap-2", onReplay ? "grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]")}>
      <Button disabled={leaving} onClick={onPlayAgain} className={cn("bg-tertiary text-white", onReplay && "col-span-2 sm:col-span-1")}>Jogar novamente</Button>
      {onReplay && <Button variant="secondary" loading={replayLoading} onClick={onReplay}><RotateCcw className="size-4" aria-hidden="true" />Replay</Button>}
      <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
    </div>
  </>;
}
