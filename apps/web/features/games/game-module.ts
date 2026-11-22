import type {ReactNode,ComponentType} from "react";
import type {GameAction,GameRecord,GameRoom} from "@croebet/shared";
import type {GameResultSummary} from "./game-result";
import type {InitialMatches} from "./server-matches";

export type GameTableProps = {
  game:GameRecord; room:Exclude<GameRoom,{status:"lobby"}>;
  viewerId:string|null; busy:boolean; controls:ReactNode; exit:ReactNode;
  play:(action:GameAction)=>Promise<void>;
  replayControls?:ReactNode;
  onAnimating?:(busy:boolean)=>void;
};
export type GamePresentation = {
  managesLive:boolean;
  result:(room:Exclude<GameRoom,{status:"lobby"}>)=>GameResultSummary;
  Table:ComponentType<GameTableProps>;
  Entry?:ComponentType<{game:GameRecord|null;initial:InitialMatches}>;
};
