import type { LabCard } from "./model.ts";
import { pileRotation, radians } from "./layout.ts";
import type { CardTarget } from "./motion.ts";

/** Pending actions and private inspections share the temporary central workspace. */
export function stagingTargets(cards: LabCard[], center: { x: number; z: number; scale: number; rotation?: number }, angle: number, width: number): Omit<CardTarget, "motion">[] {
  const scale = Math.min(1.25, center.scale, width / 0.72);
  const step = scale * 0.76;
  const rotation = radians(center.rotation ?? 0);
  const columns = Math.max(1, Math.floor((width + scale * 0.04) / step));
  return cards.map((card, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    const count = Math.min(columns, cards.length - row * columns);
    const x = (col - (count - 1) / 2) * step, y = row * scale * 1.18;
    return { ...card, zone: "staging", hidden: card.hidden ?? false,
      pose: { position: [center.x + x * Math.cos(rotation) - y * Math.sin(rotation),
        0.8 + (x * Math.sin(rotation) + y * Math.cos(rotation)) / Math.cos(radians(angle)), center.z],
        rotation: [pileRotation(true, angle)[0], 0, rotation], scale } };
  });
}
