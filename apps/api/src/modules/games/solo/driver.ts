import { soloActionSchema, soloOptionsSchema, soloViewSchema, type GameView, type GameEngineAction } from "@croebet/shared";
import type { MatchDriver } from "../../matches/driver.ts";
import { createSolo, parseSolo, applySolo, projectSolo, botSolo, legalSolo } from "./engine.ts";
export const soloDriver:MatchDriver<GameView,GameEngineAction>={
 rulesVersion:1, deferredAutomaticMs:2400,
 create:input=>createSolo(input.setup,soloOptionsSchema.parse(input.options).mode),parse:parseSolo,
 project:state=>projectSolo(parseSolo(state),null),projectFor:(state,seat)=>projectSolo(parseSolo(state),seat),
 apply:(state,action)=>applySolo(parseSolo(state),soloActionSchema.parse(action)),
 authorize:(state,seat,action)=>{const parsed=soloActionSchema.safeParse(action);return parsed.success && parsed.data.seat===seat && legalSolo(parseSolo(state),seat).some(a=>JSON.stringify(a)===JSON.stringify(parsed.data));},
 automatic:state=>{
  const s=parseSolo(state);
  if(s.phase==="over")return null;
  if(s.phase==="summary")return {type:"solo-next",seat:s.turn};
  const caller=s.pendingCalls.find(seat=>s.players[seat].kind!=="human");
  if(caller!==undefined)return {type:"solo-call",seat:caller};
  const intervention=s.players.flatMap((p,seat)=>p.kind!=="human" && seat!==s.turn?projectSolo(s,seat).legalActions.filter(a=>a.type==="solo-play" && a.solo):[])[0];
  return intervention ?? (s.players[s.turn].kind==="human"?null:botSolo(s));
 },
 finished:state=>parseSolo(state).phase==="over",
 decision:state=>{const s=parseSolo(state);return s.phase!=="over" && s.players[s.turn].kind==="human"?{seat:s.turn,key:`${s.round}:${s.turn}:${s.log.length}`}:null;},
 human:(state,seat)=>parseSolo(state).players[seat]?.kind==="human",
 replace:(state,seat)=>{const s=structuredClone(parseSolo(state));if(!s.players[seat])throw Error("ILLEGAL_ACTION");s.players[seat].kind="normal";return s;},
 eventAction:()=>({type:"step"}),snapshotOnly:true,
 outcome:state=>{const s=parseSolo(state);return {winners:s.winners,humanSeats:s.players.flatMap((p,i)=>p.kind==="human"?[i]:[])};},
 summarize:view=>{const s=soloViewSchema.parse(view);return s.players.map((p,i)=>({name:p.name,score:-p.points,bot:p.kind!=="human",winner:s.phase==="over" && s.winners.includes(i)}));},
};
