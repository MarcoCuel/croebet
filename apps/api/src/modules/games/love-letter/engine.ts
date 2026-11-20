import { randomInt } from "node:crypto";
import { z } from "zod";
import { loveActionSchema, loveViewSchema, type LoveAction } from "@croebet/shared";
const playerSchema=z.object({name:z.string(),kind:z.enum(["human","normal"]),hand:z.array(z.number().int().min(0).max(9)),discard:z.array(z.number().int()),protected:z.boolean(),out:z.boolean(),tokens:z.number().int(),notes:z.array(z.string())});
const stateSchema=z.object({mode:z.enum(["classic","modern"]),players:z.array(playerSchema).min(2).max(6),deck:z.array(z.number().int()),aside:z.number().int().nullable(),removed:z.array(z.number().int()),round:z.number().int(),turn:z.number().int(),phase:z.enum(["playing","summary","over"]),winners:z.array(z.number().int()),pending:z.boolean(),log:z.array(z.string())});
export type LoveState=z.infer<typeof stateSchema>;
export const parseLove=(value:unknown)=>stateSchema.parse(value);
const value=(s:LoveState,role:"king"|"countess"|"princess")=>({king:s.mode==="classic"?6:7,countess:s.mode==="classic"?7:8,princess:s.mode==="classic"?8:9})[role];
export function startRound(s:LoveState){
 const counts=s.mode==="classic"?[0,5,2,2,2,2,1,1,1]:[2,6,2,2,2,2,2,1,1,1];
 s.deck=counts.flatMap((n,v)=>Array(n).fill(v) as number[]);
 for(let i=s.deck.length-1;i>0;i--){const j=randomInt(i+1);[s.deck[i],s.deck[j]]=[s.deck[j],s.deck[i]];}
 s.aside=s.deck.pop()!;s.removed=s.players.length===2?s.deck.splice(-3):[];s.pending=false;s.phase="playing";
 for(const p of s.players){p.hand=[s.deck.pop()!];p.discard=[];p.out=false;p.protected=false;p.notes=[];}
 s.players[s.turn].hand.push(s.deck.pop()!);s.log.push(`Rodada ${s.round}.`);
 return s;
}
export function createLove(setup:{name:string;kind:"human"|"normal"}[],mode:"classic"|"modern"){
 if(setup.length<2 || setup.length>(mode==="classic"?4:6))throw Error("ILLEGAL_ACTION");
 return startRound({mode,players:setup.map(p=>({...p,hand:[],discard:[],out:false,protected:false,tokens:0,notes:[]})),deck:[],aside:0,removed:[],round:1,turn:randomInt(setup.length),phase:"playing",winners:[],pending:false,log:[]});
}
function targets(s:LoveState,card:number){return s.players.flatMap((p,i)=>!p.out && !p.protected && (card===5 || i!==s.turn)?[i]:[]);}
export function legalLove(s:LoveState):LoveAction[]{
 if(s.phase==="over")return [];
 if(s.phase==="summary")return [{type:"next"}];
 const p=s.players[s.turn];
 if(s.pending){const permutations=(xs:number[]):number[][]=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(t=>[x,...t])):[[]];return permutations(p.hand).map(cards=>({type:"keep",cards}));}
 const forced=p.hand.includes(value(s,"countess")) && p.hand.some(c=>c===5 || c===value(s,"king"));
 return [...new Set(p.hand)].filter(c=>!forced || c===value(s,"countess")).flatMap((card):LoveAction[]=>{
  if(![1,2,3,5,value(s,"king")].includes(card))return [{type:"play",card}];
  const ts=targets(s,card);if(!ts.length)return [{type:"play",card}];
  return ts.flatMap(target=>card===1?Array.from({length:s.mode==="classic"?8:10},(_,i)=>s.mode==="classic"?i+1:i).filter(n=>n!==1).map(guess=>({type:"play" as const,card,target,guess})):[{type:"play" as const,card,target}]);
 });
}
function eliminate(s:LoveState,i:number){const p=s.players[i];p.out=true;p.discard.push(...p.hand);p.hand=[];s.log.push(`${p.name} saiu da rodada.`);}
function finishTurn(s:LoveState){
 const alive=s.players.flatMap((p,i)=>p.out?[]:[i]);
 if(alive.length===1 || !s.deck.length){
  const high=Math.max(...alive.map(i=>s.players[i].hand[0]));let wins=alive.filter(i=>s.players[i].hand[0]===high);
  if(s.mode==="classic" && wins.length>1){const sum=(i:number)=>s.players[i].discard.reduce((a,b)=>a+b,0);const best=Math.max(...wins.map(sum));wins=wins.filter(i=>sum(i)===best);}
  for(const i of wins)s.players[i].tokens++;
  if(s.mode==="modern"){const spies=alive.filter(i=>s.players[i].discard.includes(0));if(spies.length===1)s.players[spies[0]].tokens++;}
  const goal=s.players.length===2?(s.mode==="classic"?7:6):s.players.length===3?5:s.players.length===4?4:3;
  s.winners=wins;s.phase=s.players.some(p=>p.tokens>=goal)?"over":"summary";
  s.log.push(`Rodada vencida por ${wins.map(i=>s.players[i].name).join(", ")}.`);
  if(s.phase==="over")s.winners=s.players.flatMap((p,i)=>p.tokens>=goal?[i]:[]);
  return;
 }
 do{s.turn=(s.turn+1)%s.players.length;}while(s.players[s.turn].out);
 s.players[s.turn].protected=false;s.players[s.turn].hand.push(s.deck.pop()!);
}
export function applyLove(initial:LoveState,input:LoveAction){
 const action=loveActionSchema.parse(input);
 if(!legalLove(initial).some(a=>JSON.stringify(a)===JSON.stringify(action)))throw Error("ILLEGAL_ACTION");
 const s=structuredClone(initial),p=s.players[s.turn];
 if(action.type==="next"){s.turn=s.winners[randomInt(s.winners.length)];s.round++;return startRound(s);}
 if(action.type==="keep"){p.hand=[action.cards[0]];s.deck.unshift(...action.cards.slice(1));s.pending=false;finishTurn(s);return s;}
 const card=action.card;p.hand.splice(p.hand.indexOf(card),1);p.discard.push(card);s.log.push(`${p.name} jogou ${card}${action.target===undefined?"":` em ${s.players[action.target].name}`}${action.guess===undefined?"":` (palpite: ${action.guess})`}.`);
 const t=action.target===undefined?null:s.players[action.target];
 if(card===value(s,"princess"))eliminate(s,s.turn);
 else if(card===4)p.protected=true;
 else if(card===1 && t && t.hand[0]===action.guess)eliminate(s,action.target!);
 else if(card===2 && t)p.notes.push(`${t.name}: ${t.hand[0]} (ao jogar Sacerdote).`);
 else if(card===3 && t){p.notes.push(`${t.name}: ${t.hand[0]} (comparação).`);t.notes.push(`${p.name}: ${p.hand[0]} (comparação).`);if(p.hand[0]<t.hand[0])eliminate(s,s.turn);else if(t.hand[0]<p.hand[0])eliminate(s,action.target!);}
 else if(card===5 && t){const discarded=t.hand.pop()!;t.discard.push(discarded);if(discarded===value(s,"princess"))eliminate(s,action.target!);else {const drawn=s.deck.pop();t.hand=[drawn??s.aside!];if(drawn===undefined)s.aside=null;}}
 else if(card===value(s,"king") && t){[p.hand,t.hand]=[t.hand,p.hand];}
 else if(s.mode==="modern" && card===6 && s.deck.length){p.hand.push(...s.deck.splice(-Math.min(2,s.deck.length)));s.pending=true;return s;}
 finishTurn(s);return s;
}
export function projectLove(s:LoveState,seat:number|null){
 return loveViewSchema.parse({mode:s.mode,round:s.round,turn:s.turn,phase:s.phase,deckCount:s.deck.length,removed:s.removed,winners:s.winners,log:s.log,pending:s.pending,
 players:s.players.map((p,i)=>({name:p.name,kind:p.kind,discard:p.discard,protected:p.protected,out:p.out,tokens:p.tokens,hand:seat===i || s.phase!=="playing"?p.hand:null,handCount:p.hand.length})),privateInfo:seat===null?[]:s.players[seat].notes,legalActions:seat===s.turn?legalLove(s):[]});
}
/** Bot receives the same projection as a human; no deck or opponent hand access. */
export function botLove(s:LoveState){const view=projectLove(s,s.turn);return view.legalActions[randomInt(view.legalActions.length)];}
export function automateLove(initial:LoveState){let s=initial;for(let i=0;i<1000;i++){if(s.phase==="over" || (s.phase==="playing" && s.players[s.turn].kind==="human"))return s;s=applyLove(s,s.phase==="summary"?{type:"next"}:botLove(s));}throw Error("AUTOMATION_LIMIT");}
