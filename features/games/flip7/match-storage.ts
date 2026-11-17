import type { Card, Game } from "./engine";

export type SavedMatch = { version: 1; code: string; game: Game };
export const matchStorageKey = "croebet:flip7:match";
const validCode = (code: string) => /^[A-F0-9]{12}$/.test(code);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

function isCard(value: unknown): value is Card {
  if (!object(value) || !integer(value.id) || value.id >= 94 || !integer(value.value)) return false;
  return value.type === "number" ? value.value <= 12
    : value.type === "bonus" ? [2, 4, 6, 8, 10].includes(value.value)
    : ["double", "chance", "freeze", "three"].includes(String(value.type)) && value.value === 0;
}
const cards = (value: unknown): value is Card[] => Array.isArray(value) && value.every(isCard);

/** Check the complete snapshot before allowing browser data back into the engine. */
export function decodeMatch(raw: string, code: string): SavedMatch | null {
  try {
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || saved.code !== code || !validCode(code) || !object(saved.game)) return null;
    const game = saved.game;
    if (!Array.isArray(game.players) || game.players.length < 2 || game.players.length > 12) return null;
    const seat = (value: unknown) => integer(value) && value < (game.players as unknown[]).length;
    if (!game.players.every(player => object(player)
      && typeof player.name === "string" && player.name.trim().length > 0 && player.name.length <= 24
      && ["human", "easy", "normal", "hard"].includes(String(player.kind))
      && ["playing", "stayed", "frozen", "busted"].includes(String(player.status))
      && integer(player.total) && typeof player.hasDrawn === "boolean" && cards(player.cards))) return null;
    if (!game.players.some(player => player.kind === "human")) return null;
    const pending = (value: unknown) => object(value) && seat(value.source) && isCard(value.card)
      && ["freeze", "three", "chance"].includes(value.card.type)
      && (value.give === undefined || typeof value.give === "boolean");
    if (!cards(game.deck) || !cards(game.discard) || !seat(game.turn)
      || !integer(game.round) || game.round < 1 || !integer(game.seed) || game.seed > 4294967295
      || !["playing", "summary", "over"].includes(String(game.phase))
      || !(game.pending === null || pending(game.pending))
      || !Array.isArray(game.queue) || !game.queue.every(pending)
      || !(game.forced === null || (object(game.forced) && seat(game.forced.target) && integer(game.forced.remaining) && game.forced.remaining >= 1 && game.forced.remaining <= 3))
      || !(game.flip7 === null || seat(game.flip7)) || !(game.lastDraw === null || isCard(game.lastDraw))
      || !Array.isArray(game.history) || !game.history.every(row => Array.isArray(row) && row.length === (game.players as unknown[]).length && row.every(integer))
      || !Array.isArray(game.log) || !game.log.every(entry => object(entry) && typeof entry.message === "string" && (entry.player === undefined || seat(entry.player)) && (entry.card === undefined || isCard(entry.card)))) return null;
    const result = saved as SavedMatch;
    const allCards = [...result.game.deck, ...result.game.discard, ...result.game.players.flatMap(player => player.cards), ...result.game.queue.map(action => action.card), ...(result.game.pending ? [result.game.pending.card] : [])];
    if (allCards.length !== 94 || new Set(allCards.map(card => card.id)).size !== 94) return null;
    return result;
  } catch {
    return null;
  }
}

export function readMatch(storage: Storage = window.localStorage): SavedMatch | null {
  const raw = storage.getItem(matchStorageKey);
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    return object(saved) && typeof saved.code === "string" ? decodeMatch(raw, saved.code) : null;
  } catch {
    return null;
  }
}

/** A single atomic write replaces the only saved Flip7 match. */
export function saveMatch(match: SavedMatch, storage: Storage = window.localStorage) {
  storage.setItem(matchStorageKey, JSON.stringify(match));
}

export function currentMatch(): { match: SavedMatch | null; error: string } {
  try {
    const match = readMatch();
    return { match, error: match || !window.localStorage.getItem(matchStorageKey) ? "" : "A partida salva está inválida ou incompatível. Inicie uma nova partida." };
  } catch {
    return { match: null, error: "Não foi possível acessar as partidas salvas neste navegador." };
  }
}

export function matchUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("partida", code);
  else url.searchParams.delete("partida");
  window.history.replaceState(window.history.state, "", url);
}
