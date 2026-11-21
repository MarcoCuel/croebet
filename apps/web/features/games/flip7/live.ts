"use client";
import {roomSyncSchema, type RoomSync, type LobbyList, type MatchSummary, type GameRoomSync} from "@croebet/shared";
import {useRoomLive} from "../use-room-live";
/** Presentation adapter for this game's event queue. */
export function useMatchLive(code:string|undefined,version:number,enabled:boolean,onRoom:(sync:RoomSync)=>void,onLobbies:(list:LobbyList)=>void,onClosed:(message:string,closed:boolean)=>void,onMatches?:(matches:MatchSummary[])=>void,onOtherGame?:(code:string,sync:GameRoomSync)=>void,onConnected?:()=>void){
 return useRoomLive(code,version,enabled,sync=>{const parsed=roomSyncSchema.safeParse(sync);if(parsed.success)onRoom(parsed.data);else onOtherGame?.(code!,sync);},onLobbies,onClosed,onMatches,onConnected);
}
