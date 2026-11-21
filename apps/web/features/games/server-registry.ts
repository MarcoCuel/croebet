import "server-only";
import type {GameId} from "@croebet/shared";
import {getInitialMatches,type InitialMatches} from "./server-matches";

export const gameServerLoaders:Record<GameId,(code:string|undefined)=>Promise<InitialMatches>>={
 flip7:code=>getInitialMatches(code,"flip7"),
 "love-letter":code=>getInitialMatches(code,"love-letter"),
};
