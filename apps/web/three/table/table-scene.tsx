"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { VSMShadowMap } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import type { LaboratorySettings, LaboratoryState } from "./model";
import { TableHand } from "./hand";
import { TablePile } from "./pile";
import { TableCard } from "./card";
import { TableCamera } from "./camera";
import { TableLighting } from "./lighting";
import { TableSeat } from "./seat";
import { useCardResources, useTablePalette, type TablePalette } from "./resources";
import { pileRotation, radians, type CardPose } from "./layout";
import type { AdaptiveTableLayout } from "./adaptive-layout";
import { usePileTransform } from "./use-pile-transform";
import { PileControls } from "./pile-controls";
import { constrainDeckTransform, constrainDiscardTransform, type PileTransform } from "./pile-transform";
import { canManipulatePile, type PileManipulation, type TableMenuHandler } from "./interaction";
import type { CardTarget } from "./motion";
import type { TableArtwork } from "./artwork";
export type TablePresentation = {
  artwork: TableArtwork; seats: { name: string; avatar?: string; detail?: string; selected?: boolean; label: string; disabled: boolean }[];
  hiddenSeats: number[]; selectable: string[]; labels: Record<string, string>; deckLabel: string;
};

export type LaboratorySceneProps = {
  pileManipulation?: PileManipulation; fallback?: ReactNode; artwork?: TableArtwork; presentation?: TablePresentation; settings: LaboratorySettings; layout: AdaptiveTableLayout; state: LaboratoryState; selected: string | null; focus: number;
  reducedMotion: boolean; canDraw: boolean; onDeckChange: (point: PileTransform) => void; onDiscardChange: (point: PileTransform) => void; onDraw: () => void; onSelect: (id: string) => void; onMenu: TableMenuHandler; onTurn: (seat: number) => void;
};
function SceneContents({ palette, pileManipulation, artwork, presentation, settings, layout, state, selected, focus, reducedMotion, canDraw, onDeckChange, onDiscardChange, onDraw, onSelect, onMenu, onTurn }: LaboratorySceneProps & { palette: TablePalette }) {
  const moveDeck = canManipulatePile(pileManipulation, "deck");
  const moveDiscard = canManipulatePile(pileManipulation, "discard");
  const resources = useCardResources(palette, presentation?.artwork ?? artwork);
  const { size, invalidate } = useThree();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => { setVisible(!document.hidden); invalidate(); };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [invalidate]);
  const { seats, hands, bounds, localSeat, deckPosition, fit } = layout;
  const [deckX, , deckZ] = deckPosition;
  const viewport = { fit, angle: settings.angle, width: size.width, height: size.height };
  const deckTransform = { x: deckX, z: deckZ, rotation: settings.deckRotation, scale: 1 };
  const discard = layout.discardTransform;
  const deckDrag = usePileTransform(deckTransform, viewport, t => constrainDeckTransform(t, viewport), onDeckChange, () => { if (canDraw) onDraw(); }, true);
  const discardDrag = usePileTransform(discard, viewport, t => constrainDiscardTransform(t, viewport, layout.obstacles), onDiscardChange, () => {}, false);
  const discardRotation = pileRotation(true, settings.angle); discardRotation[2] = radians(discard.rotation);
  const deckRotation = pileRotation(false); deckRotation[1] = radians(settings.deckRotation);
  const deckHeight = Math.min(0.6, state.deck.length * settings.pileHeight);
  const deckOrigin: CardPose = { position: [deckX, deckHeight + 0.05, deckZ], rotation: deckRotation, scale: 1 };
  const targets: Omit<CardTarget, "motion">[] = seats.flatMap((seat, place) => TableHand({ cards: state.hands[seat.seat], seat: place === 0 ? localSeat : seat,
    options: hands[place],
    hidden: presentation ? presentation.hiddenSeats.includes(seat.seat) : place !== 0 && !settings.reveal, interactive: place === 0, focus: place === 0 ? focus : 0, selected, flipped: state.flipped }));
  targets.push(...TablePile({ cards: state.deck, position: deckPosition, rotation: deckRotation, height: settings.pileHeight, faceUp: false,
    moving: state.cue.kind === "collect" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "deck" as const, interactive: true })));
  targets.push(...TablePile({ cards: state.discard, position: [discard.x, 0.6, discard.z], height: settings.pileHeight, faceUp: true, rotation: discardRotation, scale: discard.scale, moving: state.cue.kind === "discard" ? state.cue.ids : [] }).map(target => ({ ...target, zone: "discard" as const, interactive: true })));
  return <>
    <TableCamera angle={settings.angle} bounds={bounds} />
    <TableLighting ambient={settings.ambient} intensity={settings.light} pointIntensity={settings.pointLight}
      pointHeight={settings.pointHeight} deckX={deckX} deckZ={deckZ} deckHeight={deckHeight} shadows={settings.shadows} softness={settings.shadowSoftness} opacity={settings.shadowOpacity} />
    <mesh position={[deckX, 0.01, deckZ]} rotation={[0, radians(settings.deckRotation), 0]} onPointerDown={event => { event.stopPropagation(); if (moveDeck) deckDrag.begin(event.nativeEvent); }} onClick={event => { event.stopPropagation(); deckDrag.click(); }}
      onContextMenu={presentation ? undefined : event => { event.stopPropagation(); event.nativeEvent.preventDefault(); deckDrag.cancelClick(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>
      <boxGeometry args={[1.15, 0.03, 0.8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <Html position={[deckX, 0.06, deckZ + 0.95]} center zIndexRange={[19, 0]}>
      <button className="cursor-pointer select-none bg-transparent px-1 py-1 text-xs tabular-nums text-muted" aria-label={presentation?.deckLabel ?? "Comprar carta"} title={`${state.deck.length} cartas`} disabled={!!presentation && !canDraw && !moveDeck} aria-disabled={!canDraw} onClick={() => { if (canDraw) onDraw(); }}
        onKeyDown={event => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); const r = event.currentTarget.getBoundingClientRect(); onMenu({ kind: "deck" }, { x: r.left, y: r.bottom }); }
          else if (moveDeck) deckDrag.key(event, "move");
        }} onContextMenu={event => { event.preventDefault(); deckDrag.cancelClick(); onMenu({ kind: "deck" }, { x: event.clientX, y: event.clientY }); }}>{state.deck.length}</button>
    </Html>
    {moveDeck && <PileControls kind="deck" transform={deckTransform} viewport={viewport} begin={deckDrag.begin} onKey={deckDrag.key} />}
    {moveDiscard && state.discard.length > 0 && <PileControls kind="discard" transform={discard} viewport={viewport} begin={discardDrag.begin} onKey={discardDrag.key} />}
    {seats.map((seat, place) => seat.seat !== settings.viewer && <TableSeat key={seat.seat} seat={seat} name={presentation?.seats[seat.seat].name ?? `Jogador ${seat.seat + 1}`} avatar={presentation?.seats[seat.seat].avatar} detail={presentation?.seats[seat.seat].detail} label={presentation?.seats[seat.seat].label} disabled={presentation?.seats[seat.seat].disabled} selected={presentation?.seats[seat.seat].selected} count={state.hands[seat.seat].length}
      scale={hands[place].scale} onActivate={() => onTurn(seat.seat)} active={settings.turn === seat.seat} local={settings.viewer === seat.seat} compact={size.width < 600 || settings.players > 6} />)}
    {targets.map(target => {
      const cue = state.motions[target.id];
      const transfer = cue && ["draw", "deal", "discard", "collect", "swap"].includes(cue.kind);
      return <TableCard key={target.id} target={{ ...target,
        interactive: target.zone === "deck" ? moveDeck || canDraw : target.zone === "discard" ? moveDiscard : presentation ? presentation.selectable.includes(target.id) : target.interactive,
        actionLabel: presentation?.labels[target.id],
        origin: cue && (cue.kind === "draw" || cue.kind === "deal") ? deckOrigin : undefined,
        motion: { key: cue ? `${cue.serial}:${cue.kind}` : "layout", duration: settings.duration,
          delay: cue?.kind === "deal" ? Math.min(2, cue.order * 0.08) : 0,
          arc: transfer ? settings.arc : 0, shuffle: cue?.kind === "shuffle" },
      }} resources={resources} reducedMotion={reducedMotion || !visible || (target.zone === "deck" && deckDrag.dragging) || (target.zone === "discard" && discardDrag.dragging)} onSelect={target.zone === "deck" ? deckDrag.click : target.zone === "discard" ? discardDrag.click : onSelect} onPilePointerDown={target.zone === "deck" && moveDeck ? deckDrag.begin : target.zone === "discard" && moveDiscard ? discardDrag.begin : undefined}
        onMenu={(id, point) => { if (target.zone === "deck") deckDrag.cancelClick(); if (target.zone !== "discard") onMenu(target.zone === "deck" ? { kind: "deck" } : { kind: "card", id }, point); }} />;
    })}
  </>;
}
export default function LaboratoryScene(props: LaboratorySceneProps) {
  const palette = useTablePalette();
  return palette ? <SceneCanvas {...(props.fallback ? { fallback: props.fallback } : {})} style={{ touchAction: "none" }} orthographic dpr={[1.5, 2]} gl={{ antialias: true, alpha: true, toneMappingExposure: props.settings.exposure }} shadows={props.settings.shadows ? { type: VSMShadowMap } : false}
    camera={{ manual: true, near: 0.1, far: 250 }}><SceneContents {...props} palette={palette} /></SceneCanvas> : null;
}
