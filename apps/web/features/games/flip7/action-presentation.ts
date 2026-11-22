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

/** Shared with the conventional card flight so both views keep the same cadence. */
export const drawTiming = { extraction: 0.24, reveal: 0.16, reading: 0.65, initialReading: 0.02, delivery: 0.2 };

export function scenePresentationDuration(before: Game, next: Game): number {
  if (next.lastDraw && next.lastDraw.id !== before.lastDraw?.id && before.round === next.round) {
    const target = before.forced?.target ?? before.turn;
    const parked = [next.pending, ...next.queue].some(action => action?.card.id === next.lastDraw!.id);
    const reading = before.players[target].hasDrawn ? drawTiming.reading : drawTiming.initialReading;
    return drawTiming.extraction + drawTiming.reveal + (reading + (parked ? 0 : drawTiming.delivery));
  }
  // Changes such as stopping and selecting a target also need time to be read.
  return 0.35;
}
