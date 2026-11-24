import {gameDefinitions, type GameId, type GameView, type GameEngineAction} from "@croebet/shared";
import type { MatchDriver } from "../matches/driver.ts";
import { matchDriver as flip7 } from "./flip7/driver.ts";
import { soloDriver } from "./solo/driver.ts";
import { loveDriver } from "./love-letter/driver.ts";

import {socialDriver} from "./social/driver.ts";
import {coup} from "./social/coup.ts";
import {dixit} from "./social/dixit.ts";
import {government} from "./social/government.ts";
import {spyfall} from "./social/spyfall.ts";
const drivers: Record<GameId,MatchDriver<GameView,GameEngineAction>> = {
  flip7,
  solo:soloDriver, coup:socialDriver(coup),dixit:socialDriver(dixit),"secret-hitler":socialDriver(government),spyfall:socialDriver(spyfall),
  "love-letter":loveDriver,
};
export function gameDriver(game:GameId) { return drivers[game]; }

/** Legacy archives contain the public projection but no game slug. */
export function archivedGame(state:unknown):GameId {
  for(const [id,definition] of Object.entries(gameDefinitions))if(definition.view.safeParse(state).success)return id as GameId;
  throw Error("Estado público de jogo inválido.");
}
