"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { LoveAction, LoveView, MatchParticipant } from "@croebet/shared";
import { GameActionBar } from "../game-action-bar";
import { Button } from "@/components/ui/button";
import { classic, modern, loveRoles } from "./love-card";
import { LoveScene } from "./love-scene";

type Props = { state: LoveView; busy: boolean; play: (action: LoveAction) => Promise<void>; viewerSeat?: number; participants: MatchParticipant[]; onAnimating?: (busy: boolean) => void };
type Play = Extract<LoveAction, { type: "play" }>;

export function LoveTable(props: Props) {
  return <LoveDecision {...props} />;
}

function LoveDecision({ state, busy, play, viewerSeat, participants, onAnimating }: Props) {
  const [moving, setMoving] = useState(false);
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const decisionKey = `${state.round}:${state.turn}:${state.pending}:${state.log.length}`;
  const [decision, setDecision] = useState(decisionKey);
  if (decision !== decisionKey) {
    setDecision(decisionKey); setCard(null); setTarget(null); setChosen([]);
  }
  const names = state.mode === "classic" ? classic : modern;
  const me = viewerSeat === undefined ? undefined : state.players[viewerSeat];
  const plays = state.legalActions.filter((action): action is Play => action.type === "play");
  const keeps = state.legalActions.filter(action => action.type === "keep");
  const myTurn = state.phase === "playing" && viewerSeat === state.turn && state.legalActions.length > 0;
  const hand = me?.hand ?? [];
  const selected = plays.filter(action => action.card === card);
  const targets = [...new Set(selected.flatMap(action => action.target === undefined ? [] : [action.target]))];
  const guesses = [...new Set(selected.filter(action => action.target === target).flatMap(action => action.guess === undefined ? [] : [action.guess]))];
  const status = state.phase === "over" ? `Vitória: ${state.winners.map(i => state.players[i].name).join(", ")}` : state.phase === "summary" ? `Rodada encerrada · ${state.winners.map(i => state.players[i].name).join(", ")}` : viewerSeat === state.turn ? "Sua vez" : `Vez de ${state.players[state.turn].name}`;
  const instruction = busy ? "Aguarde a jogada…" : state.pending && myTurn ? chosen.length ? "Toque nas cartas restantes na ordem de devolução ao fundo." : "Escolha a carta que deseja manter." : card === null ? myTurn ? "Toque na carta que deseja descartar." : "" : target === null && targets.length ? "Toque no jogador que receberá a carta." : guesses.length ? "Qual carta você acha que ele tem?" : "";

  function chooseCard(value: number) {
    if (busy) return;
    const actions = plays.filter(action => action.card === value);
    if (actions.length === 1 && actions[0].target === undefined) { void play(actions[0]); return; }
    const guardTargets = value === 1 ? [...new Set(actions.flatMap(action => action.target === undefined ? [] : [action.target]))] : [];
    setCard(card === value ? null : value);
    setTarget(card !== value && guardTargets.length === 1 ? guardTargets[0] : null);
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
  const labels: Record<number, string> = {};
  hand.forEach((value, index) => {
    const canKeep = keeps.some(action => [...chosen, index].every((handIndex, position) => action.cards[position] === hand[handIndex])) && !chosen.includes(index);
    if (!busy && myTurn && (state.pending ? canKeep : plays.some(a => a.card === value))) {
      labels[index] = state.pending ? `${chosen.length ? "Devolver" : "Manter"} carta ${index + 1}: ${value} · ${names[value]}` : `Descartar ${value} · ${names[value]}`;
    }
  });
  const submitGuess = (guess: number) => {
    const action = selected.find(action => action.target === target && action.guess === guess);
    if (action && !busy) { setCard(null); setTarget(null); void play(action); }
  };
  const draw = () => { if (state.legalActions.some(a => a.type === "next")) void play({ type: "next" }); };
  const actionBar = <GameActionBar contained>
      <h2 role="status" className="text-sm font-medium" aria-live="polite">{moving ? "Movendo cartas" : status}</h2>
      {!busy && !moving && state.legalActions.some(a => a.type === "next") && <Button onClick={draw}>Próxima rodada</Button>}
    </GameActionBar>;
  return <section aria-label="Mesa do Love Letter" className="relative min-w-0">
    <LoveScene actions={actionBar} view={state} viewer={viewerSeat} participants={participants} selected={card} target={target} labels={labels} onAnimating={value => { setMoving(value); onAnimating?.(value); }}
      onCard={index => state.pending ? chooseKeep(index) : chooseCard(hand[index])} onSeat={chooseTarget} eligible={busy ? [] : targets}
      guesses={!busy && target !== null ? guesses.map(value => ({ value, label: `Adivinhar ${value} · ${names[value]}` })) : []} onGuess={submitGuess}
      canDraw={!busy && state.legalActions.some(a => a.type === "next")}
      deckLabel={state.phase === "summary" && state.legalActions.some(a => a.type === "next") ? "Distribuir próxima rodada" : "Baralho"}
      onDraw={draw}>
      <p className="max-w-md rounded-lg bg-background/90 px-3 py-1.5 text-xs text-muted" aria-live="polite">{instruction}</p>
      {(card !== null || chosen.length > 0) && <Button size="icon-sm" variant="secondary" aria-label="Cancelar escolha" onClick={() => { setCard(null); setTarget(null); setChosen([]); }}><X className="size-4" /></Button>}
      {state.privateInfo.length > 0 && <details className="max-w-sm rounded-lg bg-background/95 p-2 text-left text-xs" aria-label="Informações privadas"><summary className="cursor-pointer">Informações privadas</summary>{state.privateInfo.map((info, index) => <p key={index}>{info}</p>)}</details>}
      {chosen.length > 0 && <p className="rounded-lg bg-background/90 px-2 py-1 text-xs text-muted">Manter: {names[hand[chosen[0]]]}{chosen.length > 1 && ` · Devolver: ${chosen.slice(1).map(index => names[hand[index]]).join(", ")}`}</p>}
      {card !== null && <p className="max-w-sm rounded-lg bg-background/90 px-2 py-1 text-xs text-muted">{loveRoles[names[card]].effect}</p>}
      {state.removed.length > 0 && <details className="rounded-lg bg-background/95 p-2 text-left text-xs text-muted"><summary className="cursor-pointer">Fora da rodada</summary>{state.removed.map(value => `${value} · ${names[value]}`).join(", ")}</details>}
    </LoveScene>

  </section>;
}
