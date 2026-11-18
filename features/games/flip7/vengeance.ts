import type { Action, Card, Game, Pending } from "./types";
import { canStay, cardLabel, createDeck, GOAL, isNumber, log, numbers, score, shuffle } from "./rules.ts";

const actions = new Set<Card["type"]>(["one", "four", "steal", "swap", "remove"]);
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
function clearEffects(game: Game) {
  if (game.pending) game.discard.push(game.pending.card);
  game.discard.push(...game.queue.map(p => p.card));
  game.pending = null; game.queue = []; game.forced = null;
}
function finish(game: Game) {
  const results = game.players.map(p => score(p, game));
  game.history.push(results);
  game.players.forEach((p, i) => { p.total += results[i]; });
  game.phase = game.players.some(p => p.total >= GOAL) ? "over" : "summary";
  clearEffects(game);
}
function flipSeven(game: Game, index: number) {
  game.flip7 = index;
  log(game, `${game.players[index].name} fez Flip7!`, index);
  clearEffects(game);
  if (game.brutal) game.bonusChoice = index;
  else finish(game);
}
function bust(game: Game, index: number) {
  const player = game.players[index];
  player.status = "busted";
  player.bustedCards = player.cards.map(c => c.id);
  log(game, `${player.name} estourou.`, index);
}
function receive(game: Game, index: number, card: Card, checkFlip = true) {
  const player = game.players[index];
  if (card.type === "unlucky7") {
    game.discard.push(...player.cards);
    player.cards = [];
    if (game.forced?.target === index) game.discard.push(...game.queue.splice(game.forced.queueStart ?? 0).map(p => p.card));
    log(game, `${player.name} perdeu as outras cartas com o 7 azarado.`, index, card);
  }
  player.cards.push(card);
  if (!isNumber(card)) return;
  const duplicates = numbers(player).filter(c => c.value === card.value);
  const safe13 = card.value === 13 && duplicates.length <= 2 && duplicates.some(c => c.type === "lucky13");
  if (card.type !== "unlucky7" && duplicates.length > 1 && !safe13) bust(game, index);
  else if (checkFlip && numbers(player).length >= 7) flipSeven(game, index);
}
function settle(game: Game) {
  if (game.phase !== "playing" || game.bonusChoice != null || game.pending || game.forced) return;
  while (game.queue.length) {
    game.pending = game.queue.shift()!;
    if (game.pending.resolving ? cardChoices(game).length : vengeanceTargets(game).length) return;
    game.discard.push(game.pending.card); game.pending = null;
  }
  for (let offset = 1; offset <= game.players.length; offset++) {
    const next = (game.turn + offset) % game.players.length;
    if (game.players[next].status === "playing") { game.turn = next; return; }
  }
  finish(game);
}
function draw(game: Game, target: number, deferred: boolean) {
  if (!game.deck.length) { game.deck = shuffle(game, game.discard); game.discard = []; }
  const card = game.deck.pop();
  if (!card) { finish(game); return; }
  game.lastDraw = card;
  game.players[target].hasDrawn = true;
  log(game, `${game.players[target].name} comprou`, target, card);
  if (isNumber(card)) receive(game, target, card);
  else {
    const pending: Pending = { source: target, card, ...(["steal", "remove", "swap"].includes(card.type) ? { resolving: true } : {}) };
    if (deferred) game.queue.push(pending);
    else if (pending.resolving ? cardChoices({ ...game, pending }).length : vengeanceTargets({ ...game, pending }).length) game.pending = pending;
    else { game.discard.push(card); log(game, `${cardLabel(card)} sem alvo disponível.`, target); }
  }
}
export function vengeanceTransition(current: Game, action: Action): Game {
  if (action.type === "next") {
    if (current.phase !== "summary") return current;
    const game = structuredClone(current);
    game.players.forEach(p => { game.discard.push(...p.cards); p.cards = []; p.status = "playing"; p.hasDrawn = false; delete p.bustedCards; });
    game.round++; game.turn = (game.round - 1) % game.players.length; game.phase = "playing";
    game.flip7 = null; game.lastDraw = null; game.bonusChoice = null; game.bonusTarget = null;
    log(game, `Rodada ${game.round}. ${game.players[game.turn].name} começa.`, game.turn);
    return game;
  }
  if (current.phase !== "playing") return current;
  if (action.type === "bonus") {
    if (current.bonusChoice == null || (action.target !== null && (!Number.isInteger(action.target) || !current.players[action.target] || action.target === current.bonusChoice))) return current;
    const game = structuredClone(current);
    game.bonusChoice = null; game.bonusTarget = action.target;
    log(game, action.target === null ? `${game.players[game.flip7!].name} escolheu ganhar 15 pontos.` : `${game.players[game.flip7!].name} tirou 15 pontos de ${game.players[action.target].name}.`, game.flip7!);
    finish(game); return game;
  }
  if (current.bonusChoice != null) return current;
  if (action.type === "target" && !vengeanceTargets(current).includes(action.target)) return current;
  if (action.type === "cards" && !cardChoices(current).some(ids => ids.length === action.cards.length && ids.every(id => action.cards.includes(id)))) return current;
  if (action.type === "step" && (!current.forced || current.pending)) return current;
  if ((action.type === "draw" || action.type === "stay") && (current.pending || current.forced || current.queue.length || current.players[current.turn].status !== "playing")) return current;
  if (action.type === "stay" && !canStay(current.players[current.turn], current)) return current;
  const game = structuredClone(current);
  if (action.type === "target") {
    const pending = game.pending!;
    const { card } = pending;
    log(game, `${game.players[pending.source].name} deu ${cardLabel(card)} a ${game.players[action.target].name}.`, action.target, card);
    if (actions.has(card.type)) {
      if (card.type === "one" || card.type === "four") {
        game.discard.push(card); game.pending = null;
        game.forced = { target: action.target, remaining: card.type === "one" ? 1 : 4, queueStart: game.queue.length, stopAfter: card.type === "one" };
      } else game.pending = { source: action.target, card, resolving: true };
    } else {
      game.pending = null;
      receive(game, action.target, card);
    }
  } else if (action.type === "cards") {
    const pending = game.pending!;
    const selected = action.cards.map(id => {
      const owner = game.players.findIndex(p => p.cards.some(c => c.id === id));
      return { owner, card: game.players[owner].cards.find(c => c.id === id)! };
    });
    for (const { owner, card } of selected) game.players[owner].cards = game.players[owner].cards.filter(c => c.id !== card.id);
    game.discard.push(pending.card); game.pending = null;
    if (pending.card.type === "remove") game.discard.push(selected[0].card);
    else if (pending.card.type === "steal") receive(game, pending.source, selected[0].card);
    else {
      // Remove both first so duplicate detection uses the final hands. Resolve a special 7 on arrival.
      receive(game, selected[1].owner, selected[0].card, false);
      receive(game, selected[0].owner, selected[1].card, false);
      for (const { owner } of selected) if (game.players[owner].status !== "busted" && numbers(game.players[owner]).length >= 7) { flipSeven(game, owner); break; }
    }
    log(game, pending.card.type === "steal"
      ? `${game.players[pending.source].name} roubou ${cardLabel(selected[0].card)} de ${game.players[selected[0].owner].name}.`
      : pending.card.type === "remove" ? `${game.players[pending.source].name} descartou ${cardLabel(selected[0].card)} de ${game.players[selected[0].owner].name}.`
      : `${game.players[pending.source].name} resolveu ${cardLabel(pending.card)}: ${selected.map(c => `${cardLabel(c.card)} de ${game.players[c.owner].name}`).join(" e ")}.`, pending.source, pending.card);
  } else if (action.type === "step") {
    const job = game.forced!;
    job.remaining--;
    draw(game, job.target, true);
    if (game.forced && (job.remaining === 0 || game.players[job.target].status === "busted")) {
      const deferred = game.queue.splice(job.queueStart ?? 0);
      if (game.players[job.target].status === "busted") game.discard.push(...deferred.map(p => p.card));
      else {
        game.queue.unshift(...deferred);
        if (job.stopAfter) game.players[job.target].status = "stayed";
      }
      game.forced = null;
    }
  } else if (action.type === "stay") {
    game.players[game.turn].status = "stayed";
    log(game, `${game.players[game.turn].name} parou. Seus pontos ainda podem mudar.`, game.turn);
  } else draw(game, game.turn, false);
  settle(game);
  return game;
}

/** Enumerate choices using public hands; the deck order never informs a bot decision. */
export function vengeanceAction(game: Game): Action {
  const source = game.bonusChoice ?? game.pending?.source ?? game.turn;
  const rank = (state: Game, index: number) => state.players[index].total + (state.phase === "playing" ? score(state.players[index], state) : 0);
  const leader = game.players.map((_, i) => i).filter(i => i !== source).sort((a, b) => rank(game, b) - rank(game, a))[0];
  if (game.bonusChoice != null) return { type: "bonus", target: rank(game, leader) >= GOAL || rank(game, leader) > rank(game, source) + 15 ? leader : null };
  if (game.pending?.resolving) {
    const choices = cardChoices(game).map(cards => ({ type: "cards" as const, cards }));
    const utility = (action: Action) => {
      const state = vengeanceTransition({ ...game, log: [], history: [] }, action);
      return (rank(state, source) - rank(game, source)) - Math.max(...state.players.map((_, i) => i === source ? -Infinity : rank(state, i) - rank(game, i)));
    };
    return choices.map(action => ({ action, value: utility(action) })).sort((a, b) => b.value - a.value)[0].action;
  }
  if (game.pending) {
    const options = vengeanceTargets(game);
    const type = game.pending.card.type;
    const target = ["steal", "swap", "remove"].includes(type) && options.includes(source) ? source
      : options.filter(i => i !== source).sort((a, b) => rank(game, b) - rank(game, a))[0] ?? options[0];
    return { type: "target", target };
  }
  if (game.forced) return { type: "step" };
  const player = game.players[source];
  if (!canStay(player, game)) return { type: "draw" };
  const visible = new Set([...game.discard, ...game.players.flatMap(p => p.cards), ...game.queue.map(p => p.card)].map(c => c.id));
  const unseen = createDeck("vengeance").filter(c => !visible.has(c.id));
  const danger = unseen.filter(c => isNumber(c) && c.type !== "unlucky7" && numbers(player).some(h => h.value === c.value)
    && !(c.value === 13 && numbers(player).filter(h => h.value === 13).length === 1 && (c.type === "lucky13" || player.cards.some(h => h.type === "lucky13")))).length / Math.max(unseen.length, 1);
  const threshold = player.kind === "easy" ? 18 : player.kind === "hard" ? 32 : 25;
  return { type: score(player, game) >= threshold || danger > 0.38 ? "stay" : "draw" };
}
