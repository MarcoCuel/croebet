import type { Card, Game } from "./types";

export type ForcedActionPresentation = { card: Card; target: number };

/** Forced action cards are discarded by the engine, but remain visible until their effect finishes. */
export function forcedActionPresentation(game: Game | null): ForcedActionPresentation | null {
  if (game?.mode !== "vengeance" || !game.forced) return null;
  const { target, stopAfter } = game.forced;
  const type = stopAfter ? "one" : "four";
  const entry = game.log.find(entry => entry.player === target && entry.card?.type === type
    && game.discard.some(card => card.id === entry.card!.id));
  return entry?.card ? { card: entry.card, target } : null;
}
