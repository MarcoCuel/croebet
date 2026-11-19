import type { Card, Game, Player } from "./types";
export const GOAL = 200;
export const modeLabel = (game: Pick<Game, "mode" | "brutal">) => game.mode === "vengeance" ? game.brutal ? "Vingança · Brutal" : "Vingança" : "Clássico";
export const isNumber = (card: Card) => ["number", "zero", "unlucky7", "lucky13"].includes(card.type);
export const numbers = (player: Player) => player.cards.filter(isNumber);
export const canStay = (player: Player, game: Game) => game.mode === "vengeance"
  ? player.hasDrawn && !player.cards.some(c => c.type === "zero")
  : numbers(player).length > 0;
export function score(player: Player, game?: Game): number {
  const values = numbers(player);
  if (game?.mode === "vengeance") {
    let result = 0;
    if (player.status !== "busted" && !(player.cards.some(c => c.type === "zero") && values.length < 7)) {
      result = values.reduce((sum, c) => sum + c.value, 0);
      if (player.cards.some(c => c.type === "halve")) result = Math.floor(result / 2);
      result -= player.cards.filter(c => c.type === "minus").reduce((sum, c) => sum + c.value, 0);
      if (!game.brutal) result = Math.max(0, result);
      if (values.length >= 7 && game.bonusChoice == null && game.bonusTarget == null) result += 15;
    } else if (player.status === "busted" && game.brutal) {
      result = 0 - player.cards.filter(c => c.type === "minus" && !player.bustedCards?.includes(c.id)).reduce((sum, c) => sum + c.value, 0);
    }
    if (game.bonusTarget != null && game.players[game.bonusTarget] === player) result -= 15;
    return result;
  }
  if (player.status === "busted") return 0;
  return values.reduce((sum, c) => sum + c.value, 0) * (player.cards.some(c => c.type === "double") ? 2 : 1)
    + player.cards.filter(c => c.type === "bonus").reduce((sum, c) => sum + c.value, 0)
    + (values.length === 7 ? 15 : 0);
}
export function cardLabel(card: Card): string {
  if (card.type === "number") return String(card.value);
  if (card.type === "bonus") return `+${card.value}`;
  if (card.type === "minus") return `−${card.value}`;
  return ({ double: "×2", chance: "Segunda chance", freeze: "Congelar", three: "Compre 3", zero: "O Zero", unlucky7: "7 de merda", lucky13: "13 da sorte", halve: "÷2", one: "Só mais uma!", four: "Compre 4", steal: "Roubar", swap: "Trocar", remove: "Descartar" } as const)[card.type];
}
