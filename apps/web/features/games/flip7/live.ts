"use client";
import { useEffect, useRef, useState } from "react";
import { lobbyListSchema, roomSyncSchema, type Lobby, type RoomSync } from "@croebet/shared";

export function useMatchLive(code: string | undefined, version: number, enabled: boolean, onRoom: (sync: RoomSync) => void, onLobbies: (items: Lobby[]) => void, onClosed: (message: string) => void) {
  const handlers=useRef({onRoom,onLobbies,onClosed});
  useEffect(()=>{handlers.current={onRoom,onLobbies,onClosed};});
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    if(!enabled)return;
    const source=new EventSource(`/api/v1/matches/live${code?`?code=${code}&afterVersion=${version}`:""}`);
    source.addEventListener("room",event=>{
      try { const sync=roomSyncSchema.parse(JSON.parse(event.data)); handlers.current.onRoom(sync); setConnected(true); }
      catch { source.close();setConnected(false);handlers.current.onClosed("Não foi possível sincronizar a sala. Recarregue a página."); }
    });
    source.addEventListener("lobbies",event=>{
      try { handlers.current.onLobbies(lobbyListSchema.parse(JSON.parse(event.data)).items);setConnected(true); }
      catch { source.close();setConnected(false); }
    });
    source.addEventListener("closed",event=>{source.close();setConnected(false);const data=JSON.parse(event.data);handlers.current.onClosed(data.message);});
    source.onerror=()=>setConnected(false);
    return()=>{source.close();};
    // The stream persists across versions; SSE reconnect resends confirmed events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[code,enabled]);
  return connected;
}
