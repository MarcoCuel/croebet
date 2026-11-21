"use client";

import { useState } from "react";
import { Crown, Eye, Feather, Heart, History, Mail, Search, Shield, Swords, UserRound, X, type LucideIcon } from "lucide-react";
import type { LoveAction, LoveView, MatchParticipant } from "@croebet/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const roles: Record<string, { icon: LucideIcon; effect: string }> = {
  Espiã: { icon: Eye, effect: "Sobreviva para disputar uma ficha extra." },
  Guarda: { icon: Search, effect: "Adivinhe a carta de outro jogador." },
  Sacerdote: { icon: Eye, effect: "Veja a mão de outro jogador." },
  Barão: { icon: Swords, effect: "Compare mãos. A menor é eliminada." },
  Aia: { icon: Shield, effect: "Proteja-se até seu próximo turno." },
  Príncipe: { icon: UserRound, effect: "Escolha quem descarta e compra outra carta." },
  Chanceler: { icon: Feather, effect: "Compre duas cartas e escolha uma para manter." },
  Rei: { icon: Crown, effect: "Troque sua mão com outro jogador." },
  Condessa: { icon: Crown, effect: "Descarte se tiver o Rei ou o Príncipe." },
  Princesa: { icon: Heart, effect: "Se descartar esta carta, você é eliminado." },
};
const classic = ["", "Guarda", "Sacerdote", "Barão", "Aia", "Príncipe", "Rei", "Condessa", "Princesa"];
const modern = ["Espiã", "Guarda", "Sacerdote", "Barão", "Aia", "Príncipe", "Chanceler", "Rei", "Condessa", "Princesa"];
type Props = { state: LoveView; busy: boolean; play: (action: LoveAction) => Promise<void>; viewerSeat?: number; participants: MatchParticipant[] };

function CardFace({ value, mode, small = false, compact = false }: { value?: number; mode: LoveView["mode"]; small?: boolean; compact?: boolean }) {
  const name = value === undefined ? undefined : (mode === "classic" ? classic : modern)[value];
  const Icon = name ? roles[name].icon : Mail;
  return (
    <span className={cn("relative flex shrink-0 flex-col items-center justify-between rounded-xl border border-contrast/10 p-3", small ? "h-24 w-16" : "h-44 w-32 sm:h-48 sm:w-36", compact && "h-16 w-11 p-2", name ? "bg-surface text-foreground" : "bg-brand/10 text-brand")}>
      {name ? <><span className={cn("self-start font-semibold leading-none text-brand", small ? "text-lg" : "text-3xl")}>{value}</span><Icon aria-hidden className={small ? "size-5 text-brand" : "size-10 text-brand sm:size-12"} /><span className={cn("font-medium", small ? "sr-only" : "text-xs sm:text-sm")}>{name}</span></> : <><span /><Icon aria-hidden className={small ? "size-5" : "size-10"} /><span className="h-3" /></>}
    </span>
  );
}

export function LoveTable({ state, busy, play, viewerSeat, participants }: Props) {
  const [historyOpen, setHistoryOpen] = useState(true);
  const names = state.mode === "classic" ? classic : modern;
  const me = viewerSeat === undefined ? undefined : state.players[viewerSeat];
  const opponents = state.players.map((player, seat) => ({ player, seat })).filter(({ seat }) => seat !== viewerSeat);
  const discardCount = state.players.reduce((total, player) => total + player.discard.length, 0);
  const status = state.phase === "over" ? `Vitória: ${state.winners.map(i => state.players[i].name).join(", ")}` : state.phase === "summary" ? `Rodada encerrada · ${state.winners.map(i => state.players[i].name).join(", ")}` : viewerSeat === state.turn ? "Sua vez" : `Vez de ${state.players[state.turn].name}`;

  function playerInfo(seat: number) {
    const player = state.players[seat];
    const participant = participants.find(p => p.seat === seat);
    return <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className={cn("size-9", state.phase === "playing" && seat === state.turn && "shadow-[0_0_0_2px_var(--color-brand)]")}>
        <AvatarImage src={participant?.avatarUrl ?? undefined} />
        <AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0"><p className="truncate text-sm font-medium">{player.name}{seat === viewerSeat && <span className="ml-1 text-xs font-normal text-muted">(você)</span>}</p><p className="flex items-center gap-1 text-xs text-muted"><Crown className="size-3" aria-hidden />{player.tokens} {player.tokens === 1 ? "ficha" : "fichas"}{player.out ? " · Eliminado" : player.protected ? " · Protegido" : ""}</p></div>
    </div>;
  }

  function discards(seat: number) {
    return <div aria-label={`Descartes de ${state.players[seat].name}`} className="flex min-h-6 flex-wrap items-center gap-1">
      {state.players[seat].discard.length ? state.players[seat].discard.map((card, index) => <span key={index} title={`${card} · ${names[card]}`} className="inline-flex size-6 items-center justify-center rounded-md bg-contrast/6 text-xs font-medium text-muted">{card}</span>) : <span className="text-xs text-muted">Sem descartes</span>}
    </div>;
  }

  return <div className={cn("grid items-start gap-6 pb-6", historyOpen && "xl:grid-cols-[minmax(0,1fr)_17rem]")}>
    <section aria-label="Mesa do Love Letter" className="min-w-0">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-contrast/6 pb-3">
        <p className="text-sm text-muted">Rodada <span className="font-medium text-foreground">{state.round}</span></p>
        <Button variant="ghost" size="sm" aria-expanded={historyOpen} aria-controls="love-history" onClick={() => setHistoryOpen(!historyOpen)}><History aria-hidden className="size-4" />{historyOpen ? "Ocultar histórico" : "Histórico"}</Button>
      </div>

      <div className={cn("flex gap-3 overflow-x-auto pt-5 pb-2 sm:grid sm:overflow-visible sm:pb-0", opponents.length > 3 ? "sm:grid-cols-3 lg:grid-cols-5" : opponents.length === 3 ? "sm:grid-cols-3" : opponents.length === 1 ? "mx-auto max-w-sm sm:grid-cols-1" : "sm:grid-cols-2")}>
        {opponents.map(({ player, seat }) => <div key={seat} aria-label={`Jogador ${player.name}`} className={cn("flex w-40 min-w-0 shrink-0 flex-col gap-3 rounded-panel bg-contrast/3 p-3 sm:w-auto", player.out && "opacity-50")}>
          {playerInfo(seat)}
          <div className="flex min-h-16 items-center justify-between gap-2">
            <div className="flex -space-x-8">{Array.from({ length: player.handCount }, (_, index) => <span key={index} aria-label={player.hand ? `${player.hand[index]} · ${names[player.hand[index]]}` : "Carta oculta"}><CardFace mode={state.mode} value={player.hand?.[index]} small compact /></span>)}</div>
            <span className="text-xs text-muted">{player.handCount} {player.handCount === 1 ? "carta" : "cartas"}</span>
          </div>
          {discards(seat)}
        </div>)}
      </div>

      <div className="flex flex-col items-center justify-center gap-5 py-6">
        <div className="flex items-start gap-8 sm:gap-12">
          <div className="grid justify-items-center gap-3"><div className="relative"><span aria-hidden className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl border border-contrast/10 bg-surface" /><span className="relative block"><CardFace mode={state.mode} small /></span></div><p className="text-xs text-muted">Baralho · <span className="tabular-nums text-foreground">{state.deckCount}</span></p></div>
          <div className="grid justify-items-center gap-3"><span className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-contrast/10 text-2xl font-medium tabular-nums text-muted">{discardCount}</span><p className="text-xs text-muted">Descartes</p></div>
        </div>
        <p role="status" className={cn("text-center text-sm font-medium", viewerSeat === state.turn && state.phase === "playing" ? "text-brand" : "text-foreground")}>{status}</p>
      </div>

      <LoveHand key={`${state.round}:${state.turn}:${state.pending}:${state.log.length}`} state={state} busy={busy} play={play} viewerSeat={viewerSeat} participants={participants} />
      {me && viewerSeat !== undefined && <div className="mx-auto mt-5 flex max-w-lg flex-wrap items-center justify-center gap-4">{playerInfo(viewerSeat)}{discards(viewerSeat)}</div>}
      {state.privateInfo.length > 0 && <div className="mx-auto mt-5 max-w-lg space-y-1 rounded-panel bg-contrast/6 p-4 text-sm" aria-label="Informações privadas">{state.privateInfo.map((info, index) => <p key={index}>{info}</p>)}</div>}
      {state.removed.length > 0 && <p className="mt-6 text-center text-xs text-muted">Cartas fora da rodada: {state.removed.map(card => `${card} · ${names[card]}`).join(", ")}</p>}
    </section>

    {historyOpen && <aside id="love-history" aria-label="Histórico da partida" className="rounded-panel bg-surface p-4 xl:sticky xl:top-24">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Histórico</h2><Button variant="ghost" size="icon-sm" aria-label="Fechar histórico" onClick={() => setHistoryOpen(false)}><X aria-hidden className="size-4" /></Button></div>
      <ol data-lenis-prevent className="max-h-72 space-y-0 overflow-y-auto xl:max-h-[calc(100dvh-15rem)]">{state.log.length ? [...state.log].reverse().map((line, index) => <li key={index} className="border-b border-contrast/6 py-3 text-sm leading-relaxed text-muted last:border-0">{line}</li>) : <li className="py-3 text-sm text-muted">Aguardando a primeira jogada.</li>}</ol>
    </aside>}
  </div>;
}

function LoveHand({ state, busy, play, viewerSeat }: Props) {
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const [keep, setKeep] = useState(0);
  const names = state.mode === "classic" ? classic : modern;
  const hand = viewerSeat === undefined ? [] : state.players[viewerSeat].hand ?? [];
  const plays = state.legalActions.filter(action => action.type === "play");
  const keeps = state.legalActions.filter(action => action.type === "keep");
  const selectedPlays = plays.filter(action => action.card === card);
  const targets = [...new Set(selectedPlays.flatMap(action => action.target === undefined ? [] : [action.target]))];
  const guesses = [...new Set(selectedPlays.filter(action => action.target === (target ?? undefined)).flatMap(action => action.guess === undefined ? [] : [action.guess]))];
  const action = keeps.at(keep) ?? selectedPlays.find(action => action.target === (target ?? undefined) && action.guess === (guess ?? undefined)) ?? state.legalActions.find(action => action.type === "next");

  return <div className="mx-auto max-w-lg space-y-5">
    {hand.length > 0 && <div role="group" aria-label="Sua mão" className="flex flex-wrap justify-center gap-3 sm:gap-4">{hand.map((value, index) => {
      const playable = plays.some(action => action.card === value);
      return <div key={index} className="relative">
        {playable ? <Button variant="ghost" className={cn("h-auto rounded-xl p-0 text-left transition-transform motion-reduce:transition-none hover:-translate-y-1 hover:bg-transparent focus-visible:border-foreground", card === value && "-translate-y-2 shadow-[0_0_0_2px_var(--color-brand)]")} disabled={busy} aria-label={`Selecionar ${value} · ${names[value]}`} aria-pressed={card === value} onClick={() => { setCard(value); setTarget(null); setGuess(null); }}><CardFace value={value} mode={state.mode} /></Button> : <CardFace value={value} mode={state.mode} />}
      </div>;
    })}</div>}
    {plays.length > 0 && <div className="space-y-4">
      <p className="min-h-10 text-center text-sm text-muted">{card === null ? "Escolha uma carta para jogar." : roles[names[card]].effect}</p>
      <div className="flex flex-wrap items-end justify-center gap-3">
        {targets.length > 0 && <Field className="min-w-40 flex-1">Jogador<Select value={target ?? ""} disabled={busy} onChange={event => { setTarget(Number(event.target.value)); setGuess(null); }}><option value="" disabled>Escolha o jogador</option>{targets.map(seat => <option key={seat} value={seat}>{state.players[seat].name}</option>)}</Select></Field>}
        {guesses.length > 0 && <Field className="min-w-40 flex-1">Palpite<Select value={guess ?? ""} disabled={busy} onChange={event => setGuess(Number(event.target.value))}><option value="" disabled>Escolha a carta</option>{guesses.map(value => <option key={value} value={value}>{value} · {names[value]}</option>)}</Select></Field>}
        <Button loading={busy} disabled={!action} onClick={() => { if (action) void play(action); }}>Jogar carta</Button>
      </div>
    </div>}
    {keeps.length > 0 && <div className="space-y-3"><Field>Carta para manter e ordem no fundo<Select value={keep} disabled={busy} onChange={event => setKeep(Number(event.target.value))}>{keeps.map((action, index) => <option key={index} value={index}>Manter {action.cards[0]} · {names[action.cards[0]]}; fundo: {action.cards.slice(1).map(value => `${value} · ${names[value]}`).join(", ") || "nenhuma"}</option>)}</Select></Field><Button loading={busy} onClick={() => { if (action) void play(action); }}>Confirmar escolha</Button></div>}
    {action?.type === "next" && <div className="flex justify-center"><Button loading={busy} onClick={() => void play(action)}>Próxima rodada</Button></div>}
  </div>;
}
