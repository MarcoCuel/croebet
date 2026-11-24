import "server-only";
import type {GameId} from "@croebet/shared";
import {getInitialMatches,type InitialMatches} from "./server-matches";

export const gameServerLoaders:Record<GameId,(code:string|undefined)=>Promise<InitialMatches>>={
 "coup":code=>getInitialMatches(code,"coup"),
 "dixit":code=>getInitialMatches(code,"dixit"),
 "secret-hitler":code=>getInitialMatches(code,"secret-hitler"),
 "spyfall":code=>getInitialMatches(code,"spyfall"),
 solo:code=>getInitialMatches(code,"solo"),
 flip7:code=>getInitialMatches(code,"flip7"),
 "love-letter":code=>getInitialMatches(code,"love-letter"),
};
