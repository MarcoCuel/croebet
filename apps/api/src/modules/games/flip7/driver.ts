import { z } from "zod";
import { randomInt } from "node:crypto";
import { flip7OptionsSchema, flip7ActionSchema, flip7ViewSchema, type Flip7View } from "@croebet/shared";
import type { Setup, GameOptions } from "./types.ts";
import type { GameDriver } from "../../matches/driver.ts";
import { createGame, transition, automaticAction, replaceWithBot, type Game, type Action } from "./engine.ts";
import { validateState } from "./state.ts";

export const flip7Driver: GameDriver<Game, Flip7View, { setup: Setup[]; options: GameOptions; onlyBots?: boolean }, Action> & { replace: typeof replaceWithBot } = {
  rulesVersion: 1,
  create(input, username) {
    return createGame(input.onlyBots ? input.setup : input.setup.map((player, seat) => seat === 0 ? {name:username,kind:"human"} : player), 1, input.options, randomInt, input.onlyBots);
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

/** Adapter used by the platform; the engine retains its concrete state types. */
export const matchDriver: import("../../matches/driver.ts").MatchDriver<import("@croebet/shared").GameView,import("@croebet/shared").GameEngineAction> = {
  rulesVersion:flip7Driver.rulesVersion,
  create: (input,username)=>flip7Driver.create({...input,options:flip7OptionsSchema.parse(input.options)},username),
  parse:flip7Driver.parse,
  project:state=>flip7Driver.project(flip7Driver.parse(state)),
  projectFor:state=>flip7Driver.project(flip7Driver.parse(state)),
  apply:(state,action)=>{
    const current=flip7Driver.parse(state);
    const next=flip7Driver.apply(current,z.union([flip7ActionSchema,z.object({type:z.enum(["step","next"])}).strict()]).parse(action));
    if(next===current)throw Error("ILLEGAL_ACTION");
    return next;
  },
  automatic:state=>flip7Driver.automatic(flip7Driver.parse(state)),
  finished:state=>flip7Driver.finished(flip7Driver.parse(state)),
  decision:state=>{
    const s=flip7Driver.parse(state),seat=s.bonusChoice ?? s.pending?.source ?? s.turn;
    return s.phase==="playing" && s.players[seat]?.kind==="human"?{seat,key:`${s.round}:${seat}`}:null;
  },
  human:(state,seat)=>flip7Driver.parse(state).players[seat]?.kind==="human",
  replace:(state,seat)=>flip7Driver.replace(flip7Driver.parse(state),seat),
  eventAction:action=>action,
  snapshotOnly:false,
  outcome:state=>{
    const s=flip7Driver.parse(state),maximum=Math.max(...s.players.map(p=>p.total));
    return {winners:s.players.flatMap((p,i)=>p.total===maximum?[i]:[]),humanSeats:s.players.flatMap((p,i)=>p.kind==="human"?[i]:[])};
  },
  summarize:view=>{
    const s=flip7ViewSchema.parse(view),maximum=Math.max(...s.players.map(p=>p.total));
    return s.players.map(p=>({name:p.name,score:p.total,bot:p.kind!=="human",winner:s.phase==="over" && p.total===maximum}));
  },
};
