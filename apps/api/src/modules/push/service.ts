import type { Pool } from "pg";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sendNotification, setVapidDetails } from "web-push";
import { gameDefinitions, type GameId, type PushSubscriptionInput } from "@croebet/shared";
import { gameDriver } from "../games/registry.ts";

export class PushError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { TTL: number; urgency: "high"; topic?: string },
) => Promise<unknown>;

export type PushOptions = {
  publicKey: string;
  privateKey: string;
  subject: string;
  webOrigin: string;
  /** Injection point for tests; production uses web-push. */
  send?: PushSender;
  resolve?: (hostname: string) => Promise<string[]>;
  now?: () => number;
  log?: { warn: (value: unknown) => void };
};

type MatchRow = { id: string; code: string; status: string; state: unknown; game_slug: string; game_name: string };
type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };
type CountRow = { count: number };

const MAX_DEVICES = 10;
const TURN_TTL_MS = 30 * 60_000;

/** Turn pushes are best-effort: they never block a command or a transaction. */
export function createPushService(pool: Pool, options: PushOptions | null) {
  let config = options;
  if (config && !config.send) {
    try { setVapidDetails(config.subject, config.publicKey, config.privateKey); }
    catch (error) { config.log?.warn?.(error); config = null; }
  }
  const now = config?.now ?? Date.now;
  const send: PushSender = config?.send ?? ((subscription, payload, request) => sendNotification(subscription, payload, request));
  const resolveHost = config?.resolve ?? (async hostname => (await lookup(hostname, { all: true })).map(entry => entry.address));
  const dedupe = new Map<string, number>();
  const allowedHosts = new Map<string, { at: number; ok: boolean }>();

  function privateAddress(address: string) {
    if (isIP(address) === 4) {
      const [first, second] = address.split(".").map(Number);
      return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || first >= 224;
    }
    const value = address.toLowerCase();
    if (value.startsWith("::ffff:")) return privateAddress(value.slice(7));
    return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value);
  }

  // A subscription is a URL the server will call; never allow loopback or a
  // private network target (including through a hostname).
  async function publicEndpoint(endpoint: string) {
    let url: URL;
    try { url = new URL(endpoint); } catch { return false; }
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    const cached = allowedHosts.get(hostname);
    if (cached && now() - cached.at < 5 * 60_000) return cached.ok;
    let ok = false;
    try {
      if (isIP(hostname)) ok = !privateAddress(hostname);
      else { const addresses = await resolveHost(hostname); ok = addresses.length > 0 && addresses.every(address => !privateAddress(address)); }
    } catch { ok = false; }
    allowedHosts.set(hostname, { at: now(), ok });
    return ok;
  }

  function prune() {
    const at = now();
    for (const [key, when] of dedupe) if (at - when > TURN_TTL_MS) dedupe.delete(key);
  }

  async function deliver(userId: string, payload: string) {
    if (!config) return 0;
    const result = await pool.query<SubscriptionRow>("select endpoint,p256dh,auth from push_subscriptions where user_id=$1 order by last_seen_at desc", [userId]);
    let sent = 0;
    for (const row of result.rows) {
      if (!await publicEndpoint(row.endpoint)) { await pool.query("delete from push_subscriptions where endpoint=$1 and user_id=$2", [row.endpoint, userId]); continue; }
      try {
        await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 300, urgency: "high" });
        sent++;
      } catch (error) {
        const status = Number((error as { statusCode?: unknown } | null)?.statusCode ?? 0);
        // The push service no longer knows the device: stop retrying it.
        if (status === 404 || status === 410) await pool.query("delete from push_subscriptions where endpoint=$1 and user_id=$2", [row.endpoint, userId]);
        else config.log?.warn?.(error);
      }
    }
    return sent;
  }

  return {
    status() {
      return { enabled: !!config, publicKey: config?.publicKey ?? null };
    },

    async subscribe(userId: string, input: PushSubscriptionInput, userAgent?: string) {
      if (!config) throw new PushError(503, "PUSH_UNAVAILABLE", "As notificações push não estão configuradas neste servidor.");
      if (!await publicEndpoint(input.endpoint)) throw new PushError(400, "PUSH_ENDPOINT", "Endereço de push inválido.");
      const others = await pool.query<CountRow>("select count(*)::int as count from push_subscriptions where user_id=$1 and endpoint<>$2", [userId, input.endpoint]);
      if (Number(others.rows[0]?.count ?? 0) >= MAX_DEVICES) throw new PushError(409, "PUSH_LIMIT", "Limite de dispositivos atingido. Desative outro aparelho para continuar.");
      await pool.query(`insert into push_subscriptions (user_id,endpoint,p256dh,auth,user_agent) values ($1,$2,$3,$4,$5)
        on conflict (endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=clock_timestamp(),failures=0`,
        [userId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent?.slice(0, 512) ?? null]);
      const total = await pool.query<CountRow>("select count(*)::int as count from push_subscriptions where user_id=$1", [userId]);
      return { subscriptions: Number(total.rows[0]?.count ?? 0) };
    },

    async unsubscribe(userId: string, endpoint: string) {
      if (!config) throw new PushError(503, "PUSH_UNAVAILABLE", "As notificações push não estão configuradas neste servidor.");
      await pool.query("delete from push_subscriptions where user_id=$1 and endpoint=$2", [userId, endpoint]);
      const total = await pool.query<CountRow>("select count(*)::int as count from push_subscriptions where user_id=$1", [userId]);
      return { subscriptions: Number(total.rows[0]?.count ?? 0) };
    },

    async test(userId: string) {
      if (!config) throw new PushError(503, "PUSH_UNAVAILABLE", "As notificações push não estão configuradas neste servidor.");
      const sent = await deliver(userId, JSON.stringify({ title: "Croebet", body: "As notificações push estão ativas neste dispositivo.", icon: "/app-icon-192.png", url: "/", tag: "croebet:test" }));
      return { sent };
    },

    /** Called after every committed room change; online accounts keep using the in-app cue. */
    async dispatchTurn(code: string, isOnline: (userId: string) => boolean) {
      if (!config) return 0;
      const found = await pool.query<MatchRow>(`select m.id,m.code,m.status,m.state,g.slug as game_slug,g.name as game_name
        from game_matches m join games g on g.id=m.game_id where m.code=$1`, [code]);
      const match = found.rows[0];
      if (!match || match.status !== "playing" || !match.state) return 0;
      if (!gameDefinitions[match.game_slug as GameId]?.media.turn) return 0;
      let decision: { seat: number; key: string } | null = null;
      try { decision = gameDriver(match.game_slug as GameId).decision(match.state); }
      catch (error) { config.log?.warn?.(error); return 0; }
      if (!decision) return 0;
      const controller = await pool.query<{ controller_id: string | null }>("select controller_id from game_match_players where match_id=$1 and seat=$2", [match.id, decision.seat]);
      const userId = controller.rows[0]?.controller_id;
      if (!userId || isOnline(userId)) return 0;
      prune();
      const key = `${match.id}:${userId}:${decision.key}`;
      if (dedupe.has(key)) return 0;
      dedupe.set(key, now());
      const url = `${config.webOrigin.replace(/\/$/, "")}/jogos/${match.game_slug}?partida=${match.code}`;
      return deliver(userId, JSON.stringify({ title: "Sua vez", body: `Sua vez em ${match.game_name}.`, icon: "/app-icon-192.png", url, tag: `turn:${match.code}` }));
    },
  };
}

export type PushService = ReturnType<typeof createPushService>;
