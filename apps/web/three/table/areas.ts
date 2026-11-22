import type { LabCard } from "./model.ts";
import { pileRotation, radians, type SeatPlacement } from "./layout.ts";
import type { CardTarget } from "./motion.ts";

/** Public cards stay with their owner, below the opponent hand or above the local fan. */
export function exposedTargets(cards: LabCard[], seat: SeatPlacement, local: boolean, scale: number, angle: number, spread = false): Omit<CardTarget, "motion">[] {
  const size = Math.min(0.65, scale * 0.58);
  const step = size * (spread ? 0.76 : 0.44);
  const columns = Math.max(1, Math.min(7, Math.floor(seat.width / (spread ? step : size * 0.42))));
  const rowStep = spread ? size * 1.18 / Math.sin(radians(angle)) : 0.7;
  return cards.map((card, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    const count = Math.min(columns, cards.length - row * columns);
    return { ...card, zone: "exposed", hidden: card.hidden ?? false, interactive: false,
      label: card.hidden ? "Carta oculta" : card.label ?? `Carta jogada ${card.value}`,
      pose: { position: [seat.position[0] + (col - (count - 1) / 2) * step,
        seat.position[1] + 0.12 + index * 0.003,
        seat.position[2] + (local ? -1.9 - scale * 1.1 - row * rowStep : 0.95 + row * rowStep)], rotation: pileRotation(true, angle), scale: size } };
  });
}

/** Pending actions and private inspections share the temporary central workspace. */
export function stagingTargets(cards: LabCard[], center: { x: number; z: number; scale: number }, angle: number, width: number): Omit<CardTarget, "motion">[] {
  const scale = Math.min(1.25, center.scale, width / 0.72);
  const step = scale * 0.76;
  const columns = Math.max(1, Math.floor((width + scale * 0.04) / step));
  return cards.map((card, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    const count = Math.min(columns, cards.length - row * columns);
    return { ...card, zone: "staging", hidden: card.hidden ?? false,
      pose: { position: [center.x + (col - (count - 1) / 2) * step,
        0.8 + row * scale * 1.18 / Math.cos(radians(angle)), center.z],
        rotation: pileRotation(true, angle), scale } };
  });
}
