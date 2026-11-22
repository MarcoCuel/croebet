import type { LoveView } from "@croebet/shared";
import type { LaboratoryState, LabCard } from "@/three/table/model";

type LoveTableState = LaboratoryState & { round: number; discardSlots: Record<string, string>; pending: boolean; logLength: number };

/** Reconcile only the public/private view supplied to this observer, never infer concealed values. */
export function loveTableState(view: LoveView, viewer: number | undefined, previous?: LoveTableState): LoveTableState {
  const newRound = !!previous && previous.round !== view.round;
  const serial = (previous?.cue.serial ?? 0) + 1;
  if (previous?.round !== view.round) previous = undefined;
  const used = new Set<string>();
  const motions: LaboratoryState["motions"] = {};
  const take = (value: number, candidates: LabCard[], fallback: string, kind: "draw" | "discard") => {
    const match = candidates.find(card => card.value === value && !used.has(card.id))
      ?? candidates.find(card => !used.has(card.id) && (card.value === -1 || value === -1));
    const card = match ? { ...match, value } : { id: fallback, value };
    used.add(card.id);
    if (previous && !candidates.some(c => c.id === card.id)) motions[card.id] = { serial, kind, order: 0 };
    return card;
  };
  const discardSlots: Record<string, string> = {};
  // Discards claim matching identities before the remaining cards in each hand.
  const exposed = view.players.map((player, seat) => player.discard.map((value, index) => {
    const slot = `${seat}:${index}`;
    const old = previous?.exposed?.flat().find(c => c.id === previous.discardSlots[slot]);
    const card = old ?? take(value, previous?.hands[seat] ?? [], `discard:${view.round}:${seat}:${index}:${serial}`, "discard");
    discardSlots[slot] = card.id;
    used.add(card.id);
    if (previous?.hands[seat]?.some(c => c.id === card.id)) motions[card.id] = { serial, kind: "discard", order: 0 };
    return { ...card, hidden: false };
  }));
  // The public King action identifies the two seats; concealed values are never guessed.
  const swapped = new Map<number, number>();
  if (previous) for (const [source, player] of view.players.entries()) {
    const king = view.mode === "classic" ? 6 : 7;
    if (player.discard.at(-1) !== king || player.discard.length === (previous.exposed?.[source]?.length ?? 0)) continue;
    const targets = view.players.flatMap((other, seat) => seat !== source && view.log.slice(previous.logLength).includes(`${player.name} jogou ${king} em ${other.name}.`) ? [seat] : []);
    if (targets.length === 1) { swapped.set(source, targets[0]); swapped.set(targets[0], source); }
  }
  const hands = view.players.map((player, seat) => {
    const values = player.hand ?? Array.from({ length: player.handCount }, () => -1);
    return values.map((value, index) => {
      const source = swapped.get(seat) ?? seat;
      const card = { ...take(value, previous?.hands[source] ?? [], `hand:${view.round}:${seat}:${serial}:${index}`, "draw"), hidden: value < 0 };
      if (source !== seat) motions[card.id] = { serial, kind: "swap", order: 0 };
      if (newRound) motions[card.id] = { serial, kind: index === 0 ? "deal" : "draw", order: (seat - view.turn + view.players.length) % view.players.length };
      return card;
    });
  });
  const deck = Array.from({ length: view.deckCount }, (_, i) => ({ id: `deck:${view.round}:${i}`, value: -1 }));
  if (previous?.pending && !view.pending && viewer !== undefined) {
    const returned = previous.hands[viewer].filter(card => !used.has(card.id));
    returned.slice(0, deck.length).forEach((card, index) => {
      deck[index] = { id: card.id, value: -1 };
      motions[card.id] = { serial, kind: "collect", order: index };
    });
  }
  const moved = Object.keys(motions);
  return { hands, deck, discard: [], exposed, round: view.round, pending: view.pending, logLength: view.log?.length ?? 0, discardSlots, flipped: [], motions, cue: { serial, kind: "discard", ids: moved } };
}
