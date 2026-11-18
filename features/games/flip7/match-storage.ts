import { cardChoices } from "./vengeance.ts";
import type { Card, Game } from "./engine";
import { createDeck, numbers, targets } from "./engine.ts";
import { validWager, type Wager } from "./wager.ts";

export type SavedMatch = { version: 1; code: string; game: Game; wager?: Wager };
export const matchStorageKey = "croebet:flip7:match";
const validCode = (code: string) => /^[A-F0-9]{12}$/.test(code);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
/** Check the complete snapshot before allowing browser data back into the engine. */
export function decodeMatch(raw: string, code: string): SavedMatch | null {
  try {
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || saved.code !== code || !validCode(code) || !object(saved.game)) return null;
    const game = saved.game;
    // Version 1 snapshots created before modes were introduced are Classic matches.
    if (game.mode === undefined && game.brutal === undefined) { game.mode = "classic"; game.brutal = false; }
    if (!["classic", "vengeance"].includes(String(game.mode)) || typeof game.brutal !== "boolean" || (game.mode === "classic" && game.brutal)) return null;
    // Older saves asked who would control Steal/Discard/Swap; now the drawer chooses the card directly.
    if (game.mode === "vengeance") {
      const direct = (value: unknown) => { if (object(value) && object(value.card) && ["steal", "remove", "swap"].includes(String(value.card.type))) value.resolving = true; };
      direct(game.pending);
      if (Array.isArray(game.queue)) game.queue.forEach(direct);
    }
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
    if (!game.players.some(player => player.kind === "human")) return null;
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
    const result = saved as SavedMatch;
    if (saved.wager !== undefined && !validWager(saved.wager, result.game)) return null;
    const allCards = [...result.game.deck, ...result.game.discard, ...result.game.players.flatMap(player => player.cards), ...result.game.queue.map(action => action.card), ...(result.game.pending ? [result.game.pending.card] : [])];
    if (allCards.length !== deck.length || new Set(allCards.map(card => card.id)).size !== deck.length) return null;
    const state = result.game;
    if (state.phase !== "playing") {
      if (state.pending || state.forced || state.queue.length || state.bonusChoice != null) return null;
    } else {
      if (state.bonusChoice != null && (state.flip7 !== state.bonusChoice || state.bonusTarget != null || numbers(state.players[state.bonusChoice]).length < 7 || state.pending || state.forced || state.queue.length)) return null;
      if (state.pending && !(state.pending.resolving ? cardChoices(state).length : targets(state).length)) return null;
      if (state.forced && (state.mode === "classic" ? state.players[state.forced.target].status !== "playing" : state.players[state.forced.target].status === "busted")) return null;
      if (state.bonusChoice == null && !state.pending && !state.forced && (state.queue.length || state.players[state.turn].status !== "playing")) return null;
    }
    return result;
  } catch {
    return null;
  }
}

/** Read the collection, including snapshots saved by the original single-match format. */
export function readMatches(storage: Storage = window.localStorage): SavedMatch[] {
  const raw = storage.getItem(matchStorageKey);
  if (!raw) return [];
  try {
    const stored: unknown = JSON.parse(raw);
    const candidates = object(stored) && stored.version === 2 && Array.isArray(stored.matches) ? stored.matches : [stored];
    const matches = new Map<string, SavedMatch>();
    for (const candidate of candidates) {
      if (!object(candidate) || typeof candidate.code !== "string") continue;
      const match = decodeMatch(JSON.stringify(candidate), candidate.code);
      if (match) matches.set(match.code, match);
    }
    return [...matches.values()];
  } catch {
    return [];
  }
}

export function readMatch(storage: Storage = window.localStorage, code?: string): SavedMatch | null {
  const matches = readMatches(storage);
  return (code ? matches.find(match => match.code === code) : matches.at(-1)) ?? null;
}

/** Update only this code, keeping every other snapshot in the same atomic write. */
export function saveMatch(match: SavedMatch, storage: Storage = window.localStorage) {
  const matches = readMatches(storage).filter(saved => saved.code !== match.code);
  storage.setItem(matchStorageKey, JSON.stringify({ version: 2, matches: [...matches, match] }));
}

export function removeMatch(code: string, storage: Storage = window.localStorage) {
  const matches = readMatches(storage).filter(match => match.code !== code);
  if (matches.length) storage.setItem(matchStorageKey, JSON.stringify({ version: 2, matches }));
  else storage.removeItem(matchStorageKey);
}

export function currentMatch(code?: string): { match: SavedMatch | null; error: string } {
  try {
    const match = readMatch(window.localStorage, code);
    return { match, error: match || !window.localStorage.getItem(matchStorageKey) ? "" : code ? "Partida não encontrada ou incompatível." : "A partida salva está inválida ou incompatível. Inicie uma nova partida." };
  } catch {
    return { match: null, error: "Não foi possível acessar as partidas salvas neste navegador." };
  }
}

export function matchUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("partida", code);
  else url.searchParams.delete("partida");
  if (url.href === window.location.href) return;
  // Next.js copies its history state and updates useSearchParams for external writes.
  // Passing its internal state back would bypass that update.
  window.history.replaceState(null, "", url);
}
