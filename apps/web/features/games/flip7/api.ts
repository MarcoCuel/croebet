import { lobbySchema, lobbyActionResultSchema, roomSchema, matchResultSchema, type MatchCommand, type CreateMatch, type Match, type MatchResult, type RoomSync, type UpdateLobby, type KickMatch } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";

let created: MatchResult | null = null;
export const createServerMatch = (input: CreateMatch) => managementRequest("/matches",lobbySchema,"POST",input);
export const updateServerLobby = (code: string, input: UpdateLobby) => managementRequest(`/matches/${code}/update`, lobbyActionResultSchema, "POST", input);
export const kickServerPlayer = (code: string, input: KickMatch) => managementRequest(`/matches/${code}/kick`, roomSchema, "POST", input);
export const changeLobby = (code: string, action: "join"|"leave"|"start", commandId: string, expectedVersion?: number) => managementRequest(`/matches/${code}/${action}`,lobbyActionResultSchema,"POST",{commandId,...(expectedVersion===undefined?{}:{expectedVersion})});
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
export const sendMatchCommand = (code: string, input: MatchCommand) => managementRequest(`/matches/${code}/commands`, matchResultSchema, "POST", input);
export const abandonServerMatch = (code: string, commandId: string, expectedVersion: number) => managementRequest(`/matches/${code}/abandon`, matchResultSchema, "POST", { commandId, expectedVersion });
