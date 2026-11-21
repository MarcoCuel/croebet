"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, X } from "lucide-react";
import type { LoveAction, LoveView, MatchParticipant } from "@croebet/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoveCard, classic, modern, loveRoles } from "./love-card";

type Props = { state: LoveView; busy: boolean; play: (action: LoveAction) => Promise<void>; viewerSeat?: number; participants: MatchParticipant[] };
type Play = Extract<LoveAction, { type: "play" }>;

export function LoveTable(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(props.state);
  useEffect(() => {
    const before = previous.current;
    previous.current = props.state;
    if (before === props.state || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations: Animation[] = [];
    function fly(value: number | undefined, from: string, to: string, delay: number) {
      const source = root.current?.querySelector(from)?.getBoundingClientRect();
      const destination = root.current?.querySelector(to)?.getBoundingClientRect();
      const element = root.current?.querySelector<HTMLElement>(`[data-flight="${value ?? "back"}"]`);
      if (!source || !destination || !element) return;
      const animation = element.animate([
        { transform: `translate(${source.x}px, ${source.y}px) rotate(-10deg)`, opacity: 0 },
        { transform: `translate(${source.x}px, ${source.y}px) rotate(-10deg)`, opacity: 1, offset: .1 },
        { transform: `translate(${destination.x}px, ${destination.y}px) rotate(0deg)`, opacity: 1, offset: .85 },
        { transform: `translate(${destination.x}px, ${destination.y}px) rotate(0deg)`, opacity: 0 },
      ], { duration: 600, delay, easing: "cubic-bezier(.2,.7,.2,1)" });
      animations.push(animation);
    }
    if (before.round === props.state.round) {
      props.state.players.forEach((player, seat) => {
        const prior = before.players[seat];
        const added = player.discard.slice(prior.discard.length);
        if (added.length) fly(added[0], `[data-love-seat="${seat}"]`, `[data-love-discard="${seat}"]`, 0);
      });
    }
    if (props.state.phase === "playing" && props.state.turn !== props.viewerSeat && (before.turn !== props.state.turn || before.round !== props.state.round || props.state.pending !== before.pending)) {
      fly(undefined, '[data-love-deck]', `[data-love-seat="${props.state.turn}"]`, 550);
    }
    return () => animations.forEach(animation => animation.cancel());
  }, [props.state, props.viewerSeat]);
  return <div ref={root}>
    <LoveDecision key={`${props.state.round}:${props.state.turn}:${props.state.pending}:${props.state.log.length}`} {...props} />
    {[undefined, ...Array.from({ length: 10 }, (_, i) => i)].map(value => <span key={value ?? "back"} data-flight={value ?? "back"} aria-hidden className="pointer-events-none fixed top-0 left-0 z-50 opacity-0"><LoveCard value={value} mode={props.state.mode} small compact /></span>)}
  </div>;
}

function LoveDecision({ state, busy, play, viewerSeat, participants }: Props) {
  const [drawn, setDrawn] = useState(false);
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const root = useRef<HTMLElement>(null);
  const names = state.mode === "classic" ? classic : modern;
  const me = viewerSeat === undefined ? undefined : state.players[viewerSeat];
  const plays = state.legalActions.filter((action): action is Play => action.type === "play");
  const keeps = state.legalActions.filter(action => action.type === "keep");
  const myTurn = state.phase === "playing" && viewerSeat === state.turn && state.legalActions.length > 0;
  const needsDraw = myTurn && !state.pending && !drawn && (me?.handCount ?? 0) > 1;
  const hand = me?.hand ?? [];
  const shownHand = needsDraw ? hand.slice(0, 1) : hand;
  const handCardClass = hand.length > 2 ? "h-auto w-[min(8rem,23vw)] aspect-[3/4] p-2 sm:h-48 sm:w-36 sm:p-3" : undefined;
  const selected = plays.filter(action => action.card === card);
  const targets = [...new Set(selected.flatMap(action => action.target === undefined ? [] : [action.target]))];
  const guesses = [...new Set(selected.filter(action => action.target === target).flatMap(action => action.guess === undefined ? [] : [action.guess]))];
  const status = state.phase === "over" ? `Vitória: ${state.winners.map(i => state.players[i].name).join(", ")}` : state.phase === "summary" ? `Rodada encerrada · ${state.winners.map(i => state.players[i].name).join(", ")}` : viewerSeat === state.turn ? "Sua vez" : `Vez de ${state.players[state.turn].name}`;
  const instruction = busy ? "Aguarde a jogada…" : state.pending && myTurn ? chosen.length ? "Toque nas cartas restantes na ordem de devolução ao fundo." : "Escolha a carta que deseja manter." : needsDraw ? "Toque no baralho para comprar sua carta." : card === null ? myTurn ? "Toque na carta que deseja descartar." : "" : target === null && targets.length ? "Toque no jogador que receberá a carta." : guesses.length ? "Qual carta você acha que ele tem?" : "";

  function chooseCard(value: number) {
    if (busy || needsDraw) return;
    const actions = plays.filter(action => action.card === value);
    if (actions.length === 1 && actions[0].target === undefined) { void play(actions[0]); return; }
    setCard(card === value ? null : value); setTarget(null);
  }
  function chooseTarget(seat: number) {
    if (busy) return;
    const actions = selected.filter(action => action.target === seat);
    if (actions.length === 1 && actions[0].guess === undefined) { void play(actions[0]); return; }
    setTarget(seat);
  }
  function chooseKeep(index: number) {
    if (busy || chosen.includes(index)) return;
    const order = [...chosen, index];
    const candidates = keeps.filter(action => order.every((handIndex, position) => action.cards[position] === hand[handIndex]));
    if (!candidates.length) return;
    if (order.length === hand.length || candidates.every(action => JSON.stringify(action) === JSON.stringify(candidates[0]))) { void play(candidates[0]); return; }
    setChosen(order);
  }
  // Animate the visible draw from the actual deck to the anchored local hand.
  useEffect(() => {
    if (!drawn || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const deck = root.current?.querySelector('[data-love-deck]')?.getBoundingClientRect();
    const element = root.current?.querySelector<HTMLElement>('[data-love-hand] > :last-child');
    if (!deck || !element) return;
    const end = element.getBoundingClientRect();
    const animation = element.animate([{ transform: `translate(${deck.x - end.x}px, ${deck.y - end.y}px) rotate(-12deg) scale(.5)`, opacity: 0 }, { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 }], { duration: 550, easing: "cubic-bezier(.2,.7,.2,1)" });
    return () => animation.cancel();
  }, [drawn]);

  function playerInfo(seat: number) {
    const player = state.players[seat];
    const participant = participants.find(p => p.seat === seat);
    return <span className="flex min-w-0 items-center gap-2.5">
      <Avatar className={cn("size-9", state.phase === "playing" && seat === state.turn && "shadow-[0_0_0_2px_var(--color-brand)]")}><AvatarImage src={participant?.avatarUrl ?? undefined} /><AvatarFallback>{player.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
      <span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{player.name}{seat === viewerSeat && <span className="ml-1 text-xs font-normal text-muted">(você)</span>}</span><span className="flex items-center gap-1 text-xs text-muted"><Crown className="size-3" aria-hidden />{player.tokens} {player.tokens === 1 ? "ficha" : "fichas"}{player.out ? " · Eliminado" : player.protected ? " · Protegido" : ""}</span></span>
    </span>;
  }
  function discards(seat: number) {
    return <span data-love-discard={seat} aria-label={`Descartes de ${state.players[seat].name}`} className="flex min-h-6 flex-wrap gap-1">{state.players[seat].discard.map((value, index) => <span key={index} title={`${value} · ${names[value]}`}><LoveCard value={value} mode={state.mode} small compact /></span>)}</span>;
  }
  function playerSeat(seat: number) {
    const player = state.players[seat];
    const eligible = targets.includes(seat) && !needsDraw && !busy;
    const content = <><span data-love-seat={seat} className="flex items-center justify-between gap-2">{playerInfo(seat)}{eligible && <span className="text-xs text-brand">Escolher</span>}</span>{seat !== viewerSeat && <span className="flex -space-x-6">{Array.from({ length: player.handCount }, (_, index) => <span key={index} aria-label={player.hand ? `${player.hand[index]} · ${names[player.hand[index]]}` : "Carta oculta"}><LoveCard mode={state.mode} value={player.hand?.[index]} small compact /></span>)}</span>}{discards(seat)}</>;
    const className = cn("flex min-w-0 flex-col gap-3 rounded-panel bg-contrast/3 p-3", player.out && "opacity-50", target === seat && "shadow-[0_0_0_2px_var(--color-brand)]");
    return eligible ? <Button key={seat} variant="ghost" aria-label={`Escolher jogador ${player.name}`} aria-pressed={target === seat} className={cn(className, "h-auto items-stretch justify-start whitespace-normal border-brand/50 hover:bg-brand/10")} onClick={() => chooseTarget(seat)}>{content}</Button> : <div key={seat} aria-label={`Jogador ${player.name}`} className={className}>{content}</div>;
  }

  return <section ref={root} aria-label="Mesa do Love Letter" className="relative flex min-h-[calc(100dvh-var(--header-height)-10rem)] min-w-0 flex-col gap-5 pb-2">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{state.players.map((_, seat) => seat !== viewerSeat && playerSeat(seat))}</div>
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
      <Button data-love-deck variant="ghost" aria-label={needsDraw ? "Comprar carta do baralho" : state.phase === "summary" && state.legalActions.some(a => a.type === "next") ? "Distribuir próxima rodada" : "Baralho"} disabled={busy || !(needsDraw || state.legalActions.some(a => a.type === "next"))} onClick={() => { if (needsDraw) setDrawn(true); else void play({ type: "next" }); }} className="relative h-auto rounded-xl p-0 disabled:opacity-100 hover:-translate-y-1 hover:bg-transparent"><span aria-hidden className="absolute inset-0 translate-x-1 translate-y-1 rounded-xl border border-contrast/10 bg-surface" /><span className="relative"><LoveCard mode={state.mode} small /></span></Button>
      <span className="text-xs text-muted">{state.deckCount + (needsDraw ? 1 : 0)} cartas no baralho</span>
      <p role="status" className={cn("text-center text-sm font-medium", myTurn && "text-brand")}>{status}</p>
      {state.privateInfo.length > 0 && <div className="max-w-lg rounded-panel bg-contrast/6 p-3 text-sm" aria-label="Informações privadas">{state.privateInfo.map((info, index) => <p key={index}>{info}</p>)}</div>}
    </div>
    <div className="sticky bottom-0 z-20 -mx-2 rounded-t-panel border-t border-contrast/6 bg-background/95 px-2 pt-3 pb-4 backdrop-blur-md">
      <div className="mb-3 flex min-h-8 items-center justify-center gap-2"><p aria-live="polite" className="text-center text-sm text-muted">{instruction}</p>{(card !== null || chosen.length > 0) && <Button size="icon-sm" variant="ghost" aria-label="Cancelar escolha" onClick={() => { setCard(null); setTarget(null); setChosen([]); }}><X className="size-4" /></Button>}</div>
      {guesses.length > 0 && target !== null && <div role="group" aria-label="Escolher palpite" className="mb-4 flex flex-wrap justify-center gap-2">{guesses.map(value => <Button key={value} variant="ghost" disabled={busy} aria-label={`Adivinhar ${value} · ${names[value]}`} className="h-auto rounded-xl p-0 hover:-translate-y-1 hover:bg-transparent" onClick={() => { const action = selected.find(a => a.target === target && a.guess === value); if (action) void play(action); }}><LoveCard value={value} mode={state.mode} small /></Button>)}</div>}
      <div data-love-hand role="group" aria-label="Sua mão" className="flex justify-center gap-3 sm:gap-4">{shownHand.map((value, index) => {
        const canKeep = keeps.some(action => [...chosen, index].every((handIndex, position) => action.cards[position] === hand[handIndex])) && !chosen.includes(index);
        const playable = myTurn && !needsDraw && (state.pending ? canKeep : plays.some(a => a.card === value));
        return <span key={index} className="relative">{playable ? <Button variant="ghost" disabled={busy} aria-label={state.pending ? `${chosen.length ? "Devolver" : "Manter"} carta ${index + 1}: ${value} · ${names[value]}` : `Descartar ${value} · ${names[value]}`} aria-pressed={card === value} title={loveRoles[names[value]].effect} className={cn("h-auto rounded-xl p-0 transition-transform hover:-translate-y-2 hover:bg-transparent motion-reduce:transition-none", card === value && "-translate-y-3 shadow-[0_0_0_2px_var(--color-brand)]")} onClick={() => state.pending ? chooseKeep(index) : chooseCard(value)}><LoveCard value={value} mode={state.mode} className={handCardClass} /></Button> : <LoveCard value={value} mode={state.mode} className={handCardClass} />}{chosen.includes(index) && <span className="absolute top-2 right-2 rounded-full bg-brand px-2 py-1 text-xs text-white">{chosen.indexOf(index) === 0 ? "Manter" : chosen.indexOf(index)}</span>}</span>;
      })}{hand.length === 0 && me && Array.from({ length: me.handCount }, (_, index) => <LoveCard key={`hidden-${index}`} mode={state.mode} />)}</div>
      {card !== null && <p className="mt-3 text-center text-xs text-muted">{loveRoles[names[card]].effect}</p>}
      {me && viewerSeat !== undefined && <div className="mx-auto mt-3 max-w-lg">{targets.includes(viewerSeat) ? playerSeat(viewerSeat) : <span data-love-seat={viewerSeat}>{playerInfo(viewerSeat)}<span data-love-discard={viewerSeat}>{discards(viewerSeat)}</span></span>}</div>}
    </div>
    {state.removed.length > 0 && <p className="text-center text-xs text-muted">Fora da rodada: {state.removed.map(value => `${value} · ${names[value]}`).join(", ")}</p>}
  </section>;
}
