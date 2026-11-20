import { lobbySchema, lobbyActionResultSchema, roomSchema, matchResultSchema, type MatchCommand, type CreateMatch, type Match, type MatchResult, type RoomSync, type UpdateLobby, type KickMatch } from "@croebet/shared";
import { realtimeRequest } from "../realtime";

let created: MatchResult | null = null;
export const createServerMatch = (input: CreateMatch) => realtimeRequest({type:"create",input},lobbySchema);
export const confirmServerEntry = (code: string, input: {commandId:string;expectedVersion:number;entryAmount:number}) => realtimeRequest({type:"confirm-entry",code,input},lobbyActionResultSchema);
export const updateServerLobby = (code: string, input: UpdateLobby) => realtimeRequest({type:"update",code,input},lobbyActionResultSchema);
export const kickServerPlayer = (code: string, input: KickMatch) => realtimeRequest({type:"kick",code,input},roomSchema);
export const changeLobby = (code: string, action: "join"|"leave"|"start", commandId: string, expectedVersion?: number) => realtimeRequest(action==="start"?{type:"start",code,input:{commandId,expectedVersion:expectedVersion!}}:{type:action,code,input:{commandId}},lobbyActionResultSchema);
export function rememberStart(sync: RoomSync) {
  if(sync.room.status==="lobby")return;
  const start=sync.frames.findIndex(frame=>frame.action.type==="start");
  if(start>=0)created={match:sync.room,before:sync.frames[start].state,frames:sync.frames.slice(start+1)};
}
export function createdPresentation(match: Match | null) {
  return match && created?.match.id === match.id && created.match.version === match.version ? created : null;
}
export function clearCreatedPresentation(code: string | undefined) {
  if (created?.match.code === code) created = null;
}
export const sendMatchCommand = (code: string, input: MatchCommand) => realtimeRequest({type:"command",code,input},matchResultSchema);
export const abandonServerMatch = (code: string, commandId: string, expectedVersion: number) => realtimeRequest({type:"abandon",code,input:{commandId,expectedVersion}},matchResultSchema);
