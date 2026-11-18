import type { Game } from "./types";

export type Wager = { username: string; stake: number };

export function validWager(value: unknown, game: Game): value is Wager {
  if (!value || typeof value !== "object") return false;
  const wager = value as Wager;
  return typeof wager.username === "string" && !!wager.username.trim()
    && Number.isSafeInteger(wager.stake) && wager.stake > 0
    && Number.isSafeInteger(wager.stake * game.players.length)
    && game.players[0].kind === "human"
    && game.players[0].name.toLowerCase() === wager.username.toLowerCase()
    && game.players.slice(1).every(player => player.kind !== "human");
}

/** Integer shares conserve the entire pot; tied seats receive remainders in seat order. */
export function wagerPayouts(game: Game, stake: number): number[] {
  if (game.phase !== "over") throw new Error("A partida ainda não terminou.");
  if (!Number.isSafeInteger(stake) || stake < 1 || !Number.isSafeInteger(stake * game.players.length))
    throw new Error("Valor da entrada inválido.");
  const best = Math.max(...game.players.map(player => player.total));
  const count = game.players.filter(player => player.total === best).length;
  const pot = stake * game.players.length;
  const share = Math.floor(pot / count);
  let remainder = pot % count;
  return game.players.map(player => player.total === best ? share + (remainder-- > 0 ? 1 : 0) : 0);
}
