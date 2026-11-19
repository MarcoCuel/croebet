// Presentation helpers only. Rule execution lives in the API.
import type { Game } from "./types";
import { vengeanceTargets } from "./vengeance";
export type { Action, Card, Game, GameMode, GameOptions, Player, PlayerKind, Setup } from "./types";
export { canStay, cardLabel, GOAL, isNumber, modeLabel, numbers, score } from "./rules";
export function targets(game: Game): number[] {
  if (game.mode === "vengeance") return vengeanceTargets(game);
  if (!game.pending) return [];
  const { source, give } = game.pending;
  return game.players.flatMap((p, i) => p.status === "playing" && (!give || (i !== source && !p.cards.some(c => c.type === "chance"))) ? [i] : []);
}
