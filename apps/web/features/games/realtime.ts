"use client";
import { io, type Socket } from "socket.io-client";
import { realtimeReplySchema, type RealtimeRequest } from "@croebet/shared";

let socket: Socket | undefined;
let users = 0;
let connecting: Socket | undefined;
let connectController: AbortController | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 300;
const retained = (connection: Socket) => socket === connection && users > 0;

function retry(connection: Socket) {
  if (!retained(connection) || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void connect(connection);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 3000);
}
async function connect(connection: Socket) {
  if (!retained(connection) || connection.connected || connecting === connection) return;
  connecting = connection;
  const controller = new AbortController();
  connectController = controller;
  try {
    // The nonce cookie must exist before the WebSocket HTTP upgrade, including on reconnect.
    const response = await fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) throw new Error("CSRF unavailable");
    const data = await response.json();
    if (typeof data.token !== "string") throw new Error("CSRF unavailable");
    if (!retained(connection)) return;
    connection.auth = { csrf: data.token };
    connection.connect();
  } catch {
    retry(connection);
  } finally {
    if (connecting === connection) connecting = undefined;
    if (connectController === controller) connectController = undefined;
  }
}
export function gameSocket(): Socket {
  if (!socket) {
    const connection = io({
      path: "/api/v1/realtime", addTrailingSlash: false, transports: ["websocket"],
      autoConnect: false, reconnection: false,
    });
    connection.on("connect", () => { retryDelay = 300; });
    connection.on("connect_error", () => retry(connection));
    connection.on("disconnect", reason => {
      if (reason !== "io client disconnect" && reason !== "io server disconnect") retry(connection);
    });
    socket = connection;
  }
  return socket;
}
export function retainGameSocket() {
  const connection = gameSocket();
  // Only the first consumer starts the shared, asynchronous handshake.
  if (users++ === 0) void connect(connection);
  return () => {
    if (--users === 0) {
      clearTimeout(retryTimer); retryTimer = undefined; retryDelay = 300;
      socket = undefined;
      connectController?.abort(); connectController = undefined;
      connection.disconnect();
    }
  };
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
