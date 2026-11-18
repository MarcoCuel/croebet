import type { Card, Game, GameMode, Player } from "./types";
export const GOAL = 200;
export const modeLabel = (game: Pick<Game, "mode" | "brutal">) => game.mode === "vengeance" ? game.brutal ? "Vingança · Brutal" : "Vingança" : "Clássico";
export const isNumber = (card: Card) => ["number", "zero", "unlucky7", "lucky13"].includes(card.type);
export const numbers = (player: Player) => player.cards.filter(isNumber);
export const canStay = (player: Player, game: Game) => game.mode === "vengeance"
  ? player.hasDrawn && !player.cards.some(c => c.type === "zero")
  : numbers(player).length > 0;
export function createDeck(mode: GameMode = "classic"): Card[] {
  const cards: Card[] = [];
  const add = (type: Card["type"], value: number, count = 1) => {
    for (let i = 0; i < count; i++) cards.push({ id: cards.length, type, value });
  };
  if (mode === "vengeance") {
    // The special 7 and 13 replace one ordinary copy each; Zero adds the 92nd number.
    for (let n = 1; n <= 13; n++) add("number", n, n - (n === 7 || n === 13 ? 1 : 0));
    add("zero", 0); add("unlucky7", 7); add("lucky13", 13);
    for (const n of [2, 4, 6, 8, 10]) add("minus", n);
    add("halve", 2);
    for (const type of ["one", "four", "steal", "swap", "remove"] as const) add(type, 0, 2);
  } else {
    for (let n = 0; n <= 12; n++) add("number", n, Math.max(n, 1));
    for (const n of [2, 4, 6, 8, 10]) add("bonus", n);
    add("double", 0);
    for (const type of ["chance", "freeze", "three"] as const) add(type, 0, 3);
  }
  return cards;
}
export function shuffle(game: Game, cards: Card[]) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    let seed = game.seed;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    game.seed = seed >>> 0;
    const j = Math.floor((game.seed / 4294967296) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
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
  return ({ double: "×2", chance: "Segunda chance", freeze: "Congelar", three: "Compre 3", zero: "O Zero", unlucky7: "7 azarado", lucky13: "13 da sorte", halve: "÷2", one: "Só mais uma!", four: "Compre 4", steal: "Roubar", swap: "Trocar", remove: "Descartar" } as const)[card.type];
}
export function log(game: Game, message: string, player?: number, card?: Card) { game.log.unshift({ message, player, card }); }
