import type { LoveView } from "@croebet/shared";
import type { LaboratoryState, LabCard } from "@/three/table/model";

type LoveTableState = LaboratoryState & { round: number; discardSlots: Record<string, string> };

/** Reconcile only the public/private view supplied to this observer, never infer concealed values. */
export function loveTableState(view: LoveView, viewer: number | undefined, drawn: boolean, previous?: LoveTableState): LoveTableState {
  if (previous?.round !== view.round) previous = undefined;
  const serial = (previous?.cue.serial ?? 0) + 1;
  const used = new Set<string>();
  const motions: LaboratoryState["motions"] = {};
  const take = (value: number, candidates: LabCard[], fallback: string, kind: "draw" | "discard") => {
    const match = candidates.find(card => card.value === value && !used.has(card.id)) ?? (kind === "discard" ? candidates.find(card => card.value === -1 && !used.has(card.id)) : undefined);
    const card = match ? { ...match, value } : { id: fallback, value };
    used.add(card.id);
    if (previous && !candidates.some(c => c.id === card.id)) motions[card.id] = { serial, kind, order: 0 };
    return card;
  };
  const discardSlots: Record<string, string> = {};
  // Discards claim matching identities before the remaining cards in each hand.
  const collected = view.players.flatMap((player, seat) => player.discard.map((value, index) => {
    const slot = `${seat}:${index}`;
    const old = previous?.discard.find(c => c.id === previous.discardSlots[slot]);
    const card = old ?? take(value, previous?.hands[seat] ?? [], `discard:${view.round}:${seat}:${index}:${serial}`, "discard");
    discardSlots[slot] = card.id;
    used.add(card.id);
    if (previous?.hands[seat]?.some(c => c.id === card.id)) motions[card.id] = { serial, kind: "discard", order: 0 };
    return card;
  }));
  const existing = new Set(collected.map(c => c.id));
  const priorIds = new Set(previous?.discard.map(c => c.id));
  const discard = [...(previous?.discard.filter(c => existing.has(c.id)) ?? []), ...collected.filter(c => !priorIds.has(c.id))];
  const hands = view.players.map((player, seat) => {
    const values = player.hand ?? Array.from({ length: player.handCount }, () => -1);
    const visible = seat === viewer && !drawn && !view.pending && view.phase === "playing" && view.turn === seat && view.legalActions.length > 0 && values.length > 1 ? values.slice(0, 1) : values;
    return visible.map((value, index) => take(value, previous?.hands[seat] ?? [], `hand:${view.round}:${seat}:${serial}:${index}`, "draw"));
  });
  const waitingDraw = viewer !== undefined && hands[viewer].length < view.players[viewer].handCount;
  const deck = Array.from({ length: view.deckCount + (waitingDraw ? 1 : 0) }, (_, i) => ({ id: `deck:${view.round}:${i}`, value: -1 }));
  const moved = Object.keys(motions);
  return { hands, deck, discard, round: view.round, discardSlots, flipped: [], motions: { ...previous?.motions, ...motions }, cue: { serial, kind: "discard", ids: moved } };
}
