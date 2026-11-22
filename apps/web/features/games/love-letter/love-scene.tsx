"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LoveView, MatchParticipant } from "@croebet/shared";
import { resolveTableLayout } from "@/three/table/adaptive-layout";
import { useTableVisualSettings } from "@/three/table/use-visual-settings";
import type { TablePresentation } from "@/three/table/table-scene";
import { loveTableState } from "./table-model";
import { Button } from "@/components/ui/button";
import { TableSceneBoundary } from "@/three/table/scene-boundary";
import { LoveCard } from "./love-card";
import { loveArtwork } from "./artwork";

const Scene = dynamic(() => import("@/three/table/table-scene"), { ssr: false, loading: () => <p role="status">Carregando mesa 3D…</p> });
export function LoveScene({ view, viewer, drawn, participants, selected, target, labels, onCard, onDraw, onSeat, canDraw, deckLabel, eligible }: {
  view: LoveView; viewer?: number; drawn: boolean; participants: MatchParticipant[]; selected: number | null; target: number | null;
  labels: Record<number, string>; onCard: (index: number) => void; onDraw: () => void; onSeat: (seat: number) => void;
  canDraw: boolean; deckLabel: string; eligible: number[];
}) {
  const { settings: visual, onDeckChange, onDiscardChange } = useTableVisualSettings();
  const root = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 640 });
  const [reduced, setReduced] = useState(false);
  const [snapshot, setSnapshot] = useState(() => ({ view, drawn, viewer, state: loveTableState(view, viewer, drawn) }));
  let state = snapshot.state;
  if (snapshot.view !== view || snapshot.drawn !== drawn || snapshot.viewer !== viewer) {
    state = loveTableState(view, viewer, drawn, snapshot.view.round === view.round && snapshot.viewer === viewer ? snapshot.state : undefined);
    setSnapshot({ view, drawn, viewer, state });
  }
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (root.current) observer.observe(root.current);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches); update(); query.addEventListener("change", update);
    return () => { observer.disconnect(); query.removeEventListener("change", update); };
  }, []);
  const settings = { ...visual, players: view.players.length, viewer: viewer ?? 0, turn: view.turn, reveal: false };
  const countKey = state.hands.map(hand => hand.length).join(":");
  const layout = useMemo(() => resolveTableLayout({ players: settings.players, viewer: settings.viewer, counts: countKey.split(":").map(Number), ...viewport, angle: visual.angle,
    deck: [visual.deckX, 0.035, visual.deckZ], deckRotation: visual.deckRotation, discard: { x: visual.discardX, z: visual.discardZ, rotation: visual.discardRotation, scale: visual.discardScale } }), [settings.players, settings.viewer, countKey, viewport, visual]);
  const hand = viewer === undefined ? [] : state.hands[viewer];
  const presentation: TablePresentation = { artwork: loveArtwork[view.mode],
    seats: view.players.map((player, seat) => ({ name: player.name, avatar: participants.find(p => p.seat === seat)?.avatarUrl ?? undefined,
      detail: `${player.tokens} ${player.tokens === 1 ? "ficha" : "fichas"}${player.out ? " · Eliminado" : player.protected ? " · Protegido" : ""}`,
      label: eligible.includes(seat) ? `Escolher jogador ${player.name}` : `Jogador ${player.name}`, disabled: !eligible.includes(seat), selected: target === seat })),
    hiddenSeats: view.players.flatMap((player, seat) => player.hand === null ? [seat] : []),
    selectable: hand.flatMap((card, i) => labels[i] ? [card.id] : []), labels: Object.fromEntries(hand.map((card, i) => [card.id, labels[i]])), deckLabel };
  const fallback = <div className="grid h-full content-center justify-items-center gap-4 overflow-y-auto p-4">
    <p className="text-sm text-muted">Visualização 3D indisponível.</p>
    <Button disabled={!canDraw} aria-label={deckLabel} onClick={onDraw}><LoveCard mode={view.mode} small />{state.deck.length}</Button>
    <div className="flex gap-3">{hand.map((card, index) => labels[index] ? <Button key={card.id} variant="ghost" className="h-auto p-0" aria-label={labels[index]} onClick={() => onCard(index)}><LoveCard mode={view.mode} value={card.value < 0 ? undefined : card.value} /></Button> : <LoveCard key={card.id} mode={view.mode} value={card.value < 0 ? undefined : card.value} />)}</div>
    <div className="flex flex-wrap gap-2">{eligible.filter(seat => seat !== viewer).map(seat => <Button key={seat} onClick={() => onSeat(seat)} aria-label={`Escolher jogador ${view.players[seat].name}`}>{view.players[seat].name}</Button>)}</div>
  </div>;
  return <div ref={root} data-testid="love-table-scene" className="relative h-[min(65dvh,42rem)] min-h-[28rem] overflow-hidden rounded-panel" data-lenis-prevent>
    <span className="sr-only">{view.players.flatMap((player, seat) => player.hand === null ? Array.from({ length: player.handCount }, (_, index) => <span key={`${seat}:${index}`} aria-label="Carta oculta">Carta oculta de {player.name}</span>) : [])}</span>
    <TableSceneBoundary fallback={fallback}><Scene fallback={fallback} settings={settings} layout={layout} state={state} presentation={presentation} selected={hand.find(c => c.value === selected)?.id ?? null} focus={0} reducedMotion={reduced} canDraw={canDraw}
      onDeckChange={onDeckChange} onDiscardChange={onDiscardChange} onDraw={onDraw} onSelect={id => { const index = hand.findIndex(card => card.id === id); if (index >= 0) onCard(index); }} onMenu={() => {}} onTurn={onSeat} /></TableSceneBoundary>
  </div>;
}
