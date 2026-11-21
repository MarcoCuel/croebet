import { pilePose, type Vec3 } from "./layout";
import type { CardTarget } from "./motion";
import type { VisualCard } from "./hand";
/** Static layers use representative cards; transfers keep their own IDs until the next action. */
export function TablePile({ cards, position, height, faceUp, moving = [] }: {
  cards: VisualCard[]; position: Vec3; height: number; faceUp: boolean; moving?: string[];
}): Omit<CardTarget, "motion">[] {
  const layers = Math.min(cards.length, 16);
  const visible = new Set(Array.from({ length: layers }, (_, i) => Math.round(i * (cards.length - 1) / Math.max(1, layers - 1))));
  cards.forEach((card, i) => { if (moving.includes(card.id)) visible.add(i); });
  // Compress very large stacks rather than stretching the camera beyond the table.
  const step = height * Math.min(1, 2 / Math.max(height, cards.length * height));
  return [...visible].sort((a, b) => a - b).map(index => ({ ...cards[index],
    pose: pilePose(index, position, step, faceUp), hidden: !faceUp }));
}
