"use client";
import {loveViewSchema,loveActionSchema,getGameDefinition,gameSettingLabels} from "@croebet/shared";
import type {GamePresentation,GameTableProps} from "../game-module";
import {Badge} from "@/components/ui/badge";
import {CancellationNotice} from "../match-cancellation";
import {LoveTable} from "./love-table";

function Table({game,room,controls,exit,viewerId,busy,play}:GameTableProps){
 const state=loveViewSchema.parse(room.state);
 return <>
 <div className="flex flex-wrap items-center gap-3">{gameSettingLabels(getGameDefinition(game.slug)!,room.options).map(label=><Badge key={label} variant="secondary">{label}</Badge>)}{room.development && <Badge>Desenvolvimento</Badge>}<div className="ml-auto flex items-center gap-1">{controls}{exit}</div></div>
 <CancellationNotice match={room}/>
 <LoveTable state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} play={action=>play(loveActionSchema.parse(action))} participants={room.participants} viewerSeat={room.participants.find(p=>p.userId===viewerId)?.seat}/>
 </>;
}
export const presentation:GamePresentation={managesLive:false,Table};
