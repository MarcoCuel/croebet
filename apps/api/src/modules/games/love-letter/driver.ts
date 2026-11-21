import { loveOptionsSchema, loveActionSchema, loveViewSchema, type GameView, type GameEngineAction } from "@croebet/shared";
import type { MatchDriver } from "../../matches/driver.ts";
import { createLove, parseLove, projectLove, applyLove, botLove } from "./engine.ts";

export const loveDriver:MatchDriver<GameView,GameEngineAction> = {
  rulesVersion:1,
  create:input=>createLove(input.setup,loveOptionsSchema.parse(input.options).mode),
  parse:parseLove,
  project:state=>projectLove(parseLove(state),null),
  projectFor:(state,seat)=>projectLove(parseLove(state),seat),
  apply:(state,action)=>applyLove(parseLove(state),loveActionSchema.parse(action)),
  automatic:state=>{
    const s=parseLove(state);
    return s.phase==="over"?null:s.phase==="summary"?{type:"next"}:s.players[s.turn].kind==="human"?null:botLove(s);
  },
  finished:state=>parseLove(state).phase==="over",
  decision:state=>{
    const s=parseLove(state);
    return s.phase==="playing" && s.players[s.turn].kind==="human"?{seat:s.turn,key:`${s.round}:${s.turn}`}:null;
  },
  human:(state,seat)=>parseLove(state).players[seat]?.kind==="human",
  replace:(state,seat)=>{
    const s=structuredClone(parseLove(state));
    if(!s.players[seat])throw Error("ILLEGAL_ACTION");
    s.players[seat].kind="normal";
    return s;
  },
  // Chancellor choices include private cards: neither receipts nor events store them.
  eventAction:()=>({type:"step"}),
  snapshotOnly:true,
  outcome:state=>{
    const s=parseLove(state);
    return {winners:s.winners,humanSeats:s.players.flatMap((p,i)=>p.kind==="human"?[i]:[])};
  },
  summarize:view=>{
    const s=loveViewSchema.parse(view);
    return s.players.map((p,i)=>({name:p.name,score:p.tokens,bot:p.kind!=="human",winner:s.phase==="over" && s.winners.includes(i)}));
  },
};
