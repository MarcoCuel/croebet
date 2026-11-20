"use client";
import { io, type Socket } from "socket.io-client";
import { realtimeReplySchema, type RealtimeRequest } from "@croebet/shared";

let socket: Socket | undefined;
let users = 0;

export function gameSocket(): Socket {
  socket ??= io({
    path: "/api/v1/realtime", transports: ["websocket"], autoConnect: false,
    reconnectionDelay: 300, reconnectionDelayMax: 3000,
    auth: callback => {
      void fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store" })
        .then(async response => { if (!response.ok) throw new Error("CSRF unavailable"); return response.json(); })
        .then(data => callback({ csrf: data.token }))
        .catch(() => callback({ csrf: "" }));
    },
  });
  return socket;
}
export function retainGameSocket() {
  const connection = gameSocket(); users++;
  if (!connection.connected) connection.connect();
  return () => { if (--users === 0) { connection.disconnect(); socket = undefined; } };
}
export async function realtimeRequest<T>(request: RealtimeRequest, schema: { parse: (value: unknown) => T }): Promise<T> {
  const connection = gameSocket();
  if (!connection.connected) throw new Error("Aguarde a reconexão e tente novamente.");
  // Never buffer a decision for a future reconnect: retries keep their commandId.
  let response: unknown;
  try { response = await connection.timeout(10000).emitWithAck("request", request); }
  catch { throw new Error("Não foi possível confirmar a ação. Tente novamente."); }
  const reply = realtimeReplySchema.parse(response);
  if (!reply.ok) throw new Error(reply.error.message);
  return schema.parse(reply.data);
}
