import { handPlacements, handWindow, worldHandPose, type HandOptions, type SeatPlacement } from "./layout";
import type { CardTarget } from "./motion";
export type VisualCard = { id: string; value: number };
/** Produces world-space targets; the shared card layer owns rendering and identity across zones. */
export function TableHand({ cards, seat, options, hidden, interactive, focus, selected, flipped }: {
  cards: VisualCard[]; seat: SeatPlacement; options: HandOptions; hidden: boolean; interactive: boolean;
  focus: number; selected: string | null; flipped: string[];
}): Omit<CardTarget, "motion">[] {
  const window = handWindow(cards.length, options.width, options.scale, focus, interactive);
  const visible = cards.slice(window.start, window.start + window.length);
  const placements = handPlacements(visible.length, options);
  return visible.map((card, i) => {
    const pose = worldHandPose(placements[i], seat);
    if (flipped.includes(card.id)) pose.rotation[1] += Math.PI;
    return { ...card, pose, hidden, zone: "hand", label: `Carta ${card.value}, posição ${window.start + i + 1}`, curved: true, revealBack: !interactive && !hidden, interactive, selected: selected === card.id };
  });
}
