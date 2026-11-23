"use client";
import { useState, type ReactNode } from "react";
import { soloCardLabel, soloColorNames, soloColors, type SoloAction, type SoloView, type MatchParticipant } from "@croebet/shared";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { TableViewport, type TableViewportHeader } from "@/three/table/table-viewport";
import type { TablePresentation } from "@/three/table/table-scene";
import { Button } from "@/components/ui/button";
import { GameActionBar, GameDrawActions, GameActionShortcuts } from "../game-action-bar";
import { SoloCard } from "./solo-card";
import { soloArtwork, soloPalette } from "./artwork";
import { soloTableState } from "./table-model";
type Props={state:SoloView;busy:boolean;play:(action:SoloAction)=>Promise<void>;viewerSeat?:number;participants:MatchParticipant[];header?:TableViewportHeader;replayControls?:ReactNode;onAnimating?:(busy:boolean)=>void};
export function SoloTable({state:view,busy,play,viewerSeat,participants,header,replayControls,onAnimating}:Props){
 const [snapshot,setSnapshot]=useState(()=>({view,viewerSeat,state:soloTableState(view)}));
 let state=snapshot.state;
 if(snapshot.view!==view || snapshot.viewerSeat!==viewerSeat){state=soloTableState(view,snapshot.viewerSeat===viewerSeat?snapshot.state:undefined);setSnapshot({view,viewerSeat,state});}
 const [selected,setSelected]=useState<string|null>(null),[announce,setAnnounce]=useState(false);
 const [selectionVersion,setSelectionVersion]=useState(view.log.length);
 if(selectionVersion!==view.log.length){setSelectionVersion(view.log.length);setSelected(null);setAnnounce(false);}
 const actions=busy?[]:view.legalActions;
 const plays=actions.filter((a):a is Extract<SoloAction,{type:"solo-play"}>=>a.type==="solo-play" && a.solo===announce);
 const selectedActions=plays.filter(a=>a.cardId===selected);
 const targets=[...new Set(selectedActions.flatMap(a=>a.target===undefined?[]:[a.target]))];
 const hand=viewerSeat===undefined?[]:view.players[viewerSeat].hand ?? [];
 const submit=(action:SoloAction)=>{setSelected(null);void play(action);};
 const choose=(id:string)=>{
  const card=hand.find(c=>state.mapping[c.id]===id),options=plays.filter(a=>a.cardId===card?.id);
  if(options.length===1)submit(options[0]);else if(options.length)setSelected(card!.id);
 };
 const chooseSeat=(seat:number)=>{const action=selectedActions.find(a=>a.target===seat);if(action)submit(action);};
 const labels=Object.fromEntries(hand.filter(c=>plays.some(a=>a.cardId===c.id)).map(c=>[state.mapping[c.id],`${viewerSeat!==view.turn?"Intervir com":"Jogar"} ${soloCardLabel(c)}`]));
 const draw=actions.find(a=>a.type==="solo-draw"),pass=actions.find(a=>a.type==="solo-pass"),call=actions.find(a=>a.type==="solo-call"),next=actions.find(a=>a.type==="solo-next");
 const status=view.phase==="over"?`Vitória: ${view.winners.map(i=>view.players[i].name).join(", ")}`:view.phase==="summary"?"Rodada encerrada":selectedActions.some(a=>a.color)?"Escolha a cor":targets.length?"Escolha com quem trocar a mão":viewerSeat===view.turn?view.penalty?`Compre ${view.penalty} cartas ou acumule a penalidade`:"Escolha uma carta ou compre":`Vez de ${view.players[view.turn].name}`;
 const presentation:TablePresentation={artwork:soloArtwork,seats:view.players.map((p,seat)=>({name:p.name,avatar:participants.find(p=>p.seat===seat)?.avatarUrl ?? undefined,summary:{score:-p.points,status:`${p.handCount} ${p.handCount===1?"carta":"cartas"}`},label:`Escolher jogador ${p.name}`,disabled:!targets.includes(seat),selected:false})),hiddenSeats:view.players.flatMap((p,i)=>p.hand===null?[i]:[]),selectable:Object.keys(labels),labels,raisedIds:state.hands[viewerSeat ?? 0].filter(c=>!c.hidden).map(c=>c.id),selectedIds:selected?[state.mapping[selected]]:[],deckLabel:draw?view.penalty?`Comprar ${view.penalty} cartas`:"Comprar carta":"Baralho"};
 const fallback=<div className="absolute inset-3 bottom-4 flex flex-col items-center justify-center gap-4 overflow-auto rounded-panel bg-background/95 p-4">
 <p className="text-xs text-muted">Visualização 3D indisponível.</p><div className="flex gap-3">{view.discard.at(-1) && <SoloCard card={view.discard.at(-1)}/>}<Button disabled={!draw} onClick={()=>draw && submit(draw)}>{presentation.deckLabel}</Button></div>
 <div className="flex flex-wrap justify-center gap-2">{hand.map(card=><Button variant="ghost" className="h-auto rounded-md p-0 disabled:opacity-60" key={card.id} disabled={!plays.some(a=>a.cardId===card.id)} aria-label={labels[state.mapping[card.id]] ?? soloCardLabel(card)} onClick={()=>choose(state.mapping[card.id])}><SoloCard card={card}/></Button>)}</div>
 {targets.map(seat=><Button key={seat} onClick={()=>chooseSeat(seat)}>{view.players[seat].name}</Button>)}
 </div>;
 const actionBar=<GameActionBar contained wide={!!replayControls}>{replayControls ?? <>
 <span role="status" className="text-sm font-medium">{status}</span>
 {selectedActions.some(a=>a.color) && <div className="flex gap-2">{soloColors.map(color=><Button key={color} size="icon-sm" aria-label={`Escolher ${soloColorNames[color].toLowerCase()}`} style={{background:soloPalette[color].background,color:soloPalette[color].number}} onClick={()=>{const action=selectedActions.find(a=>a.color===color);if(action)submit(action);}}>{soloColorNames[color][0]}</Button>)}</div>}
 {selected && <Button size="icon-sm" variant="secondary" aria-label="Cancelar escolha" onClick={()=>setSelected(null)}><X className="size-4"/></Button>}
 {pass && <Button size="sm" variant="secondary" onClick={()=>submit(pass)}>Passar</Button>}
 {draw && (view.penalty?<Button size="sm" onClick={()=>submit(draw)}>Comprar {view.penalty}</Button>:<GameDrawActions onDraw={()=>submit(draw)}/>)}
 {next && <Button size="sm" onClick={()=>submit(next)}>Próxima rodada</Button>}
 {call?<Button size="sm" onClick={()=>submit(call)}>Solo!</Button>:hand.length===2 && !!plays.length && <Button size="sm" variant={announce?"default":"secondary"} aria-pressed={announce} onClick={()=>setAnnounce(!announce)}>Anunciar Solo!</Button>}
 </>}</GameActionBar>;
 return <section aria-label="Mesa do Solo"><GameActionShortcuts onDraw={draw && !selected?()=>submit(draw):undefined}/><TableViewport testId="solo-table-scene" state={state} presentation={presentation} viewer={viewerSeat ?? 0} turn={view.turn} localPlayer={viewerSeat!==undefined} canDraw={!!draw} onDraw={()=>draw && submit(draw)} onCard={choose} onSeat={chooseSeat} status="" header={header} actions={actionBar} fallback={fallback} onAnimating={onAnimating}>
 <span className="flex items-center gap-2 text-xs text-muted">{view.direction===1?<ArrowRight className="size-3.5"/>:<ArrowLeft className="size-3.5"/>}Rodada {view.round}{view.activeColor && <span className="rounded-md px-2 py-1" style={{background:soloPalette[view.activeColor].background,color:soloPalette[view.activeColor].number}}>{soloColorNames[view.activeColor]}</span>}{view.penalty>0 && <span>+{view.penalty} acumulado</span>}</span>
 </TableViewport></section>;
}
