export type LaboratorySettings = {
  players: number; counts: number[]; viewer: number; layout: "fan" | "line";
  spread: number; curve: number; spacing: number; overlap: number; tilt: number; scale: number; orientation: number;
  radius: number; depth: number; angle: number; light: number; ambient: number; pileHeight: number;
  duration: number; arc: number; dealCount: number; turn: number; shadows: boolean; reveal: boolean;
};
export const defaultSettings: LaboratorySettings = {
  players: 4, counts: Array.from({ length: 12 }, () => 7), viewer: 0, layout: "fan",
  spread: 5.5, curve: 1.2, spacing: 0.76, overlap: 0.35, tilt: 14, scale: 1.15, orientation: 0,
  radius: 4, depth: 3.2, angle: 36, light: 3, ambient: 1.2, pileHeight: 0.022,
  duration: 0.65, arc: 0.8, dealCount: 1, turn: 0, shadows: true, reveal: false,
};
const ranges = {
  players: [2, 12, true], viewer: [0, 11, true], spread: [2, 9], curve: [0, 3], spacing: [0.2, 1.2],
  overlap: [0, 0.9], tilt: [0, 45], scale: [0.5, 1.8], orientation: [-45, 45], radius: [2.5, 7], depth: [2, 6],
  angle: [25, 65], light: [0.5, 5], ambient: [0.2, 3], pileHeight: [0.01, 0.06], duration: [0.15, 2], arc: [0, 2],
  dealCount: [1, 10, true], turn: [0, 11, true],
} as const;
/** Migrates older local presets by supplying new defaults, while validating every stored value. */
export function parseSettings(value: unknown): LaboratorySettings | null {
  if (!value || typeof value !== "object" || !("players" in value) || !("counts" in value)) return null;
  const v = { ...defaultSettings, ...value } as Record<string, unknown>;
  for (const [key, range] of Object.entries(ranges)) {
    const n = v[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < range[0] || n > range[1] || (range.length === 3 && !Number.isInteger(n))) return null;
  }
  if ((v.viewer as number) >= (v.players as number) || (v.turn as number) >= (v.players as number)
    || !Array.isArray(v.counts) || v.counts.length !== 12 || !v.counts.every(n => Number.isInteger(n) && n >= 0 && n <= 1000)
    || !["fan", "line"].includes(String(v.layout)) || typeof v.shadows !== "boolean" || typeof v.reveal !== "boolean") return null;
  return Object.fromEntries(Object.keys(defaultSettings).map(key => [key, v[key]])) as LaboratorySettings;
}
export type LabCard = { id: string; value: number };
export type MotionKind = "draw" | "discard" | "deal" | "flip" | "swap" | "collect" | "shuffle";
export type MotionCue = { serial: number; kind: MotionKind; ids: string[] };
export type LaboratoryState = { hands: LabCard[][]; deck: LabCard[]; discard: LabCard[]; flipped: string[]; cue: MotionCue; motions: Record<string, { serial: number; kind: MotionKind; order: number }> };
export function createHands(counts: number[]): LabCard[][] {
  return counts.map((count, seat) => Array.from({ length: count }, (_, index) => ({ id: `hand:${seat}:${index}`, value: index % 10 })));
}
export function initialState(settings: LaboratorySettings): LaboratoryState {
  return { hands: createHands(settings.counts), deck: Array.from({ length: 104 }, (_, i) => ({ id: `deck:${i}`, value: i % 10 })),
    discard: [], flipped: [], motions: {}, cue: { serial: 0, kind: "deal", ids: [] } };
}
export type LabAction =
  | { type: "reset"; settings: LaboratorySettings }
  | { type: "count"; seat: number; count: number }
  | { type: "draw"; seat: number }
  | { type: "deal"; players: number; count: number }
  | { type: "discard"; seat: number; id: string }
  | { type: "flip"; seat: number; id: string }
  | { type: "swap"; seat: number; target: number; id: string }
  | { type: "collect"; players: number }
  | { type: "shuffle"; order: number[] };
export function laboratoryReducer(state: LaboratoryState, action: LabAction): LaboratoryState {
  if (action.type === "reset") return initialState(action.settings);
  const hands = state.hands.map(hand => [...hand]); const deck = [...state.deck]; const discard = [...state.discard];
  let flipped = state.flipped; const moved: string[] = [];
  if (action.type === "count") {
    const hand = hands[action.seat];
    hands[action.seat] = Array.from({ length: action.count }, (_, i) => hand[i] ?? ({ id: `new:${state.cue.serial + 1}:${action.seat}:${i}`, value: i % 10 }));
  } else if (action.type === "draw" || action.type === "deal") {
    const seats = action.type === "draw" ? [action.seat] : Array.from({ length: action.players * action.count }, (_, i) => i % action.players);
    for (const seat of seats) { if (hands[seat].length >= 1000) continue; const card = deck.pop(); if (!card) break; hands[seat].push(card); moved.push(card.id); }
  } else if (action.type === "discard" || action.type === "flip" || action.type === "swap") {
    const index = hands[action.seat].findIndex(card => card.id === action.id);
    if (index < 0) return state;
    moved.push(action.id);
    if (action.type === "flip") flipped = flipped.includes(action.id) ? flipped.filter(id => id !== action.id) : [...flipped, action.id];
    else {
      if (action.type === "swap" && (action.target === action.seat || hands[action.target].length >= 1000)) return state;
      const [card] = hands[action.seat].splice(index, 1);
      if (action.type === "discard") discard.push(card);
      else { const other = hands[action.target].pop(); hands[action.target].push(card); if (other) { hands[action.seat].splice(index, 0, other); moved.push(other.id); } }
    }
  } else if (action.type === "collect") {
    for (let seat = 0; seat < action.players; seat++) { moved.push(...hands[seat].map(card => card.id)); deck.push(...hands[seat]); hands[seat] = []; }
    moved.push(...discard.map(card => card.id)); deck.push(...discard); discard.length = 0; flipped = [];
  } else {
    if (action.order.length !== deck.length || new Set(action.order).size !== deck.length || action.order.some(i => !Number.isInteger(i) || i < 0 || i >= deck.length)) return state;
    deck.splice(0, deck.length, ...action.order.map(i => state.deck[i])); moved.push(...deck.map(card => card.id));
  }
  const cue: MotionCue = { serial: state.cue.serial + 1, kind: action.type === "count" ? "deal" : action.type, ids: moved };
  const motions = { ...state.motions };
  moved.forEach((id, order) => { motions[id] = { serial: cue.serial, kind: cue.kind, order }; });
  return { hands, deck, discard, flipped, cue, motions };
}
