import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { matchWatchSchema, realtimeRequestSchema, type RealtimeReply } from "@croebet/shared";
import { tokenHash, validCsrf } from "../auth/security.ts";
import { getRoomSync, listLobbies, MatchError, readLobbyInvitations } from "./service.ts";
import { applyRealtimeRequest } from "./realtime-actions.ts";

type Options = { sessionName: string; csrfName: string; csrfSecret: string; environment: string; origin?: string; limit: (key: string, maximum: number) => Promise<boolean> };
type Connection = { actor: string; session: string; id: string; code?: string; version: number; signature: string; directory: string; invitations: string; watching: boolean; tail: Promise<void> };
type LiveSocket = Socket & { data: Connection };
const errorReply = (error: unknown): RealtimeReply => ({ ok: false, error: error instanceof MatchError ? { code: error.code, message: error.message } : error instanceof z.ZodError ? { code: "INVALID_INPUT", message: "Dados inválidos." } : { code: "UNAVAILABLE", message: "Não foi possível conectar. Tente novamente." } });

export function matchLive(app: FastifyInstance, pool: Pool, options: Options) {
  const io = new Server(app.server, {
    path: "/api/v1/realtime", serveClient: false, transports: ["websocket"],
    maxHttpBufferSize: 65536, pingInterval: 15000, pingTimeout: 10000,
    allowRequest: (request, done) => done(null, !!options.origin && request.headers.origin === options.origin),
  });
  let listener: PoolClient | undefined;
  let listening: Promise<void> | undefined;
  let stopping = false;
  let maintenance: Promise<void> | undefined;

  async function authorize(c: Connection) {
    const result = await pool.query(`select 1 from sessions s join users u on u.id=s.user_id
      where s.token_hash=$1 and s.user_id=$2 and u.status='active'
      and s.expires_at>clock_timestamp() and s.idle_expires_at>clock_timestamp()
      and exists(select 1 from application_environment where id=1 and environment=$3)`, [c.session, c.actor, options.environment]);
    if (!result.rows.length) throw new MatchError("UNAUTHENTICATED", 401, "Entre novamente.");
  }
  function close(socket: LiveSocket, error: unknown) {
    const reply = errorReply(error);
    if (!reply.ok) socket.emit("closed", reply.error);
    socket.disconnect(true);
  }
  function enqueue(socket: LiveSocket, action: () => Promise<void>) {
    socket.data.tail = socket.data.tail.then(async () => {
      if (socket.connected) await action();
    }).catch(error => close(socket, error));
  }
  async function refresh(socket: LiveSocket) {
    const c = socket.data;
    await authorize(c);
    if (c.watching && c.code) {
      try {
        const sync = await getRoomSync(pool, c.actor, c.code, c.version);
        const signature = JSON.stringify(sync.room);
        if (signature !== c.signature || sync.room.version !== c.version) {
          socket.emit("room", sync);
          c.version = sync.room.version; c.signature = signature;
        }
      } catch (error) {
        // Losing a table does not remove the user's global invitation connection.
        if (!(error instanceof MatchError)) throw error;
        socket.emit("room-closed", { code: error.code, message: error.message });
        await socket.leave(`match:${c.code}`);
        c.code = undefined; c.signature = "";
        await pool.query("delete from match_presence where id=$1", [c.id]);
      }
    }
    const [directory, invitations] = await Promise.all([listLobbies(pool, c.actor), readLobbyInvitations(pool, c.actor)]);
    const signature = JSON.stringify(directory);
    if (signature !== c.directory) { socket.emit("lobbies", directory); c.directory = signature; }
    const inbox = JSON.stringify(invitations);
    if (inbox !== c.invitations) { socket.emit("invitations", invitations); c.invitations = inbox; }
  }
  function changed() {
    for (const socket of io.sockets.sockets.values()) enqueue(socket as LiveSocket, () => refresh(socket as LiveSocket));
  }
  // LISTEN is a wake-up signal, never a source of game state or secret cards.
  // A reconnect performs a complete authorized refresh to recover missed signals.
  function ensureListener(): Promise<void> {
    return listening ??= (async () => {
      const client = await pool.connect();
      const lost = () => {
        if (listener !== client) return;
        listener = undefined; listening = undefined; client.release(true);
        for (const socket of io.sockets.sockets.values()) socket.conn.close();
      };
      client.on("error", lost);
      client.on("end", lost);
      client.on("notification", message => { if (message.channel === "croebet_matches") changed(); });
      try { await client.query("LISTEN croebet_matches"); listener = client; }
      catch (error) { client.release(true); throw error; }
    })().catch(error => { listening = undefined; throw error; });
  }
  io.use((socket, next) => {
    void (async () => {
      await ensureListener();
      const cookies = app.parseCookie(socket.request.headers.cookie ?? "");
      const token = cookies[options.sessionName];
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !validCsrf(options.csrfSecret, cookies[options.csrfName], token, socket.handshake.auth.csrf))
        throw new MatchError("UNAUTHENTICATED", 401, "Atualize a página e entre novamente.");
      const result = await pool.query<{ user_id: string }>("select user_id from sessions where token_hash=$1", [tokenHash(token)]);
      if (!result.rows[0]) throw new MatchError("UNAUTHENTICATED", 401, "Entre novamente.");
      const data: Connection = { actor: result.rows[0].user_id, session: tokenHash(token), id: randomUUID(), version: 0, signature: "", directory: "", invitations: "", watching: false, tail: Promise.resolve() };
      await authorize(data);
      if (io.sockets.sockets.size >= 200 || [...io.sockets.sockets.values()].filter(s => s.data.actor === data.actor).length >= 6)
        throw new MatchError("CONNECTION_LIMIT", 429, "Muitas conexões abertas.");
      socket.data = data; next();
    })().catch(error => {
      const reply = errorReply(error);
      next(Object.assign(new Error(reply.ok ? "Conexão indisponível." : reply.error.message), { data: reply }));
    });
  });
  io.on("connection", raw => {
    const socket = raw as LiveSocket;
    void socket.join(`user:${socket.data.actor}`);
    enqueue(socket, () => refresh(socket));
    socket.on("watch", (value: unknown, ack: (reply: RealtimeReply) => void) => {
      if (typeof ack !== "function") return;
      enqueue(socket, async () => {
        try {
          await authorize(socket.data);
          if (!await options.limit(`watch:${socket.data.actor}`, 1200)) throw new MatchError("RATE_LIMIT", 429, "Muitas alterações de sala.");
          const input = matchWatchSchema.parse(value);
          const initial = input.code ? await getRoomSync(pool, socket.data.actor, input.code, input.afterVersion) : null;
          if (socket.data.code) await socket.leave(`match:${socket.data.code}`);
          await pool.query("delete from match_presence where id=$1", [socket.data.id]);
          socket.data.code = input.code; socket.data.version = input.afterVersion; socket.data.signature = ""; socket.data.watching = true;
          if (initial) {
            await socket.join(`match:${initial.room.code}`);
            await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '30 seconds')", [socket.data.id, initial.room.id, socket.data.actor]);
          }
          await refresh(socket);
          ack({ ok: true, data: { ok: true } });
        } catch (error) { ack(errorReply(error)); }
      });
    });
    socket.on("request", (value: unknown, ack: (reply: RealtimeReply) => void) => {
      if (typeof ack !== "function") return;
      enqueue(socket, async () => {
        try {
          await authorize(socket.data);
          const request = realtimeRequestSchema.parse(value);
          if (!await options.limit(`matches:${socket.data.actor}`, 1200)) throw new MatchError("RATE_LIMIT", 429, "Muitas ações. Aguarde e tente novamente.");
          if (request.type === "invite" && !await options.limit(`invitations:${socket.data.actor}`, 30)) throw new MatchError("RATE_LIMIT", 429, "Muitos convites. Aguarde antes de enviar outros.");
          const data = await applyRealtimeRequest(pool, socket.data.actor, socket.data.session, request);
          // Every player, including the sender, receives committed frames here.
          // The acknowledgement is a receipt; it is not a second presentation path.
          await refresh(socket);
          ack({ ok: true, data });
        } catch (error) { ack(errorReply(error)); }
      });
    });
    socket.on("disconnect", () => { void socket.data.tail.finally(() => pool.query("delete from match_presence where id=$1", [socket.data.id])).catch(error => app.log.error(error)); });
  });
  const timer = setInterval(() => {
    if (stopping || maintenance) return;
    maintenance = (async () => {
      if (!io.sockets.sockets.size) return;
      await pool.query("update match_presence set expires_at=clock_timestamp()+interval '30 seconds' where id=any($1::uuid[])", [[...io.sockets.sockets.values()].map(s => s.data.id)]);
      await pool.query("delete from match_presence where expires_at<=clock_timestamp()");
      changed(); // Lease expiry, invitation expiry and session expiry; no gameplay polling.
    })().catch(error => { app.log.error(error); for (const socket of io.sockets.sockets.values()) socket.conn.close(); }).finally(() => { maintenance = undefined; });
  }, 15000);
  timer.unref();
  app.addHook("preClose", async () => {
    stopping = true; clearInterval(timer);
    const tails = [...io.sockets.sockets.values()].map(s => s.data.tail as Promise<void>);
    await new Promise<void>(resolve => io.close(() => resolve()));
    await Promise.allSettled(tails); await maintenance;
    if (listener) { const client = listener; listener = undefined; await client.query("UNLISTEN croebet_matches"); client.release(); }
  });
}
