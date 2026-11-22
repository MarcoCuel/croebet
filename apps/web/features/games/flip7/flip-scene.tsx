"use client";
import { useCallback, useMemo, useState } from "react";
import type { MatchParticipant } from "@croebet/shared";
import { usePresentationClock } from "@/three/table/use-presentation-clock";
import { TableViewport, type TableViewportHeader } from "@/three/table/table-viewport";
import { numberNames, type TableArtwork } from "@/three/table/artwork";
import type { TablePresentation } from "@/three/table/table-scene";
import { Button } from "@/components/ui/button";
import type { Card, Game } from "./types";
import { cardFace, flipTableState } from "./table-model";
import { scenePresentationDuration } from "./action-presentation";
import { numberColors } from "./card-colors";
import { cardLabel, score } from "./rules";

const symbols: Record<string, string> = { chance: "♡", freeze: "❄", three: "+3", one: "+1", four: "+4", steal: "↙", swap: "⇄", remove: "↑", double: "×2", halve: "÷2" };
const artwork: TableArtwork = { back: { text: "7", color: "#ad158f" }, faces: Object.fromEntries(
  ["number", "bonus", "double", "chance", "freeze", "three", "zero", "unlucky7", "lucky13", "minus", "halve", "one", "four", "steal", "swap", "remove"].flatMap(type => (type === "number" ? Array.from({ length: 14 }, (_, i) => i) : type === "bonus" || type === "minus" ? [2, 4, 6, 8, 10] : [type === "unlucky7" ? 7 : type === "lucky13" ? 13 : type === "halve" ? 2 : 0]).map(value => {
    const card = { id: 0, type, value } as Card;
    const numeric = ["number", "zero", "unlucky7", "lucky13"].includes(type);
    const color = type === "unlucky7" ? "silver" : numeric ? numberColors[value] : type === "freeze" || type === "one" ? "cyan" : type === "four" ? "yellow" : type === "three" || type === "steal" ? "amber" : type === "minus" || type === "halve" ? "red" : type === "swap" ? "lime" : type === "remove" ? "purple" : "orange";
    return [cardFace(card), { layout: numeric ? "numeric" : "symbol", text: symbols[type] ?? (type === "bonus" ? `+${value}` : type === "minus" ? `−${value}` : String(value)), caption: type === "number" ? numberNames[value] : cardLabel(card), color: `var(--color-flip-${color})` }];
  }))) };

export default function FlipScene({ game, viewer, participants, eligible, targetSeats, interactive, selected, onCard, onSeat, canDraw, onDraw, status, onAnimating, animate, held, children, actions, header, paused, timeScale, localPlayer, summaryGame }: {
  game: Game; viewer: number; participants: MatchParticipant[]; eligible: number[]; targetSeats: number[]; interactive: boolean; selected: number[]; onCard: (id: number) => void;
  onSeat: (seat: number) => void; canDraw: boolean; onDraw: () => void; status: string; onAnimating: (busy: boolean) => void;
  animate: boolean; held: { card: Card; target: number } | null; children?: React.ReactNode; actions?: React.ReactNode; header?: TableViewportHeader;
  paused?: boolean; timeScale?: number;
  localPlayer: boolean; summaryGame: Game;
}) {
  const [snapshot, setSnapshot] = useState(() => ({ game, held, state: flipTableState(game, undefined, held), duration: 0, previousState: undefined as ReturnType<typeof flipTableState> | undefined }));
  const [settledSerial, setSettledSerial] = useState(0);
  let state = snapshot.state;
  if (snapshot.game !== game || snapshot.held !== held) {
    state = flipTableState(game, animate && snapshot.game.round === game.round ? snapshot.state : undefined, held);
    setSnapshot({ game, held, state, previousState: snapshot.state, duration: animate ? scenePresentationDuration(snapshot.game, game) : 0 });
  }
  const reportAnimating = usePresentationClock(state.cue.serial, snapshot.duration, onAnimating, paused, timeScale);
  const serial = state.cue.serial;
  const reportMotion = useCallback((busy: boolean) => {
    if (!busy) setSettledSerial(serial);
    reportAnimating(busy);
  }, [serial, reportAnimating]);
  // Preserve existing pairs, but activate new pairs only after their delivery.
  const presentedState = useMemo(() => {
    if (settledSerial === state.cue.serial || !Object.keys(state.motions).length) return state;
    return { ...state, hands: state.hands.map((hand, seat) => {
      const previousHand = snapshot.previousState?.hands[seat] ?? [];
      const formingPair = hand.some(card => card.idle && !previousHand.some(previous => previous.id === card.id && previous.idle));
      return formingPair ? hand.map(card => ({ ...card, idle: undefined })) : hand;
    }) };
  }, [state, settledSerial, snapshot.previousState]);
  const allCards = game.players.flatMap(player => player.cards.map(card => ({ card, owner: player.name })));
  const labels = Object.fromEntries(allCards.filter(({ card }) => eligible.includes(card.id)).map(({ card, owner }) => [`card:${card.id}`, `Selecionar ${cardLabel(card)} de ${owner}`]));
  const choiceCards = state.hands.flat().filter(card => eligible.includes(Number(card.id.slice(5))) || selected.includes(Number(card.id.slice(5))));
  const choosing = !!game.pending?.resolving && choiceCards.length > 0;
  const seatTargets = interactive && game.bonusChoice != null ? game.players.map((_, seat) => seat) : game.pending && !game.pending.resolving ? targetSeats : [];
  const presentation: TablePresentation = { artwork, deckLabel: "Comprar carta do baralho", hiddenSeats: [], labels: choosing ? labels : {}, selectable: choosing && interactive ? Object.keys(labels) : [], selectedIds: selected.map(id => `card:${id}`),
    seats: game.players.map((player, seat) => ({ name: player.name, avatar: participants.find(person => person.seat === seat)?.avatarUrl ?? undefined,
      summary: { score: summaryGame.players[seat].total, liveScore: summaryGame.players[seat].total + (summaryGame.phase === "playing" ? score(summaryGame.players[seat], summaryGame) : 0),
        status: { playing: "Ativo", stayed: "Parou", frozen: "Congelado", busted: "Estourou" }[summaryGame.players[seat].status] },
      disabled: !seatTargets.includes(seat), label: game.bonusChoice != null ? game.bonusChoice === seat ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}` : `Escolher ${player.name}` })) };
  const fallback = <div className="absolute inset-x-3 top-3 bottom-20 flex flex-wrap content-center justify-center gap-2 overflow-y-auto bg-background/95 p-3">
    <p className="w-full text-center text-sm text-muted">Visualização 3D indisponível. Troque para a interface Atual.</p>
    <Button disabled={!canDraw} onClick={onDraw}>Comprar carta do baralho</Button>
    {allCards.filter(({ card }) => eligible.includes(card.id) && choosing).map(({ card, owner }) => <Button key={card.id} variant="secondary" onClick={() => onCard(card.id)} aria-label={`Selecionar ${cardLabel(card)} de ${owner}`}>{cardLabel(card)} · {owner}</Button>)}
    {seatTargets.map(seat => <Button key={seat} onClick={() => onSeat(seat)}>{game.players[seat].name}</Button>)}
  </div>;
  return <TableViewport testId="flip-table-scene" localPlayer={localPlayer} state={choosing ? { ...presentedState, choice: { cards: choiceCards.map(card => ({ ...card, label: labels[card.id] })) } } : presentedState}
    presentation={presentation} viewer={viewer} turn={game.bonusChoice ?? game.forced?.target ?? game.pending?.source ?? game.turn}
    paused={paused} timeScale={timeScale} canDraw={canDraw} onDraw={onDraw} onCard={id => onCard(Number(id.slice(5)))} onSeat={onSeat} status={status} header={header} actions={actions} onAnimating={reportMotion} fallback={fallback}>{children}</TableViewport>;
}
