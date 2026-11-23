"use client";
import {useMemo} from "react";
import {loveViewSchema,loveActionSchema,getGameDefinition,gameSettingLabels} from "@croebet/shared";
import type {GamePresentation,GameTableProps} from "../game-module";
import {Badge} from "@/components/ui/badge";
import {CancellationNotice} from "../match-cancellation";
import { GameControls } from "../game-controls";
import { GameTableLayout } from "../game-table-layout";
import {LoveCard} from "./love-card";
import {LoveTable} from "./love-table";

function Table({game,room,controls,exit,viewerId,busy,play,onAnimating,replayControls}:GameTableProps){
 const state=useMemo(()=>loveViewSchema.parse(room.state),[room.state]);
 const history=[...state.log].reverse().map(message=>{
  const seat=state.players.findIndex(player=>message.startsWith(`${player.name} jogou `) || message===`${player.name} saiu da rodada.`);
  const player=state.players[seat];
  const played=player ? message.slice(player.name.length).match(/^ jogou (\d+)(?: em | \(|\.)/) : null;
  return {
   message,
   player:player ? {name:player.name,avatarUrl:room.participants.find(person=>person.seat===seat)?.avatarUrl} : undefined,
   card:played ? <LoveCard value={Number(played[1])} mode={state.mode} small compact /> : undefined,
  };
 });
 return <GameTableLayout history={history}>
 <div className="min-w-0">
 <CancellationNotice match={room}/>
 <LoveTable replayControls={replayControls} header={{ identity: <><span data-game-title className="text-sm font-medium">{game.name}</span>{gameSettingLabels(getGameDefinition(game.moduleId ?? game.slug)!,room.options).map(label=><Badge key={label} variant="secondary">{label}</Badge>)}{room.development && <Badge>Desenvolvimento</Badge>}</>, controls: <GameControls developmentControls={controls}>{exit}</GameControls> }} state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} onAnimating={onAnimating} play={action=>play(loveActionSchema.parse(action))} participants={room.participants} viewerSeat={room.participants.find(p=>p.userId===viewerId)?.seat}/>
 </div>
 </GameTableLayout>;
}
export const presentation:GamePresentation={managesLive:false,Table,result:room=>{
 const state=loveViewSchema.parse(room.state);
 return {round:state.round,scoreLabel:"fichas",players:state.players.map((player,seat)=>({seat,name:player.name,score:player.tokens,winner:state.winners.includes(seat)}))};
}};
