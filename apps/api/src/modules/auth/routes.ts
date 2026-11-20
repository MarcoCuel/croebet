import { readRanking } from "../rankings/service.ts";
import { rankingQuerySchema } from "@croebet/shared";
import { refundAccountMatches } from "../matches/economy.ts";
import { matchLifecycleLock } from "../matches/service.ts";
import { matchRoutes } from "../matches/routes.ts";
import { managementRoutes } from "../admin/routes.ts";
import { governanceLock, protectLastAdmin, ManagementError } from "../admin/service.ts";
import { readWallet, readTransactions } from "../wallet/service.ts";
import { economy } from "../economy/config.ts";
import { grantInitialBalance, readDailyStatus, claimDailyReward, RewardError } from "../economy/service.ts";
import { dailyClaimSchema, transactionsQuerySchema } from "@croebet/shared";
import { randomUUID } from "node:crypto";
import { avatarMaxBytes, avatarContentTypes, processAvatar, InvalidAvatar } from "../avatars/image.ts";
import { avatarUrl, validAvatarKey, type AvatarStorage } from "../avatars/storage.ts";
import type { FastifyPluginAsync } from "fastify";
import cookie from "@fastify/cookie";
import { hash, verify, argon2id } from "argon2";
import type { Pool, PoolClient } from "pg";
import { registerSchema, deleteAccountSchema, changeUsernameSchema, loginSchema, profileSchema, publicProfileSchema, publicUserSchema, sessionSchema, usernameSchema } from "@croebet/shared";
import { allowedWebOrigins, type readConfig } from "../../config.ts";
import { newToken, tokenHash, csrfToken, validCsrf } from "./security.ts";
import { readProfileActivity } from "./profile-activity.ts";
import { readOwnMatchReplay } from "../admin/match-history.ts";
import { matchHistoryQuerySchema, matchCodeSchema } from "@croebet/shared";
import { readAccountHistory } from "./account-history.ts";
import { accountHistoryQuerySchema, changePasswordSchema } from "@croebet/shared";

type UserRow = { id: string; username: string; display_name: string; role: "user" | "admin"; status: string; password_hash: string; username_changed_at: Date | null; avatar_key: string | null };
const publicUser = (row: UserRow) => publicUserSchema.parse({ id: row.id, username: row.username, displayName: row.display_name, avatarUrl: avatarUrl(row.avatar_key), usernameChangeAvailableAt: row.username_changed_at ? new Date(row.username_changed_at.getTime() + 30 * 86400000).toISOString() : null, role: row.role });
const passwordHash = (password: string) => hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
let dummyHash: Promise<string> | undefined;
export const authRoutes: FastifyPluginAsync<{ pool: Pool; config: ReturnType<typeof readConfig>; avatarStorage?: AvatarStorage; mediaStorage?: AvatarStorage }> = async (app, { pool, config, avatarStorage, mediaStorage }) => {
  await app.register(cookie);
  const secure = config.APP_ENV === "production";
  const origins = allowedWebOrigins(config);
  const sessionName = secure ? "__Host-croebet-session" : "croebet-session";
  const csrfName = secure ? "__Host-croebet-csrf" : "croebet-csrf";
  const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  app.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "no-store"); });
  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PATCH", "DELETE", "PUT"].includes(request.method)) {
      if (!origins.includes(request.headers.origin ?? "") || !validCsrf(config.CSRF_SECRET, request.cookies[csrfName], request.cookies[sessionName] ?? "", request.headers["x-csrf-token"]))
        return reply.code(403).send({ error: { code: "CSRF_INVALID", message: "Atualize a página e tente novamente." } });
    }
    const identity = await pool.query("select environment from application_environment where id = 1");
    if (identity.rows[0]?.environment !== config.APP_ENV) return reply.code(503).send({ error: { code: "UNAVAILABLE", message: "Serviço indisponível." } });
  });
  async function limit(key: string, maximum: number) {
    const result = await pool.query(`insert into auth_rate_limits (key, window_start, attempts) values ($1, date_trunc('hour', now()), 1)
      on conflict (key) do update set attempts = case when auth_rate_limits.window_start = date_trunc('hour', now()) then auth_rate_limits.attempts + 1 else 1 end,
      window_start = date_trunc('hour', now()) returning attempts`, [tokenHash(key)]);
    return result.rows[0].attempts <= maximum;
  }
  async function current(token: string | undefined): Promise<UserRow | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const result = await pool.query(`update sessions s set idle_expires_at = least(s.expires_at, now() + interval '7 days') from users u
      where s.token_hash = $1 and s.user_id = u.id and u.status = 'active' and s.expires_at > now() and s.idle_expires_at > now()
      returning u.id, u.username, u.display_name, u.role, u.status, u.password_hash, u.username_changed_at, u.avatar_key`, [tokenHash(token)]);
    return result.rows[0] ?? null;
  }
  async function issue(client: PoolClient, userId: string) {
    const token = newToken();
    await client.query("insert into sessions (token_hash, user_id, expires_at, idle_expires_at) values ($1, $2, now() + interval '30 days', now() + interval '7 days')", [tokenHash(token), userId]);
    return token;
  }

  app.get("/api/v1/rankings", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const input = rankingQuerySchema.safeParse(request.query);
    if (!input.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: "Filtros de ranking inválidos." } });
    const user = await current(request.cookies[sessionName]);
    return readRanking(pool, input.data, user?.id ?? null);
  });
  await managementRoutes(app, { pool, current, sessionName, limit, mediaStorage });
  await matchRoutes(app, { pool, current, sessionName, maxConnections: config.REALTIME_MAX_CONNECTIONS, limit, origins, csrfName, csrfSecret: config.CSRF_SECRET, environment: config.APP_ENV });

  if (avatarStorage || mediaStorage) app.addContentTypeParser(avatarContentTypes, { parseAs: "buffer", bodyLimit: avatarMaxBytes }, (_request, body, done) => done(null, body));
  if (avatarStorage) {
    app.get<{ Params: { key: string } }>("/api/v1/avatars/:key", async (request, reply) => {
      const { key } = request.params;
      if (!validAvatarKey(key)) return reply.code(404).send();
      const used = await pool.query("select 1 from users where avatar_key = $1 and status = 'active'", [key]);
      if (!used.rows.length) return reply.code(404).send();
      // Every upload has a new immutable UUID key. Revalidate ownership even on cache hits.
      const etag = `"${key}"`;
      const cacheHeaders = { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
      const validators = request.headers["if-none-match"]?.split(",").map(value => value.trim());
      if (validators?.some(value => value === "*" || value.replace(/^W\//, "") === etag))
        return reply.headers(cacheHeaders).code(304).send();
      try {
        const image = await avatarStorage.get(key);
        return reply.type("image/webp").headers(cacheHeaders).send(image);
      } catch {
        return reply.code(503).send({ error: { code: "AVATAR_UNAVAILABLE", message: "Foto temporariamente indisponível." } });
      }
    });
    async function changeAvatar(token: string, key: string | null) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const locked = await client.query(`select u.* from users u join sessions s on s.user_id = u.id
          where s.token_hash = $1 and u.status = 'active' and s.expires_at > clock_timestamp()
          and s.idle_expires_at > clock_timestamp() for update of u, s`, [tokenHash(token)]);
        const user = locked.rows[0] as UserRow | undefined;
        if (!user) { await client.query("rollback"); return null; }
        const updated = await client.query("update users set avatar_key = $1 where id = $2 returning *", [key, user.id]);
        if (key) await client.query("delete from avatar_cleanup where key = $1", [key]);
        if (user.avatar_key) await client.query("insert into avatar_cleanup (key) values ($1) on conflict do nothing", [user.avatar_key]);
        await client.query("commit");
        return publicUser(updated.rows[0]);
      } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
    }
    app.put("/api/v1/me/avatar", {
      bodyLimit: avatarMaxBytes,
      onRequest: async (request, reply) => {
        // Reject unauthorized uploads before buffering/decoding an image.
        if (!origins.includes(request.headers.origin ?? "") || !validCsrf(config.CSRF_SECRET, request.cookies[csrfName], request.cookies[sessionName] ?? "", request.headers["x-csrf-token"]))
          return reply.code(403).send({ error: { code: "CSRF_INVALID", message: "Atualize a página e tente novamente." } });
        const user = await current(request.cookies[sessionName]);
        if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
        if (!await limit(`avatar:${user.id}`, 20)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas alterações de foto. Tente novamente mais tarde." } });
      },
    }, async (request, reply) => {
      let image: Buffer;
      try {
        if (!Buffer.isBuffer(request.body)) throw new InvalidAvatar("Escolha uma imagem JPG, PNG ou WebP.");
        image = await processAvatar(request.body, request.headers["content-type"]?.split(";")[0].trim().toLowerCase() ?? "");
      } catch (error) {
        if (error instanceof InvalidAvatar) return reply.code(400).send({ error: { code: "INVALID_AVATAR", message: error.message } });
        throw error;
      }
      const key = `${randomUUID()}.webp`;
      // Reserve cleanup before writing: a crash never loses track of a staged object.
      await pool.query("insert into avatar_cleanup (key, delete_after) values ($1, now() + interval '1 hour')", [key]);
      try {
        await avatarStorage.put(key, image);
        const user = await changeAvatar(request.cookies[sessionName]!, key);
        if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
        return sessionSchema.parse({ user });
      } catch {
        return reply.code(503).send({ error: { code: "AVATAR_SAVE_FAILED", message: "Não foi possível salvar a foto. Tente novamente." } });
      }
    });
    app.delete("/api/v1/me/avatar", async (request, reply) => {
      const token = request.cookies[sessionName];
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
      const user = await changeAvatar(token, null);
      if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
      return sessionSchema.parse({ user });
    });
  }
  app.get("/api/v1/auth/csrf", async (request, reply) => {
    const nonce = newToken(); reply.setCookie(csrfName, nonce, { ...cookieOptions, maxAge: 3600 });
    return { token: csrfToken(config.CSRF_SECRET, nonce, request.cookies[sessionName] ?? "") };
  });
  app.get("/api/v1/me", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user && request.cookies[sessionName]) reply.clearCookie(sessionName, cookieOptions);
    return sessionSchema.parse({ user: user ? publicUser(user) : null });
  });
  app.get("/api/v1/economy", async () => economy);
  app.get("/api/v1/rewards/daily", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    return readDailyStatus(pool, user.id);
  });
  app.post("/api/v1/rewards/daily/claim", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const input = dailyClaimSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Pedido de resgate inválido." } });
    if (!await limit(`daily:${user.id}`, 120)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    try { return await claimDailyReward(pool, user.id, tokenHash(request.cookies[sessionName]!), input.data.requestId); }
    catch (error) {
      if (error instanceof RewardError) return reply.code(error.code === "UNAUTHENTICATED" ? 401 : 409).send({ error: {
        code: error.code, message: error.code === "UNAUTHENTICATED" ? "Entre novamente." : "Você já resgatou hoje. Volte à meia-noite no horário de São Paulo.",
      } });
      throw error;
    }
  });
  app.get("/api/v1/me/wallet", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    return readWallet(pool, user.id);
  });
  app.get("/api/v1/me/transactions", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const query = transactionsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Paginação inválida." } });
    return readTransactions(pool, user.id, query.data.limit, query.data.offset, query.data.direction);
  });
  app.get("/api/v1/me/history", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const query = accountHistoryQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Paginação inválida." } });
    return readAccountHistory(pool, user.id, query.data.limit, query.data.offset);
  });
  app.get<{ Params: { code: string } }>("/api/v1/me/matches/:code", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const id = matchCodeSchema.safeParse(request.params.code);
    if (!id.success) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Partida não encontrada." } });
    const query = matchHistoryQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Paginação inválida." } });
    try { return await readOwnMatchReplay(pool, user.id, id.data, query.data.offset, query.data.limit); }
    catch (error) {
      if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      throw error;
    }
  });
  app.get<{ Params: { username: string } }>("/api/v1/profiles/:username", async (request, reply) => {
    const parsed = usernameSchema.safeParse(request.params.username);
    if (parsed.success) {
      const result = await pool.query("select id, username, display_name, avatar_key from users where lower(username) = $1 and status = 'active'", [parsed.data.toLowerCase()]);
      const user = result.rows[0];
      if (user) return publicProfileSchema.parse({ username: user.username, displayName: user.display_name, avatarUrl: avatarUrl(user.avatar_key), activity: await readProfileActivity(pool, user.id) });
    }
    return reply.code(404).send({ error: { code: "PROFILE_NOT_FOUND", message: "Perfil não encontrado." } });
  });
  app.post("/api/v1/auth/register", async (request, reply) => {
    if (!await limit(`register:${request.ip}`, 10)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0].message } });
    const password = await passwordHash(parsed.data.password);
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query("insert into users (username, display_name, password_hash) values ($1, $1, $2) returning *", [parsed.data.username, password]);
      const user = result.rows[0] as UserRow;
      await grantInitialBalance(client, user.id);
      // Rotate an existing browser session, never keep a caller-chosen session ID.
      if (request.cookies[sessionName]) await client.query("delete from sessions where token_hash = $1", [tokenHash(request.cookies[sessionName])]);
      const token = await issue(client, user.id);
      await client.query("commit");
      reply.setCookie(sessionName, token, { ...cookieOptions, maxAge: 30 * 86400 });
      return reply.code(201).send(sessionSchema.parse({ user: publicUser(user) }));
    } catch (error) {
      await client.query("rollback");
      if (error && typeof error === "object" && "code" in error && error.code === "23505") return reply.code(409).send({ error: { code: "USERNAME_TAKEN", message: "Este nome de usuário já está em uso." } });
      throw error;
    } finally { client.release(); }
  });
  app.post("/api/v1/auth/login", async (request, reply) => {
    if (!await limit(`login-ip:${request.ip}`, 60)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Confira usuário e senha." } });
    const usernameLookup = parsed.data.username.toLowerCase();
    if (!await limit(`login-user:${usernameLookup}`, 15)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    const found = await pool.query("select * from users where lower(username) = $1", [usernameLookup]);
    const user = found.rows[0] as UserRow | undefined;
    const valid = await verify(user?.password_hash ?? await (dummyHash ??= passwordHash(newToken())), parsed.data.password);
    if (!valid || !user || user.status !== "active") return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos." } });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const active = await client.query("select status, password_hash from users where id = $1 for update", [user.id]);
      if (active.rows[0]?.status !== "active" || active.rows[0].password_hash !== user.password_hash) { await client.query("rollback"); return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos." } }); }
      if (request.cookies[sessionName]) await client.query("delete from sessions where token_hash = $1", [tokenHash(request.cookies[sessionName])]);
      const token = await issue(client, user.id); await client.query("commit");
      reply.setCookie(sessionName, token, { ...cookieOptions, maxAge: 30 * 86400 });
      return sessionSchema.parse({ user: publicUser(user) });
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  });
  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (request.cookies[sessionName]) await pool.query("delete from sessions where token_hash = $1", [tokenHash(request.cookies[sessionName])]);
    reply.clearCookie(sessionName, cookieOptions); reply.clearCookie(csrfName, cookieOptions); return reply.code(204).send();
  });
  app.patch("/api/v1/me/password", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    if (!await limit(`password:${user.id}`, 10)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0].message } });
    if (!await verify(user.password_hash, parsed.data.currentPassword)) return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Senha atual incorreta." } });
    const nextHash = await passwordHash(parsed.data.newPassword);
    const client = await pool.connect();
    try {
      await client.query("begin");
      const locked = await client.query("select status, password_hash from users where id=$1 for update", [user.id]);
      const session = await client.query(`select 1 from sessions where user_id=$1 and token_hash=$2
        and expires_at > clock_timestamp() and idle_expires_at > clock_timestamp() for update`, [user.id, tokenHash(request.cookies[sessionName]!)]);
      if (locked.rows[0]?.status !== "active" || locked.rows[0].password_hash !== user.password_hash || !session.rows.length) {
        await client.query("rollback");
        return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
      }
      await client.query("update users set password_hash=$1 where id=$2", [nextHash, user.id]);
      await client.query("delete from sessions where user_id=$1 and token_hash<>$2", [user.id, tokenHash(request.cookies[sessionName]!)]);
      await client.query("commit");
      return reply.code(204).send();
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  });
  app.delete("/api/v1/me", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    if (!await limit(`delete-account:${user.id}`, 10)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    const parsed = deleteAccountSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Informe sua senha atual." } });
    if (!await verify(user.password_hash, parsed.data.password)) return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Senha incorreta." } });
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(matchLifecycleLock);
      await client.query(governanceLock);
      const locked = await client.query(`select u.id, u.avatar_key, u.role, u.status from users u join sessions s on s.user_id = u.id
        where u.id = $1 and u.status = 'active' and u.password_hash = $2 and s.token_hash = $3
        and s.expires_at > clock_timestamp() and s.idle_expires_at > clock_timestamp() for update of u, s`,
        [user.id, user.password_hash, tokenHash(request.cookies[sessionName]!)]);
      if (!locked.rows[0]) { await client.query("rollback"); return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } }); }
      await protectLastAdmin(client, locked.rows[0], { role: "user", status: "suspended" });
      await client.query("delete from sessions where user_id = $1", [user.id]);
      if (locked.rows[0].avatar_key) await client.query("insert into avatar_cleanup (key) values ($1) on conflict do nothing", [locked.rows[0].avatar_key]);
      await refundAccountMatches(client,user.id);
      await client.query("delete from game_matches where created_by=$1 or owner_id=$1 or id in (select match_id from game_match_players where user_id=$1)", [user.id]);
      await client.query("delete from users where id = $1", [user.id]);
      await client.query("commit");
      reply.clearCookie(sessionName, cookieOptions); reply.clearCookie(csrfName, cookieOptions);
      return reply.code(204).send();
    } catch (error) {
      await client.query("rollback");
      if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      throw error;
    } finally { client.release(); }
  });
  app.patch("/api/v1/me/username", async (request, reply) => {
    const token = request.cookies[sessionName];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const data = changeUsernameSchema.safeParse(request.body);
    if (!data.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: data.error.issues[0].message } });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const locked = await client.query(`select u.* from users u join sessions s on s.user_id = u.id
        where s.token_hash = $1 and u.status = 'active' and s.expires_at > clock_timestamp()
        and s.idle_expires_at > clock_timestamp() for update of u, s`, [tokenHash(token)]);
      const user = locked.rows[0] as UserRow | undefined;
      if (!user) { await client.query("rollback"); return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } }); }
      if (user.username === data.data.username) { await client.query("commit"); return sessionSchema.parse({ user: publicUser(user) }); }
      const updated = await client.query(`update users set username = $1, username_changed_at = clock_timestamp()
        where id = $2 and (username_changed_at is null or username_changed_at + interval '720 hours' <= clock_timestamp()) returning *`, [data.data.username, user.id]);
      if (!updated.rows[0]) {
        await client.query("rollback");
        return reply.code(409).send({ error: { code: "USERNAME_CHANGE_COOLDOWN", message: "Você pode alterar seu usuário apenas uma vez a cada 30 dias." }, usernameChangeAvailableAt: publicUser(user).usernameChangeAvailableAt });
      }
      await client.query("commit");
      return sessionSchema.parse({ user: publicUser(updated.rows[0]) });
    } catch (error) {
      await client.query("rollback");
      if (error && typeof error === "object" && "code" in error && error.code === "23505") return reply.code(409).send({ error: { code: "USERNAME_TAKEN", message: "Este nome de usuário já está em uso." } });
      throw error;
    } finally { client.release(); }
  });
  app.patch("/api/v1/me/profile", async (request, reply) => {
    const user = await current(request.cookies[sessionName]);
    if (!user) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    const data = profileSchema.safeParse(request.body);
    if (!data.success) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Informe um nome de 1 a 40 caracteres." } });
    await pool.query("update users set display_name = $1 where id = $2 and status = 'active'", [data.data.displayName, user.id]);
    return sessionSchema.parse({ user: { ...publicUser(user), displayName: data.data.displayName } });
  });
};
