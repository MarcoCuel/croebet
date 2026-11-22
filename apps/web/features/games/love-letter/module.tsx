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

function Table({game,room,controls,exit,viewerId,busy,play,onAnimating}:GameTableProps){
 const state=useMemo(()=>loveViewSchema.parse(room.state),[room.state]);
 return <GameTableLayout history={<ol className="space-y-3">{state.log.length ? [...state.log].reverse().map((line, index) => <li key={index} className="flex items-start gap-2 border-b border-contrast/6 pb-3 last:border-0">{/ jogou (\d+)/.test(line) && <LoveCard value={Number(line.match(/ jogou (\d+)/)![1])} mode={state.mode} small compact />}<span>{line}</span></li>) : <li>Aguardando a primeira jogada.</li>}</ol>}>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-3">{gameSettingLabels(getGameDefinition(game.slug)!,room.options).map(label=><Badge key={label} variant="secondary">{label}</Badge>)}{room.development && <Badge>Desenvolvimento</Badge>}<GameControls developmentControls={controls}>{exit}</GameControls></div>
 <CancellationNotice match={room}/>
 <LoveTable state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} onAnimating={onAnimating} play={action=>play(loveActionSchema.parse(action))} participants={room.participants} viewerSeat={room.participants.find(p=>p.userId===viewerId)?.seat}/>
 </div>
 </GameTableLayout>;
}
export const presentation:GamePresentation={managesLive:false,Table,result:room=>{
 const state=loveViewSchema.parse(room.state);
 return {round:state.round,scoreLabel:"fichas",players:state.players.map((player,seat)=>({seat,name:player.name,score:player.tokens,winner:state.winners.includes(seat)}))};
}};
