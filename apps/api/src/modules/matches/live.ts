import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { matchWatchSchema, realtimeRequestSchema, type RealtimeReply } from "@croebet/shared";
import { tokenHash, validCsrf } from "../auth/security.ts";
import { getRoomSync, listMatches, listLobbies, MatchError, readLobbyInvitations } from "./service.ts";
import { matchNotificationSchema, notificationRefresh, type Refresh } from "./notifications.ts";
import { applyRealtimeRequest } from "./realtime-actions.ts";

type Options = { sessionName: string; maxConnections?: number; csrfName: string; csrfSecret: string; environment: string; origins?: readonly string[]; limit: (key: string, maximum: number) => Promise<boolean> };
type Connection = { actor: string | null; session: string; code?: string; version: number; signature: string; directory: string; invitations: string; matches: string; watching: boolean; directoryWatching: boolean; pending: Refresh; refreshQueued: boolean; tail: Promise<void>; presence: Map<string,string> };
type LiveSocket = Omit<Socket, "data"> & { data: Connection };
const errorReply = (error: unknown): RealtimeReply => ({ ok: false, error: error instanceof MatchError ? { code: error.code, message: error.message } : error instanceof z.ZodError ? { code: "INVALID_INPUT", message: "Dados inválidos." } : { code: "UNAVAILABLE", message: "Não foi possível conectar. Tente novamente." } });

export function matchLive(app: FastifyInstance, pool: Pool, options: Options) {
  const io = new Server(app.server, {
    path: "/api/v1/realtime", addTrailingSlash: false, serveClient: false, transports: ["websocket"],
    maxHttpBufferSize: 65536, pingInterval: 15000, pingTimeout: 10000,
    allowRequest: (request, done) => done(null, !!request.headers.origin && !!options.origins?.includes(request.headers.origin)),
  });
  let listener: PoolClient | undefined;
  let listening: Promise<void> | undefined;
  let stopping = false;
  let maintenance: Promise<void> | undefined;

  async function authorize(c: Connection) {
    if (!c.actor) return;
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
  async function syncPresence(c: Connection) {
    const joined=c.actor && c.watching ? await pool.query<{id:string}>(`select m.id from game_matches m join game_match_players p on p.match_id=m.id where p.controller_id=$1 and m.status in ('lobby','playing')`,[c.actor]) : {rows:[]};
    const wanted=new Set(joined.rows.map(row=>row.id));
    for(const [room,id] of c.presence)if(!wanted.has(room)){
      await pool.query("delete from match_presence where id=$1",[id]);c.presence.delete(room);
    }
    for(const room of wanted)if(!c.presence.has(room)){
      const id=randomUUID();
      await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '30 seconds')",[id,room,c.actor]);
      c.presence.set(room,id);
    }
  }
  async function refresh(socket: LiveSocket, flags: Refresh) {
    const c = socket.data;
    await authorize(c);
    if (flags.presence) await syncPresence(c);
    if (flags.room && c.watching && c.code) {
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

      }
    }
    if (flags.directory && c.directoryWatching) {
      const directory = await listLobbies(pool, c.actor);
      const signature = JSON.stringify(directory);
      if (signature !== c.directory) { socket.emit("lobbies", directory); c.directory = signature; }
    }
    if (flags.matches && c.directoryWatching) {
      const matches = await listMatches(pool, c.actor);
      const signature = JSON.stringify(matches);
      if (signature !== c.matches) { socket.emit("matches", matches); c.matches = signature; }
    }
    if (flags.invitations && c.actor) {
      const invitations = await readLobbyInvitations(pool, c.actor);
      const signature = JSON.stringify(invitations);
      if (signature !== c.invitations) { socket.emit("invitations", invitations); c.invitations = signature; }
    }
  }
  function schedule(socket: LiveSocket, flags: Refresh) {
    const c = socket.data;
    for (const key of Object.keys(flags) as (keyof Refresh)[]) if (flags[key]) c.pending[key] = true;
    if (c.refreshQueued || !Object.keys(c.pending).length) return;
    c.refreshQueued = true;
    enqueue(socket, async () => {
      const pending = c.pending;
      c.pending = {}; c.refreshQueued = false;
      await refresh(socket, pending);
    });
  }
  function changed(payload: string | undefined) {
    const event = matchNotificationSchema.safeParse((() => { try { return JSON.parse(payload ?? ""); } catch { return null; } })());
    if (!event.success) { app.log.error("Invalid match notification"); return; }
    for (const socket of io.sockets.sockets.values()) {
      const live = socket as LiveSocket;
      schedule(live, notificationRefresh(event.data, live.data));
    }
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
      client.on("notification", message => { if (message.channel === "croebet_matches") changed(message.payload); });
      try { await client.query("LISTEN croebet_matches"); listener = client; }
      catch (error) { client.release(true); throw error; }
    })().catch(error => { listening = undefined; throw error; });
  }
  io.use((socket, next) => {
    void (async () => {
      await ensureListener();
      const cookies = app.parseCookie(socket.request.headers.cookie ?? "");
      const token = cookies[options.sessionName];
      if (token && (!/^[A-Za-z0-9_-]{43}$/.test(token) || !validCsrf(options.csrfSecret, cookies[options.csrfName], token, socket.handshake.auth.csrf)))
        throw new MatchError("UNAUTHENTICATED", 401, "Atualize a página e entre novamente.");
      const result = token ? await pool.query<{ user_id: string }>("select user_id from sessions where token_hash=$1", [tokenHash(token)]) : {rows: []};
      if (token && !result.rows[0]) throw new MatchError("UNAUTHENTICATED", 401, "Entre novamente.");
      const data: Connection = { actor: result.rows[0]?.user_id ?? null, session: token ? tokenHash(token) : "", version: 0, signature: "", directory: "", invitations: "", matches: "", watching: false, directoryWatching: false, pending: {}, refreshQueued: false, tail: Promise.resolve(), presence: new Map() };
      await authorize(data);
      if (io.sockets.sockets.size >= (options.maxConnections ?? 200) || [...io.sockets.sockets.values()].filter(s => (data.actor ? s.data.actor === data.actor : s.handshake.address === socket.handshake.address)).length >= 6)
        throw new MatchError("CONNECTION_LIMIT", 429, "Muitas conexões abertas.");
      socket.data = data; next();
    })().catch(error => {
      const reply = errorReply(error);
      next(Object.assign(new Error(reply.ok ? "Conexão indisponível." : reply.error.message), { data: reply }));
    });
  });
  io.on("connection", raw => {
    const socket = raw as LiveSocket;
    if (socket.data.actor) void socket.join(`user:${socket.data.actor}`);
    schedule(socket, { invitations: true });
    socket.on("watch", (value: unknown, ack: (reply: RealtimeReply) => void) => {
      if (typeof ack !== "function") return;
      enqueue(socket, async () => {
        try {
          await authorize(socket.data);
          if (!await options.limit(`watch:${socket.data.actor ?? socket.handshake.address}`, 1200)) throw new MatchError("RATE_LIMIT", 429, "Muitas alterações de sala.");
          const input = matchWatchSchema.parse(value);
          const initial = input.active && input.code ? await getRoomSync(pool, socket.data.actor, input.code, input.afterVersion) : null;
          if (socket.data.code) await socket.leave(`match:${socket.data.code}`);
          socket.data.code = input.active ? input.code : undefined; socket.data.version = input.afterVersion; socket.data.signature = ""; socket.data.watching = input.active; socket.data.directoryWatching = input.active && input.directory;
          if (initial) {
            await socket.join(`match:${initial.room.code}`);
          }
          await refresh(socket, { room: true, directory: true, matches: true, presence: true });
          ack({ ok: true, data: { ok: true } });
        } catch (error) { ack(errorReply(error)); }
      });
    });
    socket.on("request", (value: unknown, ack: (reply: RealtimeReply) => void) => {
      if (typeof ack !== "function") return;
      enqueue(socket, async () => {
        try {
          await authorize(socket.data);
          if (!socket.data.actor) throw new MatchError("UNAUTHENTICATED", 401, "Entre para jogar.");
          const request = realtimeRequestSchema.parse(value);
          if (!await options.limit(`matches:${socket.data.actor}`, 1200)) throw new MatchError("RATE_LIMIT", 429, "Muitas ações. Aguarde e tente novamente.");
          if (request.type === "invite" && !await options.limit(`invitations:${socket.data.actor}`, 30)) throw new MatchError("RATE_LIMIT", 429, "Muitos convites. Aguarde antes de enviar outros.");
          const data = await applyRealtimeRequest(pool, socket.data.actor, socket.data.session, request);
          // Every player, including the sender, receives committed frames here.
          // The acknowledgement is a receipt; it is not a second presentation path.
          let flags: Refresh = { room: true, directory: true, matches: true, presence: true };
          if (request.type === "command") flags = { room: true };
          else if (request.type === "presence") flags = {};
          else if (["invite", "decline", "update"].includes(request.type)) flags = { room: true, directory: true };
          await refresh(socket, flags);
          ack({ ok: true, data });
        } catch (error) { ack(errorReply(error)); }
      });
    });
    socket.on("disconnect", () => { void socket.data.tail.finally(() => pool.query("delete from match_presence where id=any($1::uuid[])", [[...socket.data.presence.values()]])).catch(error => app.log.error(error)); });
  });
  const timer = setInterval(() => {
    if (stopping || maintenance) return;
    maintenance = (async () => {
      if (!io.sockets.sockets.size) return;
      await pool.query("update match_presence set expires_at=clock_timestamp()+interval '30 seconds' where id=any($1::uuid[])", [[...io.sockets.sockets.values()].flatMap(s => [...(s as LiveSocket).data.presence.values()])]);
      await pool.query("delete from match_presence where expires_at<=clock_timestamp()");
      await pool.query("delete from game_match_invitations where expires_at<=clock_timestamp()");
      // Lease/invitation deletions notify affected subscribers; expiry only reauthorizes.
      for (const socket of io.sockets.sockets.values()) schedule(socket as LiveSocket, { auth: true });
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
