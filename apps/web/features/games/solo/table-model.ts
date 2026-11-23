import { soloCardFace, type SoloView, type SoloCard } from "@croebet/shared";
import type { TableState, LabCard } from "../../../three/table/model.ts";
type SoloTableState=TableState & {round:number;mapping:Record<string,string>;logLength:number};
const face=(card:SoloCard)=>({value:card.number ?? 0,face:soloCardFace(card),hidden:false});
export function soloTableState(view:SoloView,previous?:SoloTableState):SoloTableState{
 const newRound=!!previous && previous.round!==view.round;
 const old=newRound?undefined:previous,serial=(previous?.cue.serial ?? 0)+1;
 const changed=old?.logLength!==view.log.length,move=changed?view.move:null;
 const mapping:Record<string,string>={},motions:TableState["motions"]={},used=new Set<string>();
 const allOld=[...(old?.hands.flat() ?? []),...(old?.discard ?? [])];
 const visual=(card:SoloCard,candidate?:LabCard)=>{
  const id=old?.mapping[card.id] ?? candidate?.id ?? card.id;mapping[card.id]=id;used.add(id);return {id,...face(card)};
 };
 const discard=view.discard.map(card=>visual(card));
 const played=discard.at(-1);
 if(changed && played && old && !old.discard.some(c=>c.id===played.id))motions[played.id]={serial,kind:"discard",order:0};
 const hands=view.players.map((p,seat)=>{
  let source=seat;
  if(move?.kind==="swap"){if(seat===move.seat)source=move.target!;else if(seat===move.target)source=move.seat;}
  if(move?.kind==="rotate")source=(seat-view.direction+view.players.length)%view.players.length;
  const candidates=(old?.hands[source] ?? []).filter(c=>!used.has(c.id));
  return Array.from({length:p.handCount},(_,index):LabCard=>{
   const actual=p.hand?.[index];
   const known=actual?allOld.find(c=>c.id===old?.mapping[actual.id]):undefined;
   const candidate=known ?? candidates[index];
   const card=actual?visual(actual,candidate?.hidden?candidate:undefined):{id:candidate?.id ?? `hidden:${view.round}:${seat}:${serial}:${index}`,value:-1,hidden:true};
   used.add(card.id);
   if(newRound)motions[card.id]={serial,kind:"deal",order:index*view.players.length+(seat-view.turn+view.players.length)%view.players.length};
   else if(source!==seat)motions[card.id]={serial,kind:"swap",order:0};
   else if(old && !old.hands[seat].some(c=>c.id===card.id))motions[card.id]={serial,kind:"draw",order:index};
   return card;
  });
 });
 return {round:view.round,logLength:view.log.length,mapping,hands,deck:Array.from({length:view.deckCount},(_,i)=>({id:`deck:${view.round}:${i}`,value:-1})),discard,flipped:[],motions,cue:{serial,kind:newRound?"deal":move?.kind==="swap" || move?.kind==="rotate"?"swap":"discard",ids:Object.keys(motions)}};
}
