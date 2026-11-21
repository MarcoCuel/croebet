import { lobbySchema,lobbyActionResultSchema,gameRoomSchema,gameMatchResultSchema, type GameCommand, type CreateMatch,type UpdateLobby,type KickMatch } from "@croebet/shared";
import { realtimeRequest } from "./realtime";
export const createServerMatch = (input: CreateMatch) => realtimeRequest({type:"create",input},lobbySchema);
export const confirmServerEntry = (code: string, input: {commandId:string;expectedVersion:number;entryAmount:number}) => realtimeRequest({type:"confirm-entry",code,input},lobbyActionResultSchema);
export const updateServerLobby = (code: string, input: UpdateLobby) => realtimeRequest({type:"update",code,input},lobbyActionResultSchema);
export const kickServerPlayer = (code: string, input: KickMatch) => realtimeRequest({type:"kick",code,input},gameRoomSchema);
export const changeLobby = (code: string, action: "join"|"leave"|"start", commandId: string, expectedVersion?: number) => realtimeRequest(action==="start"?{type:"start",code,input:{commandId,expectedVersion:expectedVersion!}}:{type:action,code,input:{commandId}},lobbyActionResultSchema);
export const sendGameCommand=(code:string,input:GameCommand)=>realtimeRequest({type:"command",code,input},gameMatchResultSchema);
export const abandonGame=(code:string,commandId:string,expectedVersion:number)=>realtimeRequest({type:"abandon",code,input:{commandId,expectedVersion}},gameMatchResultSchema);
