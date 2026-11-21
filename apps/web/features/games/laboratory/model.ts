export type LaboratorySettings = {
  players: number; counts: number[]; viewer: number; layout: "fan" | "line";
  spread: number; curve: number; angle: number; light: number; shadows: boolean; reveal: boolean;
};
/** Local preferences are untrusted too; never pass arbitrary stored values to the renderer. */
export function parseSettings(value: unknown): LaboratorySettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const number = (n: unknown, min: number, max: number, integer = false): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
  if (!number(v.players, 2, 12, true) || !number(v.viewer, 0, v.players - 1, true)
    || !Array.isArray(v.counts) || v.counts.length !== 12 || !v.counts.every(n => number(n, 0, 1000, true))
    || (v.layout !== "fan" && v.layout !== "line") || !number(v.spread, 2, 7) || !number(v.curve, 0, 3)
    || !number(v.angle, 25, 75) || !number(v.light, 0.5, 5) || typeof v.shadows !== "boolean" || typeof v.reveal !== "boolean") return null;
  return { players: v.players, counts: [...v.counts], viewer: v.viewer, layout: v.layout,
    spread: v.spread, curve: v.curve, angle: v.angle, light: v.light, shadows: v.shadows, reveal: v.reveal };
}
export const defaultSettings: LaboratorySettings = {
  players: 4, counts: Array.from({ length: 12 }, () => 7), viewer: 0,
  layout: "fan", spread: 5, curve: 1.6, angle: 50, light: 3, shadows: true, reveal: false,
};
export type LabCard = { id: string; value: number };
export function createHands(counts: number[]): LabCard[][] {
  return counts.map((count, seat) => Array.from({ length: count }, (_, index) => ({ id: `${seat}:${index}`, value: index % 10 })));
}
