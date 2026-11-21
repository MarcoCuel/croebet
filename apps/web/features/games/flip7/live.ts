"use client";
import { useEffect, useRef, useState } from "react";
import { gameRoomSyncSchema, matchListSchema, type MatchSummary, lobbyListSchema, roomSyncSchema, realtimeReplySchema, type LobbyList, type RoomSync } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { gameSocket, retainGameSocket } from "../realtime";

export function useMatchLive(code: string | undefined, version: number, enabled: boolean, onRoom: (sync: RoomSync) => void, onLobbies: (directory: LobbyList) => void, onClosed: (message: string) => void, onMatches?: (matches: MatchSummary[]) => void, onOtherGame?:(code:string,sync:ReturnType<typeof gameRoomSyncSchema.parse>)=>void) {
  const {userId} = useSession();
  const handlers = useRef({ onRoom, onLobbies, onClosed, onMatches, onOtherGame });
  useEffect(() => { handlers.current = { onRoom, onLobbies, onClosed, onMatches, onOtherGame }; });
  const key = enabled ? `${userId ?? "visitor"}:${code ?? "directory"}` : null;
  const [connection, setConnection] = useState<{ key: string | null; connected: boolean }>({ key: null, connected: false });
  const confirmedVersion = useRef({ key, version });
  useEffect(() => { confirmedVersion.current = { key, version: confirmedVersion.current.key === key ? Math.max(confirmedVersion.current.version, version) : version }; }, [key, version]);
  useEffect(() => {
    if (!enabled) return;
    const socket = gameSocket();
    let active = true;
    let synchronizedVersion = 0;
    const status = (connected: boolean) => { if (active) setConnection({ key, connected }); };
    const closed = (data: { message?: string }) => { if (!active) return; status(false); handlers.current.onClosed(data.message ?? "A conexão com a sala foi encerrada."); };
    const watch = () => {
      if (!active) return;
      status(false);
      socket.timeout(10000).emit("watch", { code, directory: !!handlers.current.onMatches, afterVersion: Math.max(confirmedVersion.current.version, synchronizedVersion) }, (error: Error | null, value: unknown) => {
        if (!active) return;
        if (error) { status(false); socket.io.engine?.close(); return; }
        const result = realtimeReplySchema.safeParse(value);
        if (!result.success || !result.data.ok) { closed(result.success && !result.data.ok ? result.data.error : {}); return; }
        status(true);
      });
    };
    const room = (value: unknown) => {
      if (!active) return;
      const parsed = gameRoomSyncSchema.safeParse(value);
      if (!parsed.success) { closed({ message: "Não foi possível sincronizar a sala. Recarregue a página." }); return; }
      if (parsed.data.room.code !== code) return;
      synchronizedVersion = parsed.data.room.version;
      const result = roomSyncSchema.safeParse(parsed.data);
      if (result.success) handlers.current.onRoom(result.data);
      else handlers.current.onOtherGame?.(code!, parsed.data);
    };
    const directory = (value: unknown) => {
      if (!active) return;
      const result = lobbyListSchema.safeParse(value);
      if (result.success) handlers.current.onLobbies(result.data);
    };
    const matches = (value: unknown) => { if (!active) return; const result = matchListSchema.safeParse(value); if(result.success) handlers.current.onMatches?.(result.data.items); };
    const disconnected = () => status(false);
    socket.on("connect", watch).on("disconnect", disconnected).on("connect_error", disconnected)
      .on("matches", matches).on("room", room).on("lobbies", directory).on("room-closed", closed).on("closed", closed);
    const release = retainGameSocket(userId);
    if (socket.connected) watch();
    return () => {
      active = false;
      socket.off("connect", watch).off("disconnect", disconnected).off("connect_error", disconnected)
        .off("matches", matches).off("room", room).off("lobbies", directory).off("room-closed", closed).off("closed", closed);
      if(socket.connected) socket.emit("watch",{active:false,afterVersion:0},()=>{});
      release();
    };
  }, [code, enabled, key, userId]);
  return connection.key === key && connection.connected;
}
