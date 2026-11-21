"use client";
import { useEffect, useRef, useState } from "react";
import { gameRoomSyncSchema, matchListSchema, type MatchSummary, lobbyListSchema, realtimeReplySchema, type LobbyList, type GameRoomSync } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { realtimeSocket, retainRealtimeSocket } from "@/lib/realtime";

export function useRoomLive(code: string | undefined, version: number, enabled: boolean, onRoom: (sync: GameRoomSync) => void, onLobbies: (directory: LobbyList) => void, onClosed: (message: string, roomClosed: boolean) => void, onMatches?: (matches: MatchSummary[]) => void, onConnected?:()=>void) {
  const {userId} = useSession();
  const handlers = useRef({ onRoom, onLobbies, onClosed, onMatches, onConnected });
  useEffect(() => { handlers.current = { onRoom, onLobbies, onClosed, onMatches, onConnected }; });
  const key = enabled ? `${userId ?? "visitor"}:${code ?? "directory"}` : null;
  const [connection, setConnection] = useState<{ key: string | null; connected: boolean }>({ key: null, connected: false });
  const confirmedVersion = useRef({ key, version });
  useEffect(() => { confirmedVersion.current = { key, version: confirmedVersion.current.key === key ? Math.max(confirmedVersion.current.version, version) : version }; }, [key, version]);
  useEffect(() => {
    if (!enabled) return;
    const socket = realtimeSocket();
    let active = true;
    let synchronizedVersion = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const status = (connected: boolean) => { if (active) setConnection({ key, connected }); };
    const closed = (data: { message?: string }, roomClosed = false) => { if (!active) return; status(false); handlers.current.onClosed(data.message ?? "A conexão com a sala foi encerrada.", roomClosed); };
    const roomClosed = (data: { message?: string }) => closed(data, true);
    const watch = () => {
      if (!active) return;
      clearTimeout(retryTimer);
      status(false);
      socket.timeout(10000).emit("watch", { code, directory: !!handlers.current.onMatches, afterVersion: Math.max(confirmedVersion.current.version, synchronizedVersion) }, (error: Error | null, value: unknown) => {
        if (!active) return;
        if (error) { status(false); socket.io.engine?.close(); return; }
        const result = realtimeReplySchema.safeParse(value);
        if (!result.success || !result.data.ok) {
          const failure = result.success && !result.data.ok ? result.data.error : undefined;
          closed(failure ?? {}, !!code && failure?.code === "NOT_FOUND");
          // Keep the selected room and recover without reconnecting the transport
          // or feeding an owned-room restore loop while the limit is active.
          if (failure?.code === "RATE_LIMIT") retryTimer = setTimeout(() => { if (active && socket.connected) watch(); }, 60000);
          return;
        }
        status(true);
        handlers.current.onConnected?.();
      });
    };
    const room = (value: unknown) => {
      if (!active) return;
      const parsed = gameRoomSyncSchema.safeParse(value);
      if (!parsed.success) { closed({ message: "Não foi possível sincronizar a sala. Recarregue a página." }); return; }
      if (parsed.data.room.code !== code) return;
      synchronizedVersion = parsed.data.room.version;
      handlers.current.onRoom(parsed.data);
    };
    const directory = (value: unknown) => {
      if (!active) return;
      const result = lobbyListSchema.safeParse(value);
      if (result.success) handlers.current.onLobbies(result.data);
    };
    const matches = (value: unknown) => { if (!active) return; const result = matchListSchema.safeParse(value); if(result.success) handlers.current.onMatches?.(result.data.items); };
    const disconnected = () => { clearTimeout(retryTimer); status(false); };
    socket.on("connect", watch).on("disconnect", disconnected).on("connect_error", disconnected)
      .on("matches", matches).on("room", room).on("lobbies", directory).on("room-closed", roomClosed).on("closed", closed);
    const release = retainRealtimeSocket(userId);
    if (socket.connected) watch();
    return () => {
      active = false;
      clearTimeout(retryTimer);
      socket.off("connect", watch).off("disconnect", disconnected).off("connect_error", disconnected)
        .off("matches", matches).off("room", room).off("lobbies", directory).off("room-closed", roomClosed).off("closed", closed);
      if(socket.connected) socket.emit("watch",{active:false,afterVersion:0},()=>{});
      release();
    };
  }, [code, enabled, key, userId]);
  return connection.key === key && connection.connected;
}
