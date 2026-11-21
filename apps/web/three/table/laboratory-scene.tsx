"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { MoreHorizontal, GripVertical } from "lucide-react";
import { VSMShadowMap } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import type { LaboratorySettings, LaboratoryState } from "@/features/games/laboratory/model";
import { TableHand } from "./hand";
import { TablePile } from "./pile";
import { TableCard } from "./card";
import { TableCamera } from "./camera";
import { TableLighting } from "./lighting";
import { TableSeat } from "./seat";
import { useCardResources, useTablePalette, type TablePalette } from "./resources";
import { pileRotation, radians, type CardPose } from "./layout";
import type { AdaptiveTableLayout } from "./adaptive-layout";
import { useDeckDrag } from "./use-deck-drag";
import type { DeckPoint } from "./deck-placement";
import type { TableMenuHandler } from "./interaction";
import type { CardTarget } from "./motion";

export type LaboratorySceneProps = {
  settings: LaboratorySettings; layout: AdaptiveTableLayout; state: LaboratoryState; selected: string | null; focus: number;
  reducedMotion: boolean; canDraw: boolean; onMoveDeck: (point: DeckPoint) => void; onDraw: () => void; onSelect: (id: string) => void; onMenu: TableMenuHandler; onTurn: (seat: number) => void;
};
function SceneContents({ palette, settings, layout, state, selected, focus, reducedMotion, canDraw, onMoveDeck, onDraw, onSelect, onMenu, onTurn }: LaboratorySceneProps & { palette: TablePalette }) {
  const resources = useCardResources(palette);
  const { size, invalidate } = useThree();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => { setVisible(!document.hidden); invalidate(); };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [invalidate]);
  const { seats, hands, bounds, localSeat, deckPosition, fit } = layout;
  const [deckX, , deckZ] = deckPosition;
  const deckDrag = useDeckDrag({ x: deckX, z: deckZ }, { fit, angle: settings.angle, width: size.width, height: size.height, rotation: settings.deckRotation }, onMoveDeck, onDraw);
  const deckRotation = pileRotation(false); deckRotation[1] = radians(settings.deckRotation);
  const deckHeight = Math.min(0.6, state.deck.length * settings.pileHeight);
  const deckOrigin: CardPose = { position: [deckX, deckHeight + 0.05, deckZ], rotation: deckRotation, scale: 1 };
  const targets: Omit<CardTarget, "motion">[] = seats.flatMap((seat, place) => TableHand({ cards: state.hands[seat.seat], seat: place === 0 ? localSeat : seat,
    options: hands[place],
    hidden: place !== 0 && !settings.reveal, interactive: place === 0, focus: place === 0 ? focus : 0, selected, flipped: state.flipped }));
  targets.push(...TablePile({ cards: state.deck, position: deckPosition, rotation: deckRotation, height: settings.pileHeight, faceUp: false,
    moving: state.cue.kind === "collect" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "deck" as const, interactive: true })));
  targets.push(...TablePile({ cards: state.discard, position: [0, 0.6, 0.15], height: settings.pileHeight, faceUp: true, rotation: pileRotation(true, settings.angle), moving: state.cue.kind === "discard" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "discard" as const })));
  return <>
    <TableCamera angle={settings.angle} bounds={bounds} />
    <TableLighting ambient={settings.ambient} intensity={settings.light} pointIntensity={settings.pointLight}
      pointHeight={settings.pointHeight} deckX={deckX} deckZ={deckZ} deckHeight={deckHeight} shadows={settings.shadows} softness={settings.shadowSoftness} opacity={settings.shadowOpacity} />
    <mesh position={[deckX, 0.01, deckZ]} rotation={[0, radians(settings.deckRotation), 0]} onPointerDown={event => { event.stopPropagation(); deckDrag.begin(event.nativeEvent); }} onClick={event => { event.stopPropagation(); deckDrag.click(); }}
      onContextMenu={event => { event.stopPropagation(); event.nativeEvent.preventDefault(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>
      <boxGeometry args={[1.15, 0.03, 0.8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <Html position={[deckX, 0.06, deckZ + 0.95]} center zIndexRange={[14, 0]}>
      <div className="flex items-center rounded-lg border border-contrast/6 bg-background/90 text-xs text-foreground">
        <button className="cursor-pointer px-2 py-1.5 disabled:cursor-default disabled:text-muted" aria-label="Comprar carta" disabled={!canDraw} onClick={onDraw}
          onContextMenu={event => { event.preventDefault(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>Deck · {state.deck.length}</button>
        <button className="touch-none cursor-grab border-l border-contrast/6 p-1.5 active:cursor-grabbing" aria-label="Mover deck" title="Arraste para mover · Setas para ajustar" onPointerDown={event => deckDrag.begin(event, false)} onKeyDown={deckDrag.key}><GripVertical className="size-3.5" /></button>
        <button className="cursor-pointer border-l border-contrast/6 p-1.5" aria-label="Ações do deck" onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); onMenu({ kind: "deck" }, { x: bounds.left, y: bounds.bottom }); }}><MoreHorizontal className="size-3.5" /></button>
      </div>
    </Html>
    {seats.map((seat, place) => seat.seat !== settings.viewer && <TableSeat key={seat.seat} seat={seat} name={`Jogador ${seat.seat + 1}`} count={state.hands[seat.seat].length}
      scale={hands[place].scale} onActivate={() => onTurn(seat.seat)} active={settings.turn === seat.seat} local={settings.viewer === seat.seat} compact={size.width < 600 || settings.players > 6} />)}
    {targets.map(target => {
      const cue = state.motions[target.id];
      const transfer = cue && ["draw", "deal", "discard", "collect", "swap"].includes(cue.kind);
      return <TableCard key={target.id} target={{ ...target,
        origin: cue && (cue.kind === "draw" || cue.kind === "deal") ? deckOrigin : undefined,
        motion: { key: cue ? `${cue.serial}:${cue.kind}` : "layout", duration: settings.duration,
          delay: cue?.kind === "deal" ? Math.min(2, cue.order * 0.08) : 0,
          arc: transfer ? settings.arc : 0, shuffle: cue?.kind === "shuffle" },
      }} resources={resources} reducedMotion={reducedMotion || !visible || (target.zone === "deck" && deckDrag.dragging)} onSelect={target.zone === "deck" ? deckDrag.click : onSelect} onDeckPointerDown={deckDrag.begin}
        onMenu={(id, point) => onMenu(target.zone === "deck" ? { kind: "deck" } : { kind: "card", id }, point)} />;
    })}
  </>;
}
export default function LaboratoryScene(props: LaboratorySceneProps) {
  const palette = useTablePalette();
  return palette ? <SceneCanvas style={{ touchAction: "none" }} orthographic dpr={[1.5, 2]} gl={{ antialias: true, alpha: true, toneMappingExposure: props.settings.exposure }} shadows={props.settings.shadows ? { type: VSMShadowMap } : false}
    camera={{ manual: true, near: 0.1, far: 250 }}><SceneContents {...props} palette={palette} /></SceneCanvas> : null;
}
