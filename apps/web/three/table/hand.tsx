import { handPlacements, handWindow, worldHandPose, type HandOptions, type SeatPlacement } from "./layout";
import type { CardTarget } from "./motion";
export type VisualCard = import("./model").LabCard;
/** Produces world-space targets; the shared card layer owns rendering and identity across zones. */
export function TableHand({ cards, seat, options, hidden, interactive, focus, selected, flipped }: {
  cards: VisualCard[]; seat: SeatPlacement; options: HandOptions; hidden: boolean; interactive: boolean;
  focus: number; selected: string | null; flipped: string[];
}): Omit<CardTarget, "motion">[] {
  const window = handWindow(cards.length, options.width, options.scale, focus, interactive, options.visibleLimit);
  const visible = cards.slice(window.start, window.start + window.length);
  const placements = handPlacements(visible.length, options);
  return visible.map((card, i) => {
    const pose = worldHandPose(placements[i], seat);
    pose.position[0] += (card.idle?.offset ?? 0) * pose.scale;
    if (flipped.includes(card.id)) pose.rotation[1] += Math.PI;
    if (card.sideways) pose.rotation[2] += Math.PI / 2;
    const concealed = card.hidden ?? hidden;
    return { ...card, pose, hidden: concealed, zone: "hand", label: concealed ? "Carta oculta" : card.label ?? `Carta ${card.value}, posição ${window.start + i + 1}`, curved: options.layout === "fan" ? (options.curve > 0 ? "fan" : false) : true, interactive, selected: selected === card.id };
  });
}
