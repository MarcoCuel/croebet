import type { LaboratorySettings, LabCard, LaboratoryState, MotionCue } from "../../../three/table/model.ts";
export * from "../../../three/table/model.ts";

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
