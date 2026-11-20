import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig, allowedWebOrigins } from "../dist/config.js";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { newToken, csrfToken } from "../dist/modules/auth/security.js";

const base = { APP_ENV: "development", DATABASE_URL: "postgresql://localhost/test", CSRF_SECRET: "origin-tests-secret-at-least-32-characters", WEB_ORIGIN: "http://localhost:3000" };
const lan = "http://192.168.1.2:3000";
test("origens locais são explícitas; produção rejeita extras, HTTP e wildcard", () => {
  assert.deepEqual(allowedWebOrigins(readConfig({ ...base, DEV_WEB_ORIGINS: ` ${lan},${lan} ` })), [base.WEB_ORIGIN, lan]);
  for (const value of ["*", "http://*.example.com", `${lan}/`, `${lan}/path`, "http://user:pass@localhost:3000", "null"])
    assert.throws(() => readConfig({ ...base, DEV_WEB_ORIGINS: value }));
  const production = { ...base, APP_ENV: "production", WEB_ORIGIN: "https://croebet.example", AVATAR_STORAGE: "s3", S3_BUCKET: "test", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test" };
  assert.deepEqual(allowedWebOrigins(readConfig(production)), [production.WEB_ORIGIN]);
  assert.throws(() => readConfig({ ...production, DEV_WEB_ORIGINS: lan }));
  assert.throws(() => readConfig({ ...production, WEB_ORIGIN: base.WEB_ORIGIN }));
  assert.deepEqual(allowedWebOrigins({ ...production, DEV_WEB_ORIGINS: lan }), [production.WEB_ORIGIN]);
});

test("HTTP aceita localhost e LAN com CSRF; rejeita origem ausente, porta distinta e token inválido", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const config = readConfig({ ...base, DEV_WEB_ORIGINS: lan });
  await app.register(authRoutes, { config, pool: { query: async () => ({ rows: [{ environment: "development" }] }) } });
  const nonce = newToken(), cookies = { "croebet-csrf": nonce };
  const token = csrfToken(config.CSRF_SECRET, nonce, "");
  for (const origin of [base.WEB_ORIGIN, lan]) {
    const reply = await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies, headers: { origin, "x-csrf-token": token } });
    assert.equal(reply.statusCode, 204);
    assert.ok(reply.cookies.every(cookie => cookie.httpOnly && cookie.sameSite === "Lax" && !cookie.secure && !cookie.domain));
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies, headers: { origin, "x-csrf-token": "invalid" } })).statusCode, 403);
  }
  for (const origin of [undefined, "http://192.168.1.2:3001", "http://192.168.1.20:3000", "https://untrusted.example", "null"]) {
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies, headers: { ...(origin ? { origin } : {}), "x-csrf-token": token } })).statusCode, 403);
  }
});
