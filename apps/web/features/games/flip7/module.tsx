"use client";
import type {ComponentProps} from "react";
import {matchSchema,matchReplaySchema} from "@croebet/shared";
import type {GamePresentation,GameTableProps} from "../game-module";
import {Flip7Loader} from "./flip7-loader";

function Table({game,room,controls,exit}:GameTableProps){
 return <Flip7Loader game={game} testControls={controls} exitControl={exit} initial={{revision:room.code,match:matchSchema.parse(room),lobby:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}}/>;
}
function Entry({game,initial}:ComponentProps<NonNullable<GamePresentation["Entry"]>>){
 return <Flip7Loader game={game} initial={{...initial,match:initial.match?matchSchema.parse(initial.match):null,replay:initial.replay?matchReplaySchema.parse(initial.replay):undefined}}/>;
}
export const presentation:GamePresentation={managesLive:true,Table,Entry};
