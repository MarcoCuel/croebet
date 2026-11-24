"use client";
import { useMemo } from "react";
import { soloViewSchema, soloActionSchema } from "@croebet/shared";
import type { GamePresentation, GameTableProps } from "../game-module";
import { Badge } from "@/components/ui/badge";
import { GameTableLayout } from "../game-table-layout";
import { GameControls } from "../game-controls";
import { CancellationNotice } from "../match-cancellation";
import { SoloTable } from "./solo-table";
import {useTableCue} from "../use-table-cue";
import {PublicEntry} from "../public-entry";
function Table({game,room,controls,exit,viewerId,busy,play,onAnimating,replayControls}:GameTableProps){
 const state=useMemo(()=>soloViewSchema.parse(room.state),[room.state]);
 const audio=useTableCue(room.id,room.version,state.phase==="over"?"prize":state.move?.kind==="play"?"discard":"slide",!replayControls);
 const history=[...state.log].reverse().map(message=>{const seat=state.players.findIndex(p=>message.startsWith(`${p.name} `));const player=state.players[seat];return {message,player:player?{name:player.name,avatarUrl:room.participants.find(p=>p.seat===seat)?.avatarUrl}:undefined};});
 return <GameTableLayout history={history}><div className="min-w-0"><CancellationNotice match={room}/><SoloTable state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} play={action=>play(soloActionSchema.parse(action))} viewerSeat={room.participants.find(p=>p.userId===viewerId)?.seat} participants={room.participants} onAnimating={onAnimating} replayControls={replayControls} header={{identity:<><span data-game-title className="text-sm font-medium">{game.name}</span>{room.development && <Badge>Desenvolvimento</Badge>}</>,controls:<GameControls audio={audio} developmentControls={controls}>{exit}</GameControls>}}/></div></GameTableLayout>;
}
export const presentation:GamePresentation={managesLive:false,Entry:PublicEntry,Table,result:room=>{const s=soloViewSchema.parse(room.state);return {round:s.round,scoreLabel:"pts",players:s.players.map((p,seat)=>({seat,name:p.name,score:-p.points,winner:s.winners.includes(seat)}))};}};
