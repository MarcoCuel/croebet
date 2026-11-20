"use client";
import { useEffect, useRef, useState } from "react";
import { lobbyListSchema, roomSyncSchema, realtimeReplySchema, type LobbyList, type RoomSync } from "@croebet/shared";
import { gameSocket, retainGameSocket } from "../realtime";

export function useMatchLive(code: string | undefined, version: number, enabled: boolean, onRoom: (sync: RoomSync) => void, onLobbies: (directory: LobbyList) => void, onClosed: (message: string) => void) {
  const handlers = useRef({ onRoom, onLobbies, onClosed });
  useEffect(() => { handlers.current = { onRoom, onLobbies, onClosed }; });
  const key = enabled ? code ?? "directory" : null;
  const [connection, setConnection] = useState<{ key: string | null; connected: boolean }>({ key: null, connected: false });
  const confirmedVersion = useRef(version);
  useEffect(() => { confirmedVersion.current = Math.max(confirmedVersion.current, version); }, [version]);
  useEffect(() => {
    if (!enabled) return;
    const socket = gameSocket();
    let active = true;
    let synchronizedVersion = 0;
    const status = (connected: boolean) => { if (active) setConnection({ key, connected }); };
    const closed = (data: { message?: string }) => { status(false); handlers.current.onClosed(data.message ?? "A conexão com a sala foi encerrada."); };
    const watch = () => {
      status(false);
      socket.timeout(10000).emit("watch", { code, afterVersion: Math.max(confirmedVersion.current, synchronizedVersion) }, (error: Error | null, value: unknown) => {
        if (!active) return;
        if (error) { status(false); socket.io.engine?.close(); return; }
        const result = realtimeReplySchema.safeParse(value);
        if (!result.success || !result.data.ok) { closed(result.success && !result.data.ok ? result.data.error : {}); return; }
        status(true);
      });
    };
    const room = (value: unknown) => {
      const result = roomSyncSchema.safeParse(value);
      if (!result.success) { closed({ message: "Não foi possível sincronizar a sala. Recarregue a página." }); return; }
      if (result.data.room.code !== code) return;
      synchronizedVersion = result.data.room.version;
      handlers.current.onRoom(result.data);
    };
    const directory = (value: unknown) => {
      const result = lobbyListSchema.safeParse(value);
      if (result.success) handlers.current.onLobbies(result.data);
    };
    const disconnected = () => status(false);
    socket.on("connect", watch).on("disconnect", disconnected).on("connect_error", disconnected)
      .on("room", room).on("lobbies", directory).on("room-closed", closed).on("closed", closed);
    const release = retainGameSocket();
    if (socket.connected) watch();
    return () => {
      active = false;
      socket.off("connect", watch).off("disconnect", disconnected).off("connect_error", disconnected)
        .off("room", room).off("lobbies", directory).off("room-closed", closed).off("closed", closed);
      if(socket.connected) socket.emit("watch",{afterVersion:0},()=>{});
      release();
    };
  }, [code, enabled, key]);
  return connection.key === key && connection.connected;
}
