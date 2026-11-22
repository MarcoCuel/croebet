export type LaboratorySettings = {
  players: number; counts: number[]; viewer: number; localCardScale: number; opponentCardScale: number; localHandCurve: number;
  deckX: number; deckZ: number; deckRotation: number; deckScale: number;
  discardX: number; discardZ: number; discardRotation: number; discardScale: number;
  angle: number; light: number; ambient: number; pileHeight: number;
  pointLight: number; pointHeight: number; exposure: number; shadowSoftness: number; shadowOpacity: number;
  duration: number; arc: number; dealCount: number; turn: number; shadows: boolean; reveal: boolean;
};
export const defaultSettings: LaboratorySettings = {
  players: 4, counts: Array.from({ length: 12 }, () => 7), viewer: 0, localCardScale: 1, opponentCardScale: 1, localHandCurve: 1,
  deckX: -1.5, deckZ: -0.6, deckRotation: -18, deckScale: 1, discardX: 0, discardZ: 0.15, discardRotation: 0, discardScale: 1,
  angle: 36, light: 1.1, ambient: 1.35, pointLight: 3, pointHeight: 2.5, exposure: 1, shadowSoftness: 6, shadowOpacity: 0.35, pileHeight: 0.004,
  duration: 0.65, arc: 0.8, dealCount: 1, turn: 0, shadows: true, reveal: false,
};
const ranges = {
  localHandCurve: [0, 2], localCardScale: [0.5, 1.5], opponentCardScale: [0.5, 1.5], players: [2, 12, true], viewer: [0, 11, true], deckX: [-50, 50], deckZ: [-100, 100], deckRotation: [-180, 180], deckScale: [0.65, 1.8], discardX: [-50, 50], discardZ: [-100, 100], discardRotation: [-180, 180], discardScale: [0.65, 1.8],
  angle: [25, 65], light: [0, 2.5], ambient: [0, 2], pointLight: [0, 8], pointHeight: [1, 5], exposure: [0.5, 1.2], shadowSoftness: [1, 12], shadowOpacity: [0, 0.8], pileHeight: [0.004, 0.008], duration: [0.15, 2], arc: [0, 2],
  dealCount: [1, 10, true], turn: [0, 11, true],
} as const;
/** Migrates older local presets by supplying new defaults, while validating every stored value. */
export function parseSettings(value: unknown): LaboratorySettings | null {
  if (!value || typeof value !== "object" || !("players" in value) || !("counts" in value)) return null;
  const v = { ...defaultSettings, ...value } as Record<string, unknown>;
  // Older presets used exaggerated stack spacing; retain their other preferences.
  if (typeof v.pileHeight === "number" && v.pileHeight >= 0.01 && v.pileHeight <= 0.06) v.pileHeight = defaultSettings.pileHeight;
  // Restore older presets with the new softer lighting, preserving their table layout.
  if (!("exposure" in value)) {
    if (typeof v.light === "number" && v.light >= 0.5 && v.light <= 5) v.light = defaultSettings.light;
    if (typeof v.ambient === "number" && v.ambient >= 0.2 && v.ambient <= 3) v.ambient = defaultSettings.ambient;
  }
  if (v.ambient === 0.55 && v.exposure === 0.85 && v.light === 1.1) {
    v.ambient = defaultSettings.ambient; v.exposure = defaultSettings.exposure;
  }
  for (const [key, range] of Object.entries(ranges)) {
    const n = v[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < range[0] || n > range[1] || (range.length === 3 && !Number.isInteger(n))) return null;
  }
  if ((v.viewer as number) >= (v.players as number) || (v.turn as number) >= (v.players as number)
    || !Array.isArray(v.counts) || v.counts.length !== 12 || !v.counts.every(n => Number.isInteger(n) && n >= 0 && n <= 1000)
    || typeof v.shadows !== "boolean" || typeof v.reveal !== "boolean") return null;
  return Object.fromEntries(Object.keys(defaultSettings).map(key => [key, v[key]])) as LaboratorySettings;
}
export type LabCard = { id: string; value: number };
export type MotionKind = "draw" | "discard" | "deal" | "flip" | "swap" | "collect" | "shuffle";
export type MotionCue = { serial: number; kind: MotionKind; ids: string[] };
export type LaboratoryState = { hands: LabCard[][]; deck: LabCard[]; discard: LabCard[]; flipped: string[]; cue: MotionCue; motions: Record<string, { serial: number; kind: MotionKind; order: number }> };
