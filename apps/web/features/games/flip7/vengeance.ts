import type { Game } from "./types";

export const isCardAction = (game: Game) => !!game.pending?.resolving;
export function cardChoices(game: Game): number[][] {
  const pending = game.pending;
  if (!pending?.resolving) return [];
  const cards = game.players.flatMap((p, owner) => p.status === "busted" ? [] : p.cards.map(card => ({ card, owner })));
  if (pending.card.type === "swap") return cards.flatMap((a, i) => cards.slice(i + 1).filter(b => a.owner !== b.owner).map(b => [a.card.id, b.card.id]));
  return cards.filter(c => pending.card.type !== "steal" || c.owner !== pending.source).map(c => [c.card.id]);
}
export function vengeanceTargets(game: Game): number[] {
  if (!game.pending || game.pending.resolving) return [];
  const { card } = game.pending;
  return game.players.flatMap((p, i) => {
    if (p.status === "busted" && !(game.brutal && (card.type === "minus" || card.type === "halve"))) return [];
    if (["steal", "swap", "remove"].includes(card.type) && !cardChoices({ ...game, pending: { ...game.pending!, source: i, resolving: true } }).length) return [];
    return [i];
  });
}
