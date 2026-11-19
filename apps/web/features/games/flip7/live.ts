"use client";
import { useEffect, useRef, useState } from "react";
import { lobbyListSchema, roomSyncSchema, type Lobby, type RoomSync } from "@croebet/shared";

export function useMatchLive(code: string | undefined, version: number, enabled: boolean, onRoom: (sync: RoomSync) => void, onLobbies: (items: Lobby[]) => void, onClosed: (message: string) => void) {
  const handlers=useRef({onRoom,onLobbies,onClosed});
  useEffect(()=>{handlers.current={onRoom,onLobbies,onClosed};});
  const streamKey=enabled?(code ?? "directory"):null;
  const [connection,setConnection]=useState<{key:typeof streamKey;connected:boolean}>({key:null,connected:false});
  const confirmedVersion=useRef(version);
  useEffect(()=>{confirmedVersion.current=version;},[version]);
  useEffect(()=>{
    if(!enabled)return;
    const key=code ?? "directory";
    const setConnected=(connected:boolean)=>setConnection({key,connected});
    const source=new EventSource(`/api/v1/matches/live${code?`?code=${code}&afterVersion=${confirmedVersion.current}`:""}`);
    source.addEventListener("room",event=>{
      try { const sync=roomSyncSchema.parse(JSON.parse(event.data)); handlers.current.onRoom(sync); setConnected(true); }
      catch { source.close();setConnected(false);handlers.current.onClosed("Não foi possível sincronizar a sala. Recarregue a página."); }
    });
    source.addEventListener("lobbies",event=>{
      try { handlers.current.onLobbies(lobbyListSchema.parse(JSON.parse(event.data)).items);setConnected(true); }
      catch { source.close();setConnected(false); }
    });
    source.addEventListener("closed",event=>{
      source.close();setConnected(false);
      let message="A conexão com a sala foi encerrada.";
      try{const data=JSON.parse(event.data);if(typeof data.message==="string")message=data.message;}catch{/* Keep the connection closed on malformed data. */}
      handlers.current.onClosed(message);
    });
    source.onerror=()=>setConnected(false);
    return()=>{source.close();};
    // The stream persists across versions; SSE reconnect resends confirmed events.
  },[code,enabled]);
  return connection.key===streamKey && connection.connected;
}
