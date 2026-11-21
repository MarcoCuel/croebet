"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { PCFSoftShadowMap } from "three";
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
import { sceneBounds, seatPlacements, type CardPose } from "./layout";
import type { CardTarget } from "./motion";

export type LaboratorySceneProps = {
  settings: LaboratorySettings; state: LaboratoryState; selected: string | null; focus: number;
  reducedMotion: boolean; onSelect: (id: string) => void;
};
function SceneContents({ palette, settings, state, selected, focus, reducedMotion, onSelect }: LaboratorySceneProps & { palette: TablePalette }) {
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
  const bounds = useMemo(() => sceneBounds(seats, settings.scale, settings.curve), [seats, settings.scale, settings.curve]);
  const deckHeight = Math.min(0.6, state.deck.length * settings.pileHeight);
  const deckOrigin: CardPose = { position: [-0.85, deckHeight + 0.05, -0.15], rotation: [-Math.PI / 2, 0, 0], scale: 1 };
  const targets: Omit<CardTarget, "motion">[] = seats.flatMap((seat, place) => TableHand({ cards: state.hands[seat.seat], seat,
    options: { layout: settings.layout, width: seat.width, curve: settings.curve, spacing: settings.spacing, overlap: settings.overlap,
      tilt: settings.tilt, scale: place === 0 ? settings.scale : settings.scale * 0.85, orientation: settings.orientation },
    hidden: place !== 0 && !settings.reveal, interactive: place === 0, focus: place === 0 ? focus : 0, selected, flipped: state.flipped }));
  targets.push(...TablePile({ cards: state.deck, position: [-0.85, 0.035, -0.15], height: settings.pileHeight, faceUp: false,
    moving: state.cue.kind === "collect" ? state.cue.ids : [] }));
  targets.push(...TablePile({ cards: state.discard, position: [0.85, 0.035, 0.15], height: settings.pileHeight, faceUp: true, moving: state.cue.kind === "discard" ? state.cue.ids : [] }));
  const growth = 1 + Math.max(0, settings.players - 6) * 0.07;
  return <>
    <TableCamera angle={settings.angle} bounds={bounds} />
    <TableLighting ambient={settings.ambient} intensity={settings.light} shadows={settings.shadows} />
    <TableSurface radius={settings.radius * growth + 1.3} depth={settings.depth * growth + 1.2} palette={palette} />
    {seats.map(seat => <TableSeat key={seat.seat} seat={seat} name={`Jogador ${seat.seat + 1}`} count={state.hands[seat.seat].length}
      active={settings.turn === seat.seat} local={settings.viewer === seat.seat} compact={size.width < 600 || settings.players > 6} />)}
    {targets.map(target => {
      const cue = state.motions[target.id];
      const transfer = cue && ["draw", "deal", "discard", "collect", "swap"].includes(cue.kind);
      return <TableCard key={target.id} target={{ ...target,
        origin: cue && (cue.kind === "draw" || cue.kind === "deal") ? deckOrigin : undefined,
        motion: { key: cue ? `${cue.serial}:${cue.kind}` : "layout", duration: settings.duration,
          delay: cue?.kind === "deal" ? Math.min(2, cue.order * 0.08) : 0,
          arc: transfer ? settings.arc : 0, shuffle: cue?.kind === "shuffle" },
      }} resources={resources} reducedMotion={reducedMotion || !visible} onSelect={onSelect} />;
    })}
  </>;
}
export default function LaboratoryScene(props: LaboratorySceneProps) {
  const palette = useTablePalette();
  return palette ? <SceneCanvas shadows={props.settings.shadows ? { type: PCFSoftShadowMap } : false}
    camera={{ fov: 44, near: 0.1, far: 250 }}><SceneContents {...props} palette={palette} /></SceneCanvas> : null;
}
