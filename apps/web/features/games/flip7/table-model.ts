import type { Card, Game } from "./types.ts";
import type { LabCard, TableState } from "../../../three/table/model.ts";

export const cardFace = (card: Card) => `${card.type}:${card.value}`;
const numeric = (card: Card) => ["number", "zero", "unlucky7", "lucky13"].includes(card.type);
export function flipTableState(game: Game, previous?: TableState, held?: { card: Card; target: number } | null): TableState {
  const serial = (previous?.cue.serial ?? 0) + 1;
  const visual = (card: Card): LabCard => ({ id: `card:${card.id}`, value: card.value, face: cardFace(card), hidden: false });
  const staging = [game.pending, ...game.queue].flatMap(action => action ? [visual(action.card)] : []);
  const hands = game.players.map((player, seat) => {
    const all = [...player.cards];
    if (held?.target === seat && !all.some(card => card.id === held.card.id)) all.push(held.card);
    const sorted = [...all.filter(numeric).sort((a, b) => a.value - b.value), ...all.filter(card => !numeric(card))];
    const six = sorted.findIndex(card => card.type === "number" && card.value === 6);
    const sixSeven = six >= 0 && sorted.some(card => card.type === "number" && card.value === 7);
    const sixNine = six >= 0 && sorted[six + 1]?.type === "number" && sorted[six + 1]?.value === 9;
    const firstNumber = sorted.find(numeric)?.id, firstModifier = sorted.find(card => !numeric(card))?.id;
    return sorted.map(card => ({ ...visual(card),
      glow: card.type === "lucky13",
      idle: player.status !== "busted" && card.type === "number" && ((sixSeven && [6, 7].includes(card.value)) || (sixNine && [6, 9].includes(card.value)))
        ? { angle: 0.025, phase: card.value === 6 ? 0 : Math.PI, offset: sixNine && [6, 9].includes(card.value) ? card.value === 6 ? 0.07 : -0.07 : 0 } : undefined,
      hidden: player.status === "busted" && held?.card.id !== card.id && (game.mode !== "vengeance" || player.bustedCards?.includes(card.id) !== false),
      sideways: game.mode === "vengeance" && player.status === "stayed" && (card.id === firstNumber || card.id === firstModifier) }));
  });
  const motions: TableState["motions"] = {};
  if (previous) {
    const previousZone = new Map<string, string>();
    previous.hands.forEach((hand, seat) => hand.forEach(card => previousZone.set(card.id, `hand:${seat}`)));
    previous.discard.forEach(card => previousZone.set(card.id, "discard"));
    previous.staging?.forEach(card => previousZone.set(card.id, "staging"));
    const move = (card: LabCard, zone: string) => {
      const from = previousZone.get(card.id);
      if (from !== zone) motions[card.id] = { serial, kind: !from ? "draw" : zone === "discard" ? "discard" : "swap", order: 0,
        ...(!from && zone !== "staging" ? { via: "reveal" as const, hold: 0.45 } : {}) };
    };
    hands.forEach((hand, seat) => hand.forEach(card => move(card, `hand:${seat}`)));
    staging.forEach(card => move(card, "staging"));
  }
  // The engine retains spent cards for conservation/reshuffling; the table only
  // presents unresolved actions here, never the accumulated discard pile.
  return { hands, handLayout: "spread", discard: [], staging, stagingArea: "discard", deck: Array.from({ length: game.deckCount }, (_, index) => ({ id: `deck:${game.round}:${index}`, value: -1 })),
    motions, flipped: [], cue: { serial, kind: "draw", ids: Object.keys(motions) } };
}
