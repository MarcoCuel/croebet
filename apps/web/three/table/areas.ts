import type { LabCard } from "./model.ts";
import { pileRotation, type SeatPlacement } from "./layout.ts";
import type { CardTarget } from "./motion.ts";

/** Public cards stay with their owner, below the opponent hand or above the local fan. */
export function exposedTargets(cards: LabCard[], seat: SeatPlacement, local: boolean, scale: number, angle: number): Omit<CardTarget, "motion">[] {
  const size = Math.min(0.65, scale * 0.58);
  const columns = Math.max(1, Math.min(7, Math.floor(seat.width / (size * 0.42))));
  return cards.map((card, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    const count = Math.min(columns, cards.length - row * columns);
    return { ...card, zone: "exposed", hidden: card.hidden ?? false, interactive: false,
      label: card.hidden ? "Carta oculta" : card.label ?? `Carta jogada ${card.value}`,
      pose: { position: [seat.position[0] + (col - (count - 1) / 2) * size * 0.44,
        seat.position[1] + 0.12 + index * 0.003,
        seat.position[2] + (local ? -1.9 - scale * 1.1 - row * 0.7 : 0.95 + row * 0.7)], rotation: pileRotation(true, angle), scale: size } };
  });
}
