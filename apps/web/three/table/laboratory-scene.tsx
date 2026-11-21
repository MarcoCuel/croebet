"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { MoreHorizontal } from "lucide-react";
import { VSMShadowMap } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import type { LaboratorySettings, LaboratoryState } from "@/features/games/laboratory/model";
import { TableHand } from "./hand";
import { TablePile } from "./pile";
import { TableCard } from "./card";
import { TableCamera } from "./camera";
import { TableLighting } from "./lighting";
import { TableSeat } from "./seat";
import { TableSurface } from "./table";
import { useCardResources, useTablePalette, type TablePalette } from "./resources";
import { sceneBounds, seatPlacements, viewHandOptions, type CardPose, type HandOptions } from "./layout";
import type { TableMenuHandler } from "./interaction";
import type { CardTarget } from "./motion";

export type LaboratorySceneProps = {
  settings: LaboratorySettings; state: LaboratoryState; selected: string | null; focus: number;
  reducedMotion: boolean; canDraw: boolean; onDraw: () => void; onSelect: (id: string) => void; onMenu: TableMenuHandler; onTurn: (seat: number) => void;
};
function SceneContents({ palette, settings, state, selected, focus, reducedMotion, canDraw, onDraw, onSelect, onMenu, onTurn }: LaboratorySceneProps & { palette: TablePalette }) {
  const resources = useCardResources(palette);
  const { size, invalidate } = useThree();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => { setVisible(!document.hidden); invalidate(); };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [invalidate]);
  const seats = useMemo(() => seatPlacements(settings.players, settings.viewer, settings.radius, settings.depth, settings.spread),
    [settings.players, settings.viewer, settings.radius, settings.depth, settings.spread]);
  const handOptions: HandOptions = useMemo(() => ({ layout: settings.layout, width: settings.spread, curve: settings.curve,
    spacing: settings.spacing, overlap: settings.overlap, tilt: settings.tilt, scale: settings.scale, orientation: settings.orientation }),
    [settings.layout, settings.spread, settings.curve, settings.spacing, settings.overlap, settings.tilt, settings.scale, settings.orientation]);
  // Fixed capacity bounds avoid camera jumps when drawing or discarding within a hand window.
  const bounds = useMemo(() => sceneBounds(seats, handOptions, Array(12).fill(1000), settings.angle), [seats, handOptions, settings.angle]);
  const deckHeight = Math.min(0.6, state.deck.length * settings.pileHeight);
  const deckOrigin: CardPose = { position: [-0.85, deckHeight + 0.05, -0.15], rotation: [-Math.PI / 2, 0, 0], scale: 1 };
  const targets: Omit<CardTarget, "motion">[] = seats.flatMap((seat, place) => TableHand({ cards: state.hands[seat.seat], seat,
    options: viewHandOptions({ ...handOptions, width: seat.width }, place === 0, settings.angle),
    hidden: place !== 0 && !settings.reveal, interactive: place === 0, focus: place === 0 ? focus : 0, selected, flipped: state.flipped }));
  targets.push(...TablePile({ cards: state.deck, position: [-0.85, 0.035, -0.15], height: settings.pileHeight, faceUp: false,
    moving: state.cue.kind === "collect" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "deck" as const, interactive: true })));
  targets.push(...TablePile({ cards: state.discard, position: [0.85, 0.035, 0.15], height: settings.pileHeight, faceUp: true, moving: state.cue.kind === "discard" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "discard" as const })));
  const growth = 1 + Math.max(0, settings.players - 6) * 0.07;
  return <>
    <TableCamera angle={settings.angle} bounds={bounds} />
    <TableLighting ambient={settings.ambient} intensity={settings.light} pointIntensity={settings.pointLight}
      pointHeight={settings.pointHeight} deckHeight={deckHeight} shadows={settings.shadows} softness={settings.shadowSoftness} opacity={settings.shadowOpacity} />
    <TableSurface radius={settings.radius * growth} depth={settings.depth * growth} angle={settings.angle} bounds={bounds} palette={palette} />
    <mesh position={[-0.85, 0.01, -0.15]} onClick={event => { event.stopPropagation(); onDraw(); }}
      onContextMenu={event => { event.stopPropagation(); event.nativeEvent.preventDefault(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>
      <boxGeometry args={[0.8, 0.03, 1.15]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <Html position={[-0.85, 0.06, 0.8]} center zIndexRange={[14, 0]}>
      <div className="flex items-center rounded-lg border border-contrast/6 bg-background/90 text-xs text-foreground">
        <button className="cursor-pointer px-2 py-1.5 disabled:cursor-default disabled:text-muted" aria-label="Comprar carta" disabled={!canDraw} onClick={onDraw}
          onContextMenu={event => { event.preventDefault(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>Deck · {state.deck.length}</button>
        <button className="cursor-pointer border-l border-contrast/6 p-1.5" aria-label="Ações do deck" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); onMenu({ kind: "deck" }, { x: bounds.left, y: bounds.bottom }); }}><MoreHorizontal className="size-3.5" /></button>
      </div>
    </Html>
    {seats.map(seat => <TableSeat key={seat.seat} seat={seat} name={`Jogador ${seat.seat + 1}`} count={state.hands[seat.seat].length}
      scale={viewHandOptions(handOptions, settings.viewer === seat.seat, settings.angle).scale} onActivate={() => onTurn(seat.seat)} active={settings.turn === seat.seat} local={settings.viewer === seat.seat} compact={size.width < 600 || settings.players > 6} />)}
    {targets.map(target => {
      const cue = state.motions[target.id];
      const transfer = cue && ["draw", "deal", "discard", "collect", "swap"].includes(cue.kind);
      return <TableCard key={target.id} target={{ ...target,
        origin: cue && (cue.kind === "draw" || cue.kind === "deal") ? deckOrigin : undefined,
        motion: { key: cue ? `${cue.serial}:${cue.kind}` : "layout", duration: settings.duration,
          delay: cue?.kind === "deal" ? Math.min(2, cue.order * 0.08) : 0,
          arc: transfer ? settings.arc : 0, shuffle: cue?.kind === "shuffle" },
      }} resources={resources} reducedMotion={reducedMotion || !visible} onSelect={target.zone === "deck" ? onDraw : onSelect}
        onMenu={(id, point) => onMenu(target.zone === "deck" ? { kind: "deck" } : { kind: "card", id }, point)} />;
    })}
  </>;
}
export default function LaboratoryScene(props: LaboratorySceneProps) {
  const palette = useTablePalette();
  return palette ? <SceneCanvas orthographic gl={{ toneMappingExposure: props.settings.exposure }} shadows={props.settings.shadows ? { type: VSMShadowMap } : false}
    camera={{ manual: true, near: 0.1, far: 250 }}><SceneContents {...props} palette={palette} /></SceneCanvas> : null;
}
