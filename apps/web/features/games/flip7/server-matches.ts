import type {Match,MatchSummary,Lobby,LobbyList,matchReplaySchema} from "@croebet/shared";
export type InitialMatches={replay?:ReturnType<typeof matchReplaySchema.parse>;revision:string;match:Match|null;lobby:Lobby|null;directory:LobbyList;items:MatchSummary[];error:string;unavailable:boolean};
