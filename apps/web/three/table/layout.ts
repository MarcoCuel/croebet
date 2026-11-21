export type HandLayout = "fan" | "line";
export type CardPlacement = { x: number; y: number; z: number; rotation: number };

/** Bounded visible window keeps large hands readable without mounting every card. */
export function handPlacements(count: number, layout: HandLayout, spread: number, curve: number): CardPlacement[] {
  const width = Math.min(spread, Math.max(0, count - 1) * 0.76);
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1) - 0.5;
    return { x: t * width, y: index * 0.008, z: layout === "fan" ? t * t * curve : 0, rotation: layout === "fan" ? -t * curve * 0.45 : 0 };
  });
}
