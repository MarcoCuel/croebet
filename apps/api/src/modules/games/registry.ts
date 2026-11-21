import {gameDefinitions, type GameId, type GameView, type GameEngineAction} from "@croebet/shared";
import type { MatchDriver } from "../matches/driver.ts";
import { matchDriver as flip7 } from "./flip7/driver.ts";
import { loveDriver } from "./love-letter/driver.ts";

const drivers: Record<GameId,MatchDriver<GameView,GameEngineAction>> = {
  flip7,
  "love-letter":loveDriver,
};
export function gameDriver(game:GameId) { return drivers[game]; }

/** Legacy archives contain the public projection but no game slug. */
export function archivedGame(state:unknown):GameId {
  for(const [id,definition] of Object.entries(gameDefinitions))if(definition.view.safeParse(state).success)return id as GameId;
  throw Error("Estado público de jogo inválido.");
}
