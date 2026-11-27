"use client";
import {gameIdSchema,type GameRecord,type Ranking} from "@croebet/shared";
import type {InitialMatches} from "./server-matches";
import {gamePresentations} from "./registry";

export function GameScreen({slug,game,initial,ranking}:{slug:string;game:GameRecord|null;initial:InitialMatches;ranking?:Ranking|null}){
 const Entry=gamePresentations[gameIdSchema.parse(game?.moduleId ?? slug)].Entry;
 return Entry?<Entry game={game} initial={initial} ranking={ranking}/>:null;
}
