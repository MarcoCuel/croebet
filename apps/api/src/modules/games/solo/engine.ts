import { randomInt } from "node:crypto";
import { z } from "zod";
import { soloMoveSchema, soloColors, soloCardSchema, soloOptionsSchema, soloActionSchema, soloViewSchema, soloCardPoints, soloCardLabel, soloColorNames, type SoloCard, type SoloAction, type SoloOptions } from "@croebet/shared";
import { shuffleItems } from "../cards.ts";
const stateSchema=z.object({game:z.literal("solo"),mode:soloOptionsSchema.shape.mode,round:z.number().int().positive(),turn:z.number().int().min(0).max(9),direction:z.union([z.literal(1),z.literal(-1)]),phase:z.enum(["playing","summary","over"]),activeColor:z.enum(soloColors).nullable(),
 move:soloMoveSchema.nullable(),deck:z.array(soloCardSchema),discard:z.array(soloCardSchema).min(1),penalty:z.number().int().nonnegative(),penaltyKind:z.enum(["draw2","draw4"]).nullable(),pendingCalls:z.array(z.number().int().min(0).max(9)).max(10),drawn:z.boolean(),drawnCardId:z.string().nullable(),passes:z.number().int().nonnegative(),winners:z.array(z.number().int()),log:z.array(z.string()),
 players:z.array(z.object({name:z.string(),kind:z.enum(["human","normal"]),hand:z.array(soloCardSchema),points:z.number().int().nonnegative()})).min(2).max(10)
}).strict().superRefine((s,ctx)=>{
 const cards=[...s.deck,...s.discard,...s.players.flatMap(p=>p.hand)];
 if(s.turn>=s.players.length || s.pendingCalls.some(seat=>seat>=s.players.length) || new Set(s.pendingCalls).size!==s.pendingCalls.length || cards.length!==112 || new Set(cards.map(c=>c.id)).size!==cards.length)ctx.addIssue({code:"custom",message:"Estado Solo inválido."});
});
export type SoloState=z.infer<typeof stateSchema>;
export const parseSolo=(value:unknown)=>stateSchema.parse(value);
type RandomIndex=(upper:number)=>number;
export function soloDeck(round=1):SoloCard[]{
 const cards:SoloCard[]=[];
 const add=(kind:SoloCard["kind"],color:SoloCard["color"],number:number|null=null)=>cards.push({id:`solo:${round}:${cards.length}`,kind,color,number});
 for(const color of soloColors){for(let n=1;n<=9;n++){add("number",color,n);add("number",color,n);}for(const kind of ["skip","reverse","draw2"] as const){add(kind,color);add(kind,color);}add("swap",color);}
 for(const kind of ["wild","draw4","rotate"] as const)for(let n=0;n<4;n++)add(kind,null);
 return cards;
}
function startRound(s:SoloState,rng:RandomIndex){
 s.move={kind:"deal",seat:s.turn};s.deck=shuffleItems(soloDeck(s.round),rng);s.discard=[];s.penalty=0;s.penaltyKind=null;s.pendingCalls=[];s.drawn=false;s.drawnCardId=null;s.passes=0;s.direction=1;s.phase="playing";
 for(const p of s.players)p.hand=[];
 for(let n=0;n<8;n++)for(let offset=0;offset<s.players.length;offset++)s.players[(s.turn+offset)%s.players.length].hand.push(s.deck.pop()!);
 do{s.discard.push(s.deck.pop()!);}while(s.discard.at(-1)!.kind!=="number");
 s.activeColor=s.discard.at(-1)!.color;s.log.push(`Rodada ${s.round}.`);return s;
}
export function createSolo(setup:{name:string;kind:"human"|"normal"}[],mode:SoloOptions["mode"]="single",rng:RandomIndex=randomInt):SoloState{
 if(setup.length<2 || setup.length>10)throw Error("ILLEGAL_ACTION");
 return startRound({game:"solo",mode,round:1,turn:rng(setup.length),direction:1,phase:"playing",activeColor:null,move:null,deck:[],discard:[],penalty:0,penaltyKind:null,pendingCalls:[],drawn:false,drawnCardId:null,passes:0,winners:[],log:[],players:setup.map(p=>({...p,hand:[],points:0}))},rng);
}
const nextSeat=(s:SoloState,seat:number,steps=1)=>(seat+s.direction*steps+s.players.length*steps)%s.players.length;
const identical=(a:SoloCard,b:SoloCard)=>a.kind===b.kind && a.color===b.color && a.number===b.number;
function matches(s:SoloState,c:SoloCard){const top=s.discard.at(-1)!;return c.color===null || top.kind==="rotate" || c.color===s.activeColor || (c.kind==="number" && top.kind==="number"?c.number===top.number:c.kind!=="number" && c.kind===top.kind);}
export function legalSolo(s:SoloState,seat:number):SoloAction[]{
 if(!s.players[seat] || s.phase==="over")return [];
 if(s.phase==="summary")return seat===s.turn?[{type:"solo-next",seat}]:[];
 const p=s.players[seat],top=s.discard.at(-1)!;
 const plays:SoloAction[]=p.hand.flatMap((card):SoloAction[]=>{
  const jump=identical(card,top);
  if(seat!==s.turn && !jump)return [];
  if(s.penalty && card.kind!==s.penaltyKind)return [];
  if(seat===s.turn && s.drawn && card.id!==s.drawnCardId && !jump)return [];
  if(seat===s.turn && !jump && !matches(s,card))return [];
  const colors=card.kind==="wild" || card.kind==="draw4"?soloColors:[undefined];
  const targets=card.kind==="swap"?s.players.flatMap((_,i)=>i!==seat?[i]:[]):[undefined];
  return colors.flatMap(color=>targets.flatMap(target=>[false,true].map(solo=>({type:"solo-play" as const,seat,cardId:card.id,...(color?{color}:{}),...(target!==undefined?{target}:{}),solo}))));
 });
 if(s.pendingCalls.includes(seat))plays.push({type:"solo-call",seat});
 if(seat===s.turn)plays.push(s.drawn?{type:"solo-pass",seat}:{type:"solo-draw",seat});
 return plays;
}
function draw(s:SoloState,seat:number,count:number,rng:RandomIndex){
 const cards:SoloCard[]=[];
 for(let n=0;n<count;n++){
  if(!s.deck.length && s.discard.length>1){const top=s.discard.pop()!;s.deck=shuffleItems(s.discard,rng);s.discard=[top];}
  const card=s.deck.pop();if(!card)break;s.players[seat].hand.push(card);cards.push(card);
 }
 return cards;
}
function missedCall(s:SoloState,rng:RandomIndex){
 const pending=s.pendingCalls;s.pendingCalls=[];
 for(const seat of pending){draw(s,seat,2,rng);s.log.push(`${s.players[seat].name} esqueceu Solo e comprou duas cartas.`);}
}
function finishRound(s:SoloState,winners:number[]){
 s.pendingCalls=[];s.penalty=0;s.penaltyKind=null;s.drawn=false;s.drawnCardId=null;
 for(const [seat,p] of s.players.entries())if(!winners.includes(seat))p.points+=p.hand.reduce((sum,c)=>sum+soloCardPoints(c),0);
 s.winners=winners;s.log.push(`Rodada vencida por ${winners.map(i=>s.players[i].name).join(", ")}.`);
 const end=s.mode==="single" || (s.mode==="rounds3" && s.round>=3) || (s.mode==="rounds4" && s.round>=4) || (s.mode.startsWith("points") && s.players.some(p=>p.points>=Number(s.mode.slice(6))));
 s.phase=end?"over":"summary";
 if(end && s.mode!=="single"){const best=Math.min(...s.players.map(p=>p.points));s.winners=s.players.flatMap((p,i)=>p.points===best?[i]:[]);}
 s.turn=winners[0];
}
export function applySolo(initial:SoloState,input:SoloAction,rng:RandomIndex=randomInt):SoloState{
 const a=soloActionSchema.parse(input);
 if(!legalSolo(initial,a.seat).some(legal=>JSON.stringify(legal)===JSON.stringify(a)))throw Error("ILLEGAL_ACTION");
 const s=structuredClone(initial),p=s.players[a.seat];
 s.move={kind:a.type==="solo-draw"?"draw":a.type==="solo-play"?"play":a.type==="solo-call"?"call":a.type==="solo-next"?"deal":"pass",seat:a.seat};
 if(a.type==="solo-next"){s.round++;s.turn=(s.turn+1)%s.players.length;return startRound(s,rng);}
 if(a.type==="solo-call"){s.pendingCalls=s.pendingCalls.filter(seat=>seat!==a.seat);s.log.push(`${p.name} anunciou Solo!`);return s;}
 if(a.type!=="solo-pass")missedCall(s,rng);
 if(a.type==="solo-draw"){
  if(s.penalty){const count=s.penalty;draw(s,a.seat,count,rng);s.penalty=0;s.penaltyKind=null;s.log.push(`${p.name} comprou ${count} cartas de penalidade.`);return s;}
  const cards=draw(s,a.seat,1,rng);s.drawn=true;s.drawnCardId=cards[0]?.id ?? null;s.log.push(`${p.name} comprou uma carta.`);return s;
 }
 if(a.type==="solo-pass"){
  s.drawn=false;s.drawnCardId=null;s.turn=nextSeat(s,a.seat);s.passes++;
  if(s.passes>=s.players.length && !s.deck.length && s.discard.length===1){const best=Math.min(...s.players.map(p=>p.hand.reduce((n,c)=>n+soloCardPoints(c),0)));finishRound(s,s.players.flatMap((p,i)=>p.hand.reduce((n,c)=>n+soloCardPoints(c),0)===best?[i]:[]));}
  return s;
 }
 const index=p.hand.findIndex(c=>c.id===a.cardId),[card]=p.hand.splice(index,1);
 s.discard.push(card);s.passes=0;s.drawn=false;s.drawnCardId=null;s.activeColor=a.color ?? card.color;s.log.push(`${p.name} jogou ${soloCardLabel(card)}${a.color?` (${soloColorNames[a.color].toLowerCase()})`:""}${a.target!==undefined?` em ${s.players[a.target].name}`:""}.`);
 if(!p.hand.length){finishRound(s,[a.seat]);return s;}
 s.turn=nextSeat(s,a.seat);
 if(card.kind==="reverse"){s.direction=s.direction===1?-1:1;s.turn=nextSeat(s,a.seat);}
 else if(card.kind==="skip")s.turn=nextSeat(s,a.seat,2);
 else if(card.kind==="draw2" || card.kind==="draw4"){s.penalty+=card.kind==="draw2"?2:4;s.penaltyKind=card.kind;}
 else if(card.kind==="swap"){s.move={kind:"swap",seat:a.seat,target:a.target};const t=s.players[a.target!];[p.hand,t.hand]=[t.hand,p.hand];s.pendingCalls=[];}
 else if(card.kind==="rotate"){s.move={kind:"rotate",seat:a.seat};const hands=s.players.map(player=>player.hand);for(let seat=0;seat<hands.length;seat++)s.players[nextSeat(s,seat)].hand=hands[seat];s.pendingCalls=[];}
 const affected=card.kind==="rotate"?s.players.map((_,seat)=>seat):card.kind==="swap"?[a.seat,a.target!]:[a.seat];
 for(const seat of affected)if(s.players[seat].hand.length===1){
  if(seat===a.seat && a.solo)s.log.push(`${p.name} anunciou Solo!`);else s.pendingCalls.push(seat);
 }
 return s;
}
export function projectSolo(s:SoloState,seat:number|null){
 return soloViewSchema.parse({move:s.move,game:s.game,mode:s.mode,round:s.round,turn:s.turn,direction:s.direction,phase:s.phase,activeColor:s.activeColor,deckCount:s.deck.length,discard:s.discard,penalty:s.penalty,penaltyKind:s.penaltyKind,pendingCall:s.pendingCalls[0] ?? null,drawn:s.drawn,winners:s.winners,log:s.log,
  players:s.players.map((p,i)=>({name:p.name,kind:p.kind,points:p.points,hand:seat===i || s.phase!=="playing"?p.hand:null,handCount:p.hand.length})),legalActions:seat===null?[]:legalSolo(s,seat)});
}
/** Chooses from the same private projection as a player; never reads deck/opponent hands. */
export function botSolo(s:SoloState,rng:RandomIndex=randomInt):SoloAction{
 const seat=s.turn,view=projectSolo(s,seat),actions=view.legalActions;
 const call=actions.find(a=>a.type==="solo-call");if(call)return call;
 const plays=actions.filter(a=>a.type==="solo-play" && a.solo);
 return plays.length?plays[rng(plays.length)]:actions.find(a=>a.type==="solo-pass") ?? actions.find(a=>a.type==="solo-draw")!;
}
