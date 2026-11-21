import { realtimeRequest } from "../realtime";
import { matchResultSchema, type MatchCommand } from "@croebet/shared";
import { type Match, type MatchResult, type RoomSync } from "@croebet/shared";
export { createServerMatch,confirmServerEntry,updateServerLobby,kickServerPlayer,changeLobby } from "../match-api";

let created: MatchResult | null = null;
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
