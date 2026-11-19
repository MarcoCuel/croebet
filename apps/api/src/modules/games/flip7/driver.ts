import { randomInt } from "node:crypto";
import { flip7ViewSchema, type Flip7View } from "@croebet/shared";
import type { Setup, GameOptions } from "./types.ts";
import type { GameDriver } from "../../matches/driver.ts";
import { createGame, transition, automaticAction, replaceWithBot, type Game, type Action } from "./engine.ts";
import { validateState } from "./state.ts";

export const flip7Driver: GameDriver<Game, Flip7View, { setup: Setup[]; options: GameOptions }, Action> & { replace: typeof replaceWithBot } = {
  rulesVersion: 1,
  create(input, username) {
    return createGame(input.setup.map((player, seat) => seat === 0 ? { name: username, kind: "human" } : player), 1, input.options, randomInt);
  },
  parse(value) {
    const saved = validateState(value);
    if (!saved) throw new Error("Estado persistido inválido.");
    return saved;
  },
  project(state) {
    // Whitelist through the public schema: neither seed nor deck order cross HTTP.
    const { deck, seed, ...publicState } = state;
    void seed;
    return flip7ViewSchema.parse({ ...publicState, deckCount: deck.length });
  },
  apply: (state, action) => transition(state, action, randomInt),
  automatic: state => state.phase === "summary" ? { type: "next" } : automaticAction(state),
  finished: state => state.phase === "over",
  replace: replaceWithBot,
};
