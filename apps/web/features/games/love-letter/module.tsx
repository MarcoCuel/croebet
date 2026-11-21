"use client";
import {loveViewSchema,loveActionSchema,getGameDefinition,gameSettingLabels} from "@croebet/shared";
import type {GamePresentation,GameTableProps} from "../game-module";
import {Badge} from "@/components/ui/badge";
import {CancellationNotice} from "../match-cancellation";
import { GameControls } from "../game-controls";
import { GameTableLayout } from "../game-table-layout";
import {LoveTable} from "./love-table";

function Table({game,room,controls,exit,viewerId,busy,play}:GameTableProps){
 const state=loveViewSchema.parse(room.state);
 return <GameTableLayout history={<ol className="space-y-3">{state.log.length ? [...state.log].reverse().map((line, index) => <li key={index} className="border-b border-contrast/6 pb-3 last:border-0">{line}</li>) : <li>Aguardando a primeira jogada.</li>}</ol>}>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-3">{gameSettingLabels(getGameDefinition(game.slug)!,room.options).map(label=><Badge key={label} variant="secondary">{label}</Badge>)}{room.development && <Badge>Desenvolvimento</Badge>}<GameControls developmentControls={controls}>{exit}</GameControls></div>
 <CancellationNotice match={room}/>
 <LoveTable state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} play={action=>play(loveActionSchema.parse(action))} participants={room.participants} viewerSeat={room.participants.find(p=>p.userId===viewerId)?.seat}/>
 </div>
 </GameTableLayout>;
}
export const presentation:GamePresentation={managesLive:false,Table};
