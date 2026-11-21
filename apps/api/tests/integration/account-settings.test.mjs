import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import { readConfig } from "../../dist/config.js";
import { tokenHash } from "../../dist/modules/auth/security.js";

test("configurações: histórico privado e paginado; troca de senha revoga outras sessões", async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error("Configure TEST_DATABASE_URL com banco exclusivo de test migrado.");
  const config = readConfig({ APP_ENV: "test", DATABASE_URL: process.env.TEST_DATABASE_URL, CSRF_SECRET: "teste-isolado-segredo-com-mais-de-32-caracteres", WEB_ORIGIN: "http://localhost:3000" });
  const { pool } = createDatabase(config.DATABASE_URL);
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment, "test");
  const app = createApp(async () => {});
  await app.register(authRoutes, { pool, config });
  const username = "Settings_" + randomUUID().replaceAll("-", "").slice(0, 12);
  const remoteAddress = `127.${[...randomBytes(3)].join(".")}`;
  const password = "senha atual de teste";
  const newPassword = "senha nova de teste";
  const jar = {};
  let userId;
  t.after(async () => {
    await app.close();
    try {
      if (userId) {
        await pool.query("delete from sessions where user_id=$1", [userId]);
        await pool.query("delete from users where id=$1", [userId]);
      }
      await pool.query("delete from auth_rate_limits where key=any($1::text[])", [[`register:${remoteAddress}`, `login-ip:${remoteAddress}`, `login-user:${username.toLowerCase()}`, `password:${userId}`].map(tokenHash)]);
    } finally { await pool.end(); }
  });
  async function request(url, method = "GET", payload) {
    const headers = { origin: config.WEB_ORIGIN };
    if (method !== "GET") {
      const csrf = await app.inject({ url: "/api/v1/auth/csrf", cookies: jar });
      for (const cookie of csrf.cookies) jar[cookie.name] = cookie.value;
      headers["x-csrf-token"] = csrf.json().token;
    }
    const response = await app.inject({ url, method, remoteAddress, cookies: jar, headers, payload });
    for (const cookie of response.cookies) jar[cookie.name] = cookie.value;
    return response;
  }
  assert.equal((await request("/api/v1/me/history")).statusCode, 401);
  const registered = await request("/api/v1/auth/register", "POST", { username, password });
  assert.equal(registered.statusCode, 201);
  userId = registered.json().user.id;
  const otherDevice = { ...jar };
  assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 200);
  // Login replaces this browser's session; create a second valid device independently.
  await pool.query(`insert into sessions (token_hash,user_id,expires_at,idle_expires_at)
    values ($1,$2,now()+interval '1 day',now()+interval '1 day')`, [tokenHash(otherDevice["croebet-session"]), userId]);
  const history = await request("/api/v1/me/history?limit=1");
  assert.equal(history.statusCode, 200);
  assert.equal(history.json().items[0].description, "Bônus de cadastro");
  assert.equal(history.json().items[0].amount, 30);
  assert.deepEqual((await request("/api/v1/me/history?offset=1")).json(), { items: [], hasMore: false });
  assert.equal((await request("/api/v1/me/history?limit=101")).statusCode, 400);
  assert.equal((await app.inject({ url: "/api/v1/me/password", method: "PATCH", cookies: jar, payload: { currentPassword: password, newPassword } })).statusCode, 403);
  assert.equal((await request("/api/v1/me/password", "PATCH", { currentPassword: "errada", newPassword })).statusCode, 401);
  assert.equal((await request("/api/v1/me/password", "PATCH", { currentPassword: password, newPassword: "curta" })).statusCode, 400);
  assert.equal((await request("/api/v1/me/password", "PATCH", { currentPassword: password, newPassword: password })).statusCode, 400);
  assert.equal((await request("/api/v1/me/password", "PATCH", { currentPassword: password, newPassword })).statusCode, 204);
  assert.equal((await request("/api/v1/me")).json().user.id, userId);
  assert.equal((await app.inject({ url: "/api/v1/me", cookies: otherDevice })).json().user, null);
  assert.equal((await request("/api/v1/me/wallet")).json().balance, 30);
  assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 401);
  assert.equal((await request("/api/v1/auth/login", "POST", { username, password: newPassword })).statusCode, 200);
});
