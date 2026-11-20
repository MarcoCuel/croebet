import { test } from "node:test";
import assert from "node:assert/strict";
import { hash, verify } from "argon2";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";

test("senha: exige autenticação/CSRF, valida senha atual e revalida sessão/hash antes de gravar", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const password = "senha atual segura";
  const newPassword = "nova senha segura";
  let storedHash = await hash(password);
  let authenticated = true;
  let stale = false;
  let failing = false;
  let limited = false;
  let writes = 0;
  const calls = [];
  const pool = {
    query: async sql => {
      if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
      if (sql.includes("update sessions")) return { rows: authenticated ? [{ id: "00000000-0000-4000-8000-000000000001", password_hash: storedHash }] : [] };
      if (sql.includes("auth_rate_limits")) return { rows: [{ attempts: limited ? 11 : 1 }] };
      throw Error("Unexpected query");
    },
    connect: async () => ({
      query: async (sql, params) => {
        calls.push(sql);
        if (sql.startsWith("select status")) return { rows: [{ status: "active", password_hash: stale ? "changed" : storedHash }] };
        if (sql.startsWith("select 1 from sessions")) return { rows: [{ exists: 1 }] };
        if (sql.startsWith("update users")) {
          writes++;
          assert.ok(await verify(params[0], newPassword));
          if (failing) throw Error("Database write failed");
          storedHash = params[0];
        }
        return { rows: [] };
      }, release() {},
    }),
  };
  const config = { APP_ENV: "test", WEB_ORIGIN: "http://localhost:3000", CSRF_SECRET: "test-secret-of-at-least-32-characters" };
  await app.register(authRoutes, { pool, config });
  const cookies = { "croebet-session": "a".repeat(43) };
  async function change(body) {
    const csrf = await app.inject({ url: "/api/v1/auth/csrf", cookies });
    const nonce = csrf.cookies.find(c => c.name === "croebet-csrf").value;
    return app.inject({ url: "/api/v1/me/password", method: "PATCH", cookies: { ...cookies, "croebet-csrf": nonce },
      headers: { origin: config.WEB_ORIGIN, "x-csrf-token": csrf.json().token }, payload: body });
  }
  const body = { currentPassword: password, newPassword };
  assert.equal((await app.inject({ url: "/api/v1/me/password", method: "PATCH", cookies, payload: body })).statusCode, 403);
  authenticated = false;
  assert.equal((await change(body)).statusCode, 401);
  authenticated = true;
  assert.equal((await change({ ...body, currentPassword: "incorreta" })).statusCode, 401);
  assert.equal((await change({ ...body, newPassword: "curta" })).statusCode, 400);
  assert.equal((await change({ ...body, newPassword: password })).statusCode, 400);
  assert.equal(writes, 0);
  stale = true;
  assert.equal((await change(body)).statusCode, 401);
  assert.equal(calls.at(-1), "rollback");
  assert.equal(writes, 0);
  stale = false; failing = true;
  assert.equal((await change(body)).statusCode, 500);
  assert.equal(calls.at(-1), "rollback");
  failing = false;
  assert.equal((await change(body)).statusCode, 204);
  assert.equal(calls.at(-1), "commit");
  assert.ok(calls.some(sql => sql.includes("delete from sessions where user_id=$1 and token_hash<>$2")));
  assert.ok(await verify(storedHash, newPassword));
  assert.equal(await verify(storedHash, password), false);
  limited = true;
  assert.equal((await change({ currentPassword: newPassword, newPassword: password })).statusCode, 429);
});

test("histórico exige sessão, limita paginação e retorna somente a projeção privada permitida", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  let authenticated = false;
  const pool = { query: async (sql, params) => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    if (sql.includes("update sessions")) return { rows: authenticated ? [{ id: "own-user" }] : [] };
    assert.deepEqual(params, ["own-user", 2, 0]);
    return { rows: [
      { id: "game:one", kind: "game", description: "Flip 7 · Partida concluída", created_at: new Date("2026-11-20T12:00:00Z"), amount: null, state: { deck: [1] } },
      { id: "transaction:one", kind: "transaction", description: "Bônus diário", created_at: new Date("2026-11-19T12:00:00Z"), amount: "10" },
    ] };
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: "test" } });
  assert.equal((await app.inject("/api/v1/me/history")).statusCode, 401);
  authenticated = true;
  const cookies = { "croebet-session": "a".repeat(43) };
  assert.equal((await app.inject({ url: "/api/v1/me/history?limit=101", cookies })).statusCode, 400);
  const response = await app.inject({ url: "/api/v1/me/history?limit=1", cookies });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), { items: [{ id: "game:one", kind: "game", description: "Flip 7 · Partida concluída", createdAt: "2026-11-20T12:00:00.000Z", amount: null }], hasMore: true });
});
