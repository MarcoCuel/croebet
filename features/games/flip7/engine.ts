/** Local Flip7 rules, adapted from the public reference. See docs/flip7.md. */
export type PlayerKind = "human" | "easy" | "normal" | "hard";
export type Setup = { name: string; kind: PlayerKind };
export type Card = { id: number; type: "number" | "bonus" | "double" | "chance" | "freeze" | "three"; value: number };
export type Player = Setup & { cards: Card[]; total: number; status: "playing" | "stayed" | "busted" };
type Pending = { source: number; card: Card; give?: boolean };
export type Game = {
  players: Player[]; deck: Card[]; discard: Card[]; turn: number; round: number;
  phase: "playing" | "summary" | "over"; seed: number;
  pending: Pending | null; queue: Pending[]; forced: { target: number; remaining: number } | null;
  history: number[][]; log: string[]; flip7: number | null; lastDraw: Card | null;
};
export type Action = { type: "draw" | "stay" | "step" | "next" } | { type: "target"; target: number };
export const GOAL = 200;

export function createDeck(): Card[] {
  const cards: Card[] = [];
  const add = (type: Card["type"], value: number, count: number) => {
    for (let i = 0; i < count; i++) cards.push({ id: cards.length, type, value });
  };
  for (let n = 0; n <= 12; n++) add("number", n, Math.max(n, 1));
  for (const n of [2, 4, 6, 8, 10]) add("bonus", n, 1);
  add("double", 0, 1);
  for (const type of ["chance", "freeze", "three"] as const) add(type, 0, 3);
  return cards;
}
function shuffle(game: Game, cards: Card[]) {
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
export function createGame(setup: Setup[], seed = 1): Game {
  if (setup.length < 2 || setup.length > 6 || !setup.some(p => p.kind === "human")) throw new Error("Escolha de 2 a 6 participantes, com ao menos uma pessoa.");
  const game: Game = {
    players: setup.map((p, i) => ({ ...p, name: p.name.trim().slice(0, 24) || `Jogador ${i + 1}`, cards: [], total: 0, status: "playing" })),
    deck: [], discard: [], turn: 0, round: 1, phase: "playing", seed: (seed >>> 0) || 1,
    pending: null, queue: [], forced: null, lastDraw: null, history: [], log: ["Partida iniciada. Cada pessoa compra uma carta por turno."], flip7: null,
  };
  game.deck = shuffle(game, createDeck());
  return game;
}
export const numbers = (player: Player) => player.cards.filter(c => c.type === "number");
export function score(player: Player): number {
  if (player.status === "busted") return 0;
  const values = numbers(player);
  const base = values.reduce((sum, c) => sum + c.value, 0);
  return base * (player.cards.some(c => c.type === "double") ? 2 : 1)
    + player.cards.filter(c => c.type === "bonus").reduce((sum, c) => sum + c.value, 0)
    + (values.length === 7 ? 15 : 0);
}
export function targets(game: Game): number[] {
  if (!game.pending) return [];
  const { source, give } = game.pending;
  return game.players.flatMap((p, i) => p.status === "playing" && (!give || (i !== source && !p.cards.some(c => c.type === "chance"))) ? [i] : []);
}
function log(game: Game, message: string) { game.log = [message, ...game.log].slice(0, 6); }
function finish(game: Game) {
  const scores = game.players.map(score);
  game.history.push(scores);
  game.players.forEach((p, i) => { p.total += scores[i]; });
  game.phase = game.players.some(p => p.total >= GOAL) ? "over" : "summary";
  game.pending = null; game.queue = []; game.forced = null;
}
function advance(game: Game) {
  for (let offset = 1; offset <= game.players.length; offset++) {
    const next = (game.turn + offset) % game.players.length;
    if (game.players[next].status === "playing") { game.turn = next; return; }
  }
  finish(game);
}
function settle(game: Game) {
  if (game.phase !== "playing" || game.pending || game.forced) return;
  while (game.queue.length) {
    const pending = game.queue.shift()!;
    if (game.players[pending.source].status === "busted") { game.discard.push(pending.card); continue; }
    game.pending = pending;
    if (targets(game).length) return;
    game.discard.push(pending.card); game.pending = null;
  }
  advance(game);
}
function draw(game: Game, index: number, forced: boolean) {
  if (!game.deck.length) { game.deck = shuffle(game, game.discard); game.discard = []; }
  const card = game.deck.pop();
  if (!card) { finish(game); return; }
  game.lastDraw = card;
  const player = game.players[index];
  log(game, `${player.name} comprou ${cardLabel(card)}.`);
  if (card.type === "number") {
    const duplicate = numbers(player).some(c => c.value === card.value);
    const chance = player.cards.findIndex(c => c.type === "chance");
    if (duplicate && chance >= 0) {
      game.discard.push(card, ...player.cards.splice(chance, 1));
      log(game, `${player.name} usou a segunda chance e descartou o ${card.value} repetido.`);
    } else {
      player.cards.push(card);
      if (duplicate) {
        player.status = "busted";
        log(game, `${player.name} estourou com ${card.value} repetido. Zero pontos nesta rodada.`);
        if (game.forced?.target === index) game.forced = null;
      } else if (numbers(player).length === 7) {
        game.flip7 = index;
        log(game, `${player.name} fez Flip7! +15 pontos e fim da rodada.`);
        finish(game);
      }
    }
  } else if (card.type === "freeze" || card.type === "three") {
    const pending = { source: index, card };
    if (forced) game.queue.push(pending);
    else game.pending = pending;
  } else if (card.type === "chance" && player.cards.some(c => c.type === "chance")) {
    if (forced) game.discard.push(card);
    else {
      game.pending = { source: index, card, give: true };
      if (!targets(game).length) { game.discard.push(card); game.pending = null; }
    }
  } else player.cards.push(card);
}
export function transition(current: Game, action: Action): Game {
  if (action.type === "next") {
    if (current.phase !== "summary") return current;
    const game = structuredClone(current);
    game.players.forEach(p => { game.discard.push(...p.cards); p.cards = []; p.status = "playing"; });
    game.round++; game.turn = (game.round - 1) % game.players.length; game.phase = "playing"; game.flip7 = null; game.lastDraw = null;
    log(game, `Rodada ${game.round}. ${game.players[game.turn].name} começa.`);
    return game;
  }
  if (current.phase !== "playing") return current;
  if (action.type === "target" && (!current.pending || !targets(current).includes(action.target))) return current;
  if ((action.type === "draw" || action.type === "stay") && (current.pending || current.forced || current.queue.length)) return current;
  if (action.type === "stay" && !numbers(current.players[current.turn]).length) return current;
  if (action.type === "step" && (!current.forced || current.pending)) return current;
  const game = structuredClone(current);
  if (action.type === "target") {
    const pending = game.pending!;
    const player = game.players[action.target];
    if (pending.give) player.cards.push(pending.card);
    else {
      game.discard.push(pending.card);
      if (pending.card.type === "freeze") {
        player.status = "stayed";
        log(game, `${player.name} foi congelado e garantiu ${score(player)} pontos.`);
      } else {
        game.forced = { target: action.target, remaining: 3 };
        log(game, `${player.name} deve comprar três cartas.`);
      }
    }
    game.pending = null;
  } else if (action.type === "step") {
    const job = game.forced!;
    job.remaining--;
    if (job.remaining === 0) game.forced = null;
    draw(game, job.target, true);
  } else if (action.type === "stay") {
    game.players[game.turn].status = "stayed";
    log(game, `${game.players[game.turn].name} parou com ${score(game.players[game.turn])} pontos.`);
  } else draw(game, game.turn, false);
  settle(game);
  return game;
}
export function cardLabel(card: Card): string {
  return card.type === "number" ? String(card.value) : card.type === "bonus" ? `+${card.value}`
    : ({ double: "×2", chance: "Segunda chance", freeze: "Congelar", three: "Compre 3" } as const)[card.type];
}
/** Bots use public information only: unseen cards, visible hands and discards. */
export function botAction(game: Game): Action {
  if (game.pending) {
    const options = targets(game);
    const source = game.pending.source;
    const sorted = [...options].sort((a, b) => {
      const rank = (i: number) => game.players[i].total + score(game.players[i]);
      return rank(b) - rank(a);
    });
    const target = game.pending.give ? options[0] : sorted.find(i => i !== source) ?? options[0];
    return { type: "target", target };
  }
  const player = game.players[game.turn];
  const hand = numbers(player);
  if (!hand.length || player.cards.some(c => c.type === "chance")) return { type: "draw" };
  const visible = new Set([...game.discard, ...game.players.flatMap(p => p.cards)].map(c => c.id));
  const unseen = createDeck().filter(c => !visible.has(c.id));
  const risk = unseen.filter(c => c.type === "number" && hand.some(h => h.value === c.value)).length / Math.max(unseen.length, 1);
  const threshold = player.kind === "easy" ? 20 : player.kind === "hard" ? 36 : 28;
  return { type: score(player) >= threshold || risk > (player.kind === "hard" ? 0.42 : 0.33) ? "stay" : "draw" };
}
