import { cardChoices } from "./vengeance.ts";
import type { Card, Game } from "./engine.ts";
import { createDeck, numbers, targets } from "./engine.ts";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
/** Validate persisted engine state and physical-card conservation. */
export function validateState(game: unknown): Game | null {
  try {
    if (!object(game)) return null;
    if (!["classic", "vengeance"].includes(String(game.mode)) || typeof game.brutal !== "boolean" || (game.mode === "classic" && game.brutal)) return null;
    const deck = createDeck(game.mode as Game["mode"]);
    const isCard = (value: unknown): value is Card => {
      if (!object(value) || !integer(value.id) || value.id >= deck.length) return false;
      const original = deck[value.id];
      return value.type === original.type && value.value === original.value;
    };
    const cards = (value: unknown): value is Card[] => Array.isArray(value) && value.every(isCard);
    const points = (value: unknown) => Number.isSafeInteger(value) && (game.brutal || Number(value) >= 0);
    if (!Array.isArray(game.players) || game.players.length < 2 || game.players.length > 12) return null;
    const seat = (value: unknown) => integer(value) && value < (game.players as unknown[]).length;
    if (!game.players.every(player => object(player)
      && typeof player.name === "string" && player.name.trim().length > 0 && player.name.length <= 24
      && ["human", "easy", "normal", "hard"].includes(String(player.kind))
      && ["playing", "stayed", "frozen", "busted"].includes(String(player.status))
      && points(player.total) && typeof player.hasDrawn === "boolean" && cards(player.cards)
      && (player.bustedCards === undefined || (game.mode === "vengeance" && player.status === "busted" && Array.isArray(player.bustedCards) && player.bustedCards.every(id => integer(id) && (player.cards as Card[]).some(c => c.id === id)) && new Set(player.bustedCards).size === player.bustedCards.length)))) return null;
    const pending = (value: unknown) => object(value) && seat(value.source) && isCard(value.card)
      && (game.mode === "classic"
        ? ["freeze", "three", "chance"].includes(value.card.type) && (value.card.type === "chance" ? value.give === true : value.give === undefined || value.give === false) && value.resolving === undefined
        : ["one", "four", "steal", "swap", "remove", "minus", "halve"].includes(value.card.type) && value.give === undefined
          && (value.resolving === undefined || value.resolving === false || (value.resolving === true && ["steal", "swap", "remove"].includes(value.card.type))));
    if (!cards(game.deck) || !cards(game.discard) || !seat(game.turn)
      || !integer(game.round) || game.round < 1 || !integer(game.seed) || game.seed > 4294967295
      || !["playing", "summary", "over"].includes(String(game.phase))
      || !(game.pending === null || pending(game.pending))
      || !Array.isArray(game.queue) || !game.queue.every(pending)
      || !(game.forced === null || (object(game.forced) && seat(game.forced.target) && integer(game.forced.remaining) && game.forced.remaining >= 1 && game.forced.remaining <= (game.mode === "vengeance" ? 4 : 3)
        && (game.mode === "classic" || (integer(game.forced.queueStart) && game.forced.queueStart <= (game.queue as unknown[]).length && typeof game.forced.stopAfter === "boolean" && (!game.forced.stopAfter || game.forced.remaining === 1)))))
      || !(game.flip7 === null || seat(game.flip7)) || !(game.lastDraw === null || isCard(game.lastDraw))
      || !Array.isArray(game.history) || !game.history.every(row => Array.isArray(row) && row.length === (game.players as unknown[]).length && row.every(points))
      || !Array.isArray(game.log) || !game.log.every(entry => object(entry) && typeof entry.message === "string" && (entry.player === undefined || seat(entry.player)) && (entry.card === undefined || isCard(entry.card)))) return null;
    if (!(game.bonusChoice == null || (game.mode === "vengeance" && game.brutal && seat(game.bonusChoice)))
      || !(game.bonusTarget == null || (game.mode === "vengeance" && game.brutal && seat(game.bonusTarget)))) return null;
    const state = game as Game;
    const allCards = [...state.deck, ...state.discard, ...state.players.flatMap(player => player.cards), ...state.queue.map(action => action.card), ...(state.pending ? [state.pending.card] : [])];
    if (allCards.length !== deck.length || new Set(allCards.map(card => card.id)).size !== deck.length) return null;
    if (state.phase !== "playing") {
      if (state.pending || state.forced || state.queue.length || state.bonusChoice != null) return null;
    } else {
      if (state.bonusChoice != null && (state.flip7 !== state.bonusChoice || state.bonusTarget != null || numbers(state.players[state.bonusChoice]).length < 7 || state.pending || state.forced || state.queue.length)) return null;
      if (state.pending && !(state.pending.resolving ? cardChoices(state).length : targets(state).length)) return null;
      if (state.forced && (state.mode === "classic" ? state.players[state.forced.target].status !== "playing" : state.players[state.forced.target].status === "busted")) return null;
      if (state.bonusChoice == null && !state.pending && !state.forced && (state.queue.length || state.players[state.turn].status !== "playing")) return null;
    }
    return state;
  } catch {
    return null;
  }
}

