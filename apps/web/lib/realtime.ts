"use client";
import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;
let users = 0;
let identity: string | null | undefined;
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
    if (!controller.signal.aborted) retry(connection);
  } finally {
    if (connectController === controller) { connecting = undefined; connectController = undefined; }
  }
}
export function realtimeSocket(): Socket {
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
export function retainRealtimeSocket(userId: string | null) {
  const connection = realtimeSocket();
  const changed = identity !== undefined && identity !== userId;
  identity = userId;
  users++;
  if (changed) {
    clearTimeout(retryTimer); retryTimer = undefined;
    connectController?.abort(); connectController = undefined; connecting = undefined;
    connection.disconnect();
  }
  // Session changes require a new handshake, including login while watching.
  if (users === 1 || changed) void connect(connection);
  return () => {
    if (--users === 0) {
      clearTimeout(retryTimer); retryTimer = undefined; retryDelay = 300;
      socket = undefined; identity = undefined;
      connectController?.abort(); connectController = undefined;
      connection.disconnect();
    }
  };
}
