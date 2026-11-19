import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import sharp from "sharp";
import { cleanupAvatars } from "../../dist/modules/avatars/cleanup.js";
import { readConfig } from "../../dist/config.js";
import { tokenHash } from "../../dist/modules/auth/security.js";
test("PostgreSQL e HTTP reais: conta, cookies, senha, CSRF, suspensão e logout", async t => {
 if (!process.env.TEST_DATABASE_URL) throw new Error("Configure TEST_DATABASE_URL para um banco isolado migrado com seed test.");
 const config = readConfig({ APP_ENV: "test", DATABASE_URL: process.env.TEST_DATABASE_URL, CSRF_SECRET: "teste-isolado-segredo-com-mais-de-32-caracteres", WEB_ORIGIN: "http://localhost:3000" });
 const { pool } = createDatabase(config.DATABASE_URL);
 assert.equal((await pool.query("select environment from application_environment where id = 1")).rows[0]?.environment, "test");
 const app = createApp(async () => {});
 const avatarFiles = new Map();
 const avatarKeys = [];
 const avatarStorage = { put: async (key, bytes) => { avatarKeys.push(key); avatarFiles.set(key, bytes); }, get: async key => avatarFiles.get(key), remove: async key => { avatarFiles.delete(key); } };
 await app.register(authRoutes, { pool, config, avatarStorage });
 const username = "Test_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const concurrentUsername = "Race_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const limitedUsername = "Limit_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const remoteAddress = `127.${[...randomBytes(3)].join(".")}`;
 const usernames = [username, concurrentUsername].map(value => value.toLowerCase());
 const rateKeys = [`register:${remoteAddress}`, `login-ip:${remoteAddress}`, ...[...usernames, limitedUsername.toLowerCase()].map(value => `login-user:${value}`)].map(tokenHash);
 const password = "senha longa para os testes";
 t.after(async () => { await app.close(); try { await pool.query("delete from sessions where user_id in (select id from users where lower(username) = any($1::text[]))", [usernames]); await pool.query("delete from users where lower(username) = any($1::text[])", [usernames]); await pool.query("delete from auth_rate_limits where key = any($1::text[])", [rateKeys]); await pool.query("delete from avatar_cleanup where key = any($1::text[])", [avatarKeys]); } finally { await pool.end(); } });
 let jar = {};
 const remember = response => { for (const c of response.cookies) { if (c.value) jar[c.name] = c.value; else delete jar[c.name]; } };
 async function request(url, method = "GET", body, origin = config.WEB_ORIGIN) {
   let csrf;
   if (method !== "GET") { const r = await app.inject({ url: "/api/v1/auth/csrf", cookies: jar }); remember(r); csrf = r.json().token; }
   const r = await app.inject({ url, method, remoteAddress, cookies: jar, headers: { origin, ...(csrf ? { "x-csrf-token": csrf } : {}), ...(Buffer.isBuffer(body) ? { "content-type": "image/png" } : {}) }, ...(body ? { payload: body } : {}) }); remember(r); return r;
 }
 assert.equal((await app.inject({ url: "/api/v1/auth/register", method: "POST", payload: { username, password } })).statusCode, 403);
 const registered = await request("/api/v1/auth/register", "POST", { username, password });
 assert.equal(registered.statusCode, 201); assert.equal(registered.json().user.role, "user");
 assert.equal(registered.json().user.username, username);
 assert.equal(registered.json().user.displayName, username);
 const stored = await pool.query("select username, display_name from users where id=$1", [registered.json().user.id]);
 assert.equal(stored.rows[0].username, username);
 assert.equal(stored.rows[0].display_name, username);
 assert.equal(registered.body.includes("password"), false); assert.equal(registered.cookies.find(c => c.name === "croebet-session").httpOnly, true);
 assert.equal((await request("/api/v1/me")).json().user.username, username);
 const wallet = await request("/api/v1/me/wallet");
 assert.equal(wallet.statusCode, 200); assert.deepEqual(wallet.json(), { balance: 0 });
 const history = await request("/api/v1/me/transactions");
 assert.equal(history.statusCode, 200); assert.deepEqual(history.json(), { items: [], hasMore: false });
 rateKeys.push(tokenHash(`avatar:${registered.json().user.id}`));
 const photo = await sharp({ create: { width: 100, height: 200, channels: 3, background: "red" } }).png().toBuffer();
 assert.equal((await request("/api/v1/me/avatar", "PUT", Buffer.from("invalid"))).statusCode, 400);
 const avatarResponse = await request("/api/v1/me/avatar", "PUT", photo);
 assert.equal(avatarResponse.statusCode, 200);
 const firstAvatarUrl = avatarResponse.json().user.avatarUrl;
 assert.equal((await request(`/api/v1/profiles/${username}`)).json().avatarUrl, firstAvatarUrl);
 assert.equal((await request(firstAvatarUrl)).statusCode, 200);
 const avatarCsrf = await app.inject({ url: "/api/v1/auth/csrf", cookies: jar }); remember(avatarCsrf);
 const avatarCookies = { ...jar };
 const concurrentAvatars = await Promise.all([1, 2].map(() => app.inject({ url: "/api/v1/me/avatar", method: "PUT", cookies: avatarCookies,
   headers: { origin: config.WEB_ORIGIN, "x-csrf-token": avatarCsrf.json().token, "content-type": "image/png" }, payload: photo })));
 assert.deepEqual(concurrentAvatars.map(response => response.statusCode), [200, 200]);
 const currentAvatarUrl = (await request("/api/v1/me")).json().user.avatarUrl;
 assert.ok(concurrentAvatars.some(response => response.json().user.avatarUrl === currentAvatarUrl));
 const avatarKey = (await pool.query("select avatar_key from users where id=$1", [registered.json().user.id])).rows[0].avatar_key;
 assert.equal(currentAvatarUrl, `/api/v1/avatars/${avatarKey}`);
 await cleanupAvatars(pool, avatarStorage, "test"); assert.equal(avatarFiles.size, 1);
 assert.equal((await request(firstAvatarUrl)).statusCode, 404);
 const clearedAvatar = await request("/api/v1/me/avatar", "DELETE");
 assert.equal(clearedAvatar.statusCode, 200); assert.equal(clearedAvatar.json().user.avatarUrl, null);
 await cleanupAvatars(pool, avatarStorage, "test"); assert.equal(avatarFiles.size, 0);

 for (const variant of [username, username.toLowerCase(), username.toUpperCase()]) {
   assert.equal((await request("/api/v1/auth/register", "POST", { username: variant, password })).statusCode, 409);
 }
 assert.equal((await request("/api/v1/auth/logout", "POST")).statusCode, 204);
 assert.equal((await request("/api/v1/me")).json().user, null);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password: "errada" })).statusCode, 401);
 for (const variant of [username.toLowerCase(), username.toUpperCase(), username]) {
   const loggedIn = await request("/api/v1/auth/login", "POST", { username: variant, password });
   assert.equal(loggedIn.statusCode, 200);
   assert.equal(loggedIn.json().user.id, registered.json().user.id);
   assert.equal(loggedIn.json().user.username, username);
   assert.equal((await request("/api/v1/me")).json().user.username, username);
 }
 assert.equal((await request("/api/v1/auth/logout", "POST", undefined, "https://evil.example")).statusCode, 403);
 assert.equal(registered.json().user.usernameChangeAvailableAt, null);
 assert.equal((await request("/api/v1/me/username", "PATCH", { username: "!" })).statusCode, 400);
 await pool.query("insert into users (username, display_name, password_hash) select $1, $1, password_hash from users where username=$2", [concurrentUsername, username]);
 assert.equal((await request("/api/v1/me/username", "PATCH", { username: concurrentUsername.toUpperCase() })).statusCode, 409);
 assert.equal((await request("/api/v1/me")).json().user.usernameChangeAvailableAt, null);
 await pool.query("delete from users where username=$1", [concurrentUsername]);
 const sessionCookies = { ...jar };
 const changes = await Promise.all([username.toUpperCase(), username.toLowerCase()].map(async variant => {
   const csrf = await app.inject({ url: "/api/v1/auth/csrf", cookies: sessionCookies });
   return app.inject({ url: "/api/v1/me/username", method: "PATCH", remoteAddress,
     cookies: { ...sessionCookies, ...Object.fromEntries(csrf.cookies.map(c => [c.name, c.value])) },
     headers: { origin: config.WEB_ORIGIN, "x-csrf-token": csrf.json().token }, payload: { username: variant } });
 }));
 assert.deepEqual(changes.map(r => r.statusCode).sort(), [200, 409]);
 const changedUser = changes.find(r => r.statusCode === 200).json().user;
 assert.equal(changedUser.id, registered.json().user.id);
 assert.equal(changedUser.displayName, username);
 assert.ok(changedUser.usernameChangeAvailableAt);
 assert.equal((await request("/api/v1/me")).json().user.username, changedUser.username);
 const unchanged = await request("/api/v1/me/username", "PATCH", { username: changedUser.username });
 assert.equal(unchanged.statusCode, 200);
 assert.equal(unchanged.json().user.usernameChangeAvailableAt, changedUser.usernameChangeAvailableAt);
 assert.equal((await request("/api/v1/me/username", "PATCH", { username })).json().error.code, "USERNAME_CHANGE_COOLDOWN");
 await pool.query("update users set username_changed_at = clock_timestamp() - interval '719 hours' where id=$1", [changedUser.id]);
 assert.equal((await request("/api/v1/me/username", "PATCH", { username })).statusCode, 409);
 await pool.query("update users set username_changed_at = clock_timestamp() - interval '720 hours 1 second' where id=$1", [changedUser.id]);
 assert.equal((await request("/api/v1/me/username", "PATCH", { username })).statusCode, 200);
 await pool.query("update users set status='suspended' where username=$1", [username]);
 assert.equal((await request("/api/v1/me")).json().user, null);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 401);
 assert.equal((await request("/api/v1/me/wallet")).statusCode, 401);

 await pool.query("update users set status='active' where id=$1", [registered.json().user.id]);
 await request("/api/v1/auth/login", "POST", { username, password });
 const oldSession = { ...jar };
 const deletedAvatar = await request("/api/v1/me/avatar", "PUT", photo);
 assert.equal(deletedAvatar.statusCode, 200);
 rateKeys.push(tokenHash(`delete-account:${registered.json().user.id}`));
 assert.equal((await request("/api/v1/me", "DELETE", { password }, "https://evil.example")).statusCode, 403);
 assert.equal((await request("/api/v1/me", "DELETE", { password: "errada" })).statusCode, 401);
 assert.equal((await request("/api/v1/me")).json().user.id, registered.json().user.id);
 assert.equal((await request("/api/v1/me", "DELETE", { password })).statusCode, 204);
 assert.equal((await request(deletedAvatar.json().user.avatarUrl)).statusCode, 404);
 await cleanupAvatars(pool, avatarStorage, "test"); assert.equal(avatarFiles.size, 0);
 assert.equal((await request("/api/v1/me")).json().user, null);
 assert.equal((await app.inject({ url: "/api/v1/me", cookies: oldSession })).json().user, null);
 assert.equal((await pool.query("select id from users where id=$1", [registered.json().user.id])).rowCount, 0);
 assert.equal((await pool.query("select user_id from sessions where user_id=$1", [registered.json().user.id])).rowCount, 0);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 401);

 // Independent clients race to claim the same name with different casing.
 const competing = await Promise.all([concurrentUsername, concurrentUsername.toUpperCase()].map(async variant => {
   const csrf = await app.inject({ url: "/api/v1/auth/csrf" });
   return app.inject({ url: "/api/v1/auth/register", method: "POST", remoteAddress,
     cookies: Object.fromEntries(csrf.cookies.map(cookie => [cookie.name, cookie.value])),
     headers: { origin: config.WEB_ORIGIN, "x-csrf-token": csrf.json().token },
     payload: { username: variant, password } });
 }));
 assert.deepEqual(competing.map(response => response.statusCode).sort(), [201, 409]);
 assert.equal((await pool.query("select count(*)::int as total from users where lower(username)=$1", [concurrentUsername.toLowerCase()])).rows[0].total, 1);

 // Changing casing must not create a fresh per-account login allowance.
 for (let attempt = 0; attempt < 16; attempt++) {
   const variant = attempt % 2 === 0 ? limitedUsername.toLowerCase() : limitedUsername.toUpperCase();
   const response = await request("/api/v1/auth/login", "POST", { username: variant, password });
   assert.equal(response.statusCode, attempt < 15 ? 401 : 429);
 }
});
