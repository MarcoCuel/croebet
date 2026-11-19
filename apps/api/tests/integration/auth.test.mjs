import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import { readConfig } from "../../dist/config.js";
test("PostgreSQL e HTTP reais: conta, cookies, senha, CSRF, suspensão e logout", async t => {
 if (!process.env.TEST_DATABASE_URL) throw new Error("Configure TEST_DATABASE_URL para um banco isolado migrado com seed test.");
 const config = readConfig({ APP_ENV: "test", DATABASE_URL: process.env.TEST_DATABASE_URL, CSRF_SECRET: "teste-isolado-segredo-com-mais-de-32-caracteres", WEB_ORIGIN: "http://localhost:3000" });
 const { pool } = createDatabase(config.DATABASE_URL);
 assert.equal((await pool.query("select environment from application_environment where id = 1")).rows[0]?.environment, "test");
 const app = createApp(async () => {});
 await app.register(authRoutes, { pool, config });
 const username = "test_" + randomUUID().replaceAll("-", "").slice(0, 16);
 const password = "senha longa para os testes";
 t.after(async () => { await app.close(); await pool.query("delete from sessions where user_id in (select id from users where username=$1)", [username]); await pool.query("delete from users where username=$1", [username]); await pool.end(); });
 let jar = {};
 const remember = response => { for (const c of response.cookies) { if (c.value) jar[c.name] = c.value; else delete jar[c.name]; } };
 async function request(url, method = "GET", body, origin = config.WEB_ORIGIN) {
   let csrf;
   if (method !== "GET") { const r = await app.inject({ url: "/api/v1/auth/csrf", cookies: jar }); remember(r); csrf = r.json().token; }
   const r = await app.inject({ url, method, cookies: jar, headers: { origin, ...(csrf ? { "x-csrf-token": csrf } : {}) }, ...(body ? { payload: body } : {}) }); remember(r); return r;
 }
 assert.equal((await app.inject({ url: "/api/v1/auth/register", method: "POST", payload: { username, password } })).statusCode, 403);
 const registered = await request("/api/v1/auth/register", "POST", { username, password });
 assert.equal(registered.statusCode, 201); assert.equal(registered.json().user.role, "user");
 assert.equal(registered.body.includes("password"), false); assert.equal(registered.cookies.find(c => c.name === "croebet-session").httpOnly, true);
 assert.equal((await request("/api/v1/me")).json().user.username, username);
 assert.equal((await request("/api/v1/auth/register", "POST", { username, password })).statusCode, 409);
 assert.equal((await request("/api/v1/auth/logout", "POST")).statusCode, 204);
 assert.equal((await request("/api/v1/me")).json().user, null);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password: "errada" })).statusCode, 401);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 200);
 assert.equal((await request("/api/v1/auth/logout", "POST", undefined, "https://evil.example")).statusCode, 403);
 await pool.query("update users set status='suspended' where username=$1", [username]);
 assert.equal((await request("/api/v1/me")).json().user, null);
 assert.equal((await request("/api/v1/auth/login", "POST", { username, password })).statusCode, 401);
});
