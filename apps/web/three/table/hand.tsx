"use client";

import type { Texture } from "three";
import { TableCard } from "./card";
import { handPlacements, type HandLayout } from "./layout";

export function TableHand({ cards, textures, back, hidden, layout, spread, curve, selected, reducedMotion, onSelect, drawOrigin }: {
  cards: { id: string; value: number }[]; textures: Texture[]; back: Texture; hidden: boolean;
  layout: HandLayout; spread: number; curve: number; selected?: string | null;
  reducedMotion: boolean; onSelect?: (id: string) => void; drawOrigin?: [number, number, number];
}) {
  const placements = handPlacements(cards.length, layout, spread, curve);
  return <group>{cards.map((card, index) => <TableCard key={card.id} placement={placements[index]} face={textures[card.value]} back={back}
    hidden={hidden} selected={selected === card.id} reducedMotion={reducedMotion}
    onSelect={onSelect ? () => onSelect(card.id) : undefined} origin={drawOrigin} />)}</group>;
}

export function TablePile({ count, textures, back, faceUp = false, value = 0, reducedMotion }: {
  count: number; textures: Texture[]; back: Texture; faceUp?: boolean; value?: number; reducedMotion: boolean;
}) {
  return <group>{Array.from({ length: Math.min(count, 8) }, (_, index) => <TableCard key={index}
    placement={{ x: index * 0.009, y: index * 0.03, z: 0, rotation: faceUp ? index * 0.025 : 0 }}
    face={textures[value]} back={back} hidden={!faceUp} reducedMotion={reducedMotion} />)}</group>;
}
