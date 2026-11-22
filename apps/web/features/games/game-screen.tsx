"use client";
import {gameIdSchema,type GameRecord} from "@croebet/shared";
import type {InitialMatches} from "./server-matches";
import {gamePresentations} from "./registry";

export function GameScreen({slug,game,initial}:{slug:string;game:GameRecord|null;initial:InitialMatches}){
 const Entry=gamePresentations[gameIdSchema.parse(game?.moduleId ?? slug)].Entry;
 return Entry?<Entry game={game} initial={initial}/>:null;
}
