"use client";
import { useCallback, useState, type ReactNode } from "react";
import type { LoveView, MatchParticipant } from "@croebet/shared";
import type { TablePresentation } from "@/three/table/table-scene";
import { TableViewport } from "@/three/table/table-viewport";
import { loveTableState } from "./table-model";
import { Button } from "@/components/ui/button";
import { LoveCard } from "./love-card";
import { loveArtwork } from "./artwork";

export function LoveScene({ view, viewer, participants, selected, target, labels, onCard, onDraw, onSeat, canDraw, deckLabel, eligible, guesses, onGuess, children, actions, onAnimating }: {
  view: LoveView; viewer?: number; participants: MatchParticipant[]; selected: number | null; target: number | null;
  labels: Record<number, string>; onCard: (index: number) => void; onDraw: () => void; onSeat: (seat: number) => void;
  canDraw: boolean; deckLabel: string; eligible: number[]; guesses: { value: number; label: string }[]; onGuess: (value: number) => void; children?: ReactNode; actions?: ReactNode;
  onAnimating?: (busy: boolean) => void;
}) {
  const [moving, setMoving] = useState(false);
  const reportMotion = useCallback((busy: boolean) => { setMoving(busy); onAnimating?.(busy); }, [onAnimating]);
  const [snapshot, setSnapshot] = useState(() => ({ view, viewer, state: loveTableState(view, viewer) }));
  let state = snapshot.state;
  if (snapshot.view !== view || snapshot.viewer !== viewer) {
    state = loveTableState(view, viewer, snapshot.viewer === viewer ? snapshot.state : undefined);
    setSnapshot({ view, viewer, state });
  }
  const hand = viewer === undefined ? [] : state.hands[viewer];
  const choices = guesses.map(guess => ({ id: `guess:${guess.value}`, value: guess.value, hidden: false, label: guess.label }));
  const displayed = choices.length ? choices : hand;
  const cardLabels = choices.length ? Object.fromEntries(guesses.map(guess => [`guess:${guess.value}`, guess.label])) : Object.fromEntries(hand.map((card, index) => [card.id, labels[index]]));
  const presentation: TablePresentation = { artwork: loveArtwork[view.mode],
    seats: view.players.map((player, seat) => ({ name: player.name, avatar: participants.find(p => p.seat === seat)?.avatarUrl ?? undefined,
      detail: `${player.tokens} ${player.tokens === 1 ? "ficha" : "fichas"}${player.out ? " · Eliminado" : player.protected ? " · Protegido" : ""}`,
      label: eligible.includes(seat) ? `Escolher jogador ${player.name}` : `Jogador ${player.name}`, disabled: moving || !eligible.includes(seat), selected: target === seat })),
    hiddenSeats: view.players.flatMap((player, seat) => player.hand === null ? [seat] : []),
    selectable: moving ? [] : displayed.filter(card => cardLabels[card.id]).map(card => card.id), labels: cardLabels, deckLabel,
    selectedIds: choices.length ? [] : hand.filter(card => card.value === selected).map(card => card.id) };
  const choose = (id: string) => {
    const guess = choices.find(card => card.id === id);
    if (guess) onGuess(guess.value);
    else { const index = hand.findIndex(card => card.id === id); if (index >= 0) onCard(index); }
  };
  const fallback = <div className="absolute inset-x-3 top-32 bottom-20 flex flex-wrap content-center justify-center gap-3 overflow-y-auto rounded-panel bg-background/95 p-3">
    <p className="w-full text-center text-sm text-muted">Visualização 3D indisponível.</p>
    <Button disabled={!canDraw} aria-label={deckLabel} onClick={onDraw}>Baralho · {state.deck.length}</Button>
    {displayed.map(card => cardLabels[card.id] ? <Button key={card.id} variant="ghost" className="h-auto p-0" aria-label={cardLabels[card.id]} onClick={() => choose(card.id)}><LoveCard mode={view.mode} value={card.value < 0 ? undefined : card.value} /></Button> : <LoveCard key={card.id} mode={view.mode} value={card.value < 0 ? undefined : card.value} />)}
    {eligible.map(seat => <Button key={seat} onClick={() => onSeat(seat)} aria-label={`Escolher jogador ${view.players[seat].name}`}>{view.players[seat].name}</Button>)}
    {view.players.map((player, seat) => <div key={seat} aria-label={`Descartes de ${player.name}`} className="flex flex-wrap items-center gap-1 text-xs"><span>{player.name}</span>{player.discard.map((value, index) => <LoveCard key={index} mode={view.mode} value={value} small compact />)}</div>)}
  </div>;
  return <TableViewport testId="love-table-scene" localPlayer={viewer !== undefined} state={choices.length ? { ...state, choice: { cards: choices } } : state} presentation={presentation} viewer={viewer ?? 0} turn={view.turn}
    canDraw={canDraw && !moving} onDraw={onDraw} onCard={choose} onSeat={onSeat} status="" actions={actions} onAnimating={reportMotion} fallback={fallback}>{children}</TableViewport>;
}
