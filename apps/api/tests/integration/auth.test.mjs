import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import { readConfig } from "../../dist/config.js";
import { tokenHash } from "../../dist/modules/auth/security.js";
test("PostgreSQL e HTTP reais: conta, cookies, senha, CSRF, suspensão e logout", async t => {
 if (!process.env.TEST_DATABASE_URL) throw new Error("Configure TEST_DATABASE_URL para um banco isolado migrado com seed test.");
 const config = readConfig({ APP_ENV: "test", DATABASE_URL: process.env.TEST_DATABASE_URL, CSRF_SECRET: "teste-isolado-segredo-com-mais-de-32-caracteres", WEB_ORIGIN: "http://localhost:3000" });
 const { pool } = createDatabase(config.DATABASE_URL);
 assert.equal((await pool.query("select environment from application_environment where id = 1")).rows[0]?.environment, "test");
 const app = createApp(async () => {});
 await app.register(authRoutes, { pool, config });
 const username = "Test_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const concurrentUsername = "Race_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const limitedUsername = "Limit_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const remoteAddress = `127.${[...randomBytes(3)].join(".")}`;
 const usernames = [username, concurrentUsername].map(value => value.toLowerCase());
 const rateKeys = [`register:${remoteAddress}`, `login-ip:${remoteAddress}`, ...[...usernames, limitedUsername.toLowerCase()].map(value => `login-user:${value}`)].map(tokenHash);
 const password = "senha longa para os testes";
 t.after(async () => { await app.close(); try { await pool.query("delete from sessions where user_id in (select id from users where lower(username) = any($1::text[]))", [usernames]); await pool.query("delete from users where lower(username) = any($1::text[])", [usernames]); await pool.query("delete from auth_rate_limits where key = any($1::text[])", [rateKeys]); } finally { await pool.end(); } });
 let jar = {};
 const remember = response => { for (const c of response.cookies) { if (c.value) jar[c.name] = c.value; else delete jar[c.name]; } };
 async function request(url, method = "GET", body, origin = config.WEB_ORIGIN) {
   let csrf;
   if (method !== "GET") { const r = await app.inject({ url: "/api/v1/auth/csrf", cookies: jar }); remember(r); csrf = r.json().token; }
   const r = await app.inject({ url, method, remoteAddress, cookies: jar, headers: { origin, ...(csrf ? { "x-csrf-token": csrf } : {}) }, ...(body ? { payload: body } : {}) }); remember(r); return r;
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
