/** Pure Flip7 transitions. Production randomness is injected by the API driver. */
import type { Action, Game, GameOptions, Setup } from "./types.ts";
import { createDeck, GOAL, log, numbers, score, shuffle } from "./rules.ts";
import { vengeanceAction, vengeanceTargets, vengeanceTransition } from "./vengeance.ts";
export type { Action, Card, Game, GameMode, GameOptions, Player, PlayerKind, Setup } from "./types.ts";
export { canStay, cardLabel, createDeck, GOAL, isNumber, modeLabel, numbers, score } from "./rules.ts";

export function createGame(setup: Setup[], seed = 1, options: Partial<GameOptions> = {}, random?: (upper: number) => number): Game {
  if (setup.length < 2 || setup.length > 12 || !setup.some(p => p.kind === "human")) throw new Error("Escolha de 2 a 12 participantes, com ao menos uma pessoa.");
  const game: Game = {
    mode: options.mode ?? "classic", brutal: options.mode === "vengeance" && options.brutal === true,
    players: setup.map((p, i) => ({ ...p, name: p.name.trim().slice(0, 24) || `Jogador ${i + 1}`, cards: [], total: 0, hasDrawn: false, status: "playing" })),
    deck: [], discard: [], turn: 0, round: 1, phase: "playing", seed: (seed >>> 0) || 1,
    pending: null, queue: [], forced: null, lastDraw: null, history: [], log: [{ message: "Partida iniciada." }], flip7: null,
  };
  game.deck = shuffle(game, createDeck(game.mode), random);
  return game;
}
export function targets(game: Game): number[] {
  if (game.mode === "vengeance") return vengeanceTargets(game);
  if (!game.pending) return [];
  const { source, give } = game.pending;
  return game.players.flatMap((p, i) => p.status === "playing" && (!give || (i !== source && !p.cards.some(c => c.type === "chance"))) ? [i] : []);
}
function finish(game: Game) {
  const scores = game.players.map(player => score(player));
  game.history.push(scores);
  game.players.forEach((p, i) => { p.total += scores[i]; });
  game.phase = game.players.some(p => p.total >= GOAL) ? "over" : "summary";
  if (game.pending) game.discard.push(game.pending.card);
  game.discard.push(...game.queue.map(action => action.card));
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
function draw(game: Game, index: number, forced: boolean, random?: (upper: number) => number) {
  if (!game.deck.length) { game.deck = shuffle(game, game.discard, random); game.discard = []; }
  const card = game.deck.pop();
  if (!card) { finish(game); return; }
  game.players[index].hasDrawn = true;
  game.lastDraw = card;
  const player = game.players[index];
  log(game, `${player.name} comprou`, index, card);
  if (card.type === "number") {
    const duplicate = numbers(player).some(c => c.value === card.value);
    const chance = player.cards.findIndex(c => c.type === "chance");
    if (duplicate && chance >= 0) {
      game.discard.push(card, ...player.cards.splice(chance, 1));
      log(game, `${player.name} usou a segunda chance.`, index, card);
    } else {
      player.cards.push(card);
      if (duplicate) {
        player.status = "busted";
        log(game, `${player.name} estourou.`, index, card);
        if (game.forced?.target === index) game.forced = null;
      } else if (numbers(player).length === 7) {
        game.flip7 = index;
        log(game, `${player.name} fez Flip7! +15 pontos.`, index);
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
export function transition(current: Game, action: Action, random?: (upper: number) => number): Game {
  if (current.mode === "vengeance") return vengeanceTransition(current, action, random);
  if (action.type === "cards" || action.type === "bonus") return current;
  if (action.type === "next") {
    if (current.phase !== "summary") return current;
    const game = structuredClone(current);
    game.players.forEach(p => { game.discard.push(...p.cards); p.cards = []; p.hasDrawn = false; p.status = "playing"; });
    game.round++; game.turn = (game.round - 1) % game.players.length; game.phase = "playing"; game.flip7 = null; game.lastDraw = null;
    log(game, `Rodada ${game.round}. ${game.players[game.turn].name} começa.`, game.turn);
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
      player.cards.push(pending.card);
      if (pending.card.type === "freeze") {
        player.status = "frozen";
        log(game, `${player.name} foi congelado e garantiu ${score(player)} pontos.`, action.target, pending.card);
      } else {
        game.forced = { target: action.target, remaining: 3 };
        log(game, `${player.name} deve comprar três cartas.`, action.target, pending.card);
      }
    }
    game.pending = null;
  } else if (action.type === "step") {
    const job = game.forced!;
    job.remaining--;
    if (job.remaining === 0) game.forced = null;
    draw(game, job.target, true, random);
  } else if (action.type === "stay") {
    game.players[game.turn].status = "stayed";
    log(game, `${game.players[game.turn].name} parou com ${score(game.players[game.turn])} pontos.`, game.turn);
  } else draw(game, game.turn, false, random);
  settle(game);
  return game;
}
/** Bots use public information only: unseen cards, visible hands and discards. */
export function botAction(game: Game): Action {
  if (game.mode === "vengeance") return vengeanceAction(game);
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

/** Initial deals are automatic; human target selections always pause the loop. */
export function automaticAction(game: Game): Action | null {
  if (game.phase !== "playing") return null;
  if (game.bonusChoice != null) return game.players[game.bonusChoice].kind === "human" ? null : botAction(game);
  if (game.pending) return game.players[game.pending.source].kind === "human" ? null : botAction(game);
  if (game.forced) return { type: "step" };
  const player = game.players[game.turn];
  if (!player.hasDrawn || (game.mode === "vengeance" && player.status === "playing" && player.cards.some(c => c.type === "zero"))) return { type: "draw" };
  return player.kind === "human" ? null : botAction(game);
}
