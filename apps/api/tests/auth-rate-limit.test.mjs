import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { tokenHash } from "../dist/modules/auth/security.js";

async function fixture(t, { environment = "production", trustCloudflareProxy = true } = {}) {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const config = {
    APP_ENV: environment,
    WEB_ORIGIN: environment === "production" ? "https://croebet.example" : "http://localhost:3000",
    CSRF_SECRET: "test-secret-with-at-least-32-characters",
    TRUST_CLOUDFLARE_PROXY: trustCloudflareProxy,
    REALTIME_MAX_CONNECTIONS: 200,
  };
  const keys = [];
  const pool = {
    query: async (sql, params) => {
      if (sql.includes("application_environment")) return { rows: [{ environment }] };
      if (sql.includes("auth_rate_limits")) {
        keys.push(params[0]);
        return { rows: [{ attempts: 1000 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    connect: async () => { throw new Error("Unexpected database connection"); },
  };
  await app.register(authRoutes, { pool, config });
  const csrf = await app.inject("/api/v1/auth/csrf");
  const csrfName = environment === "production" ? "__Host-croebet-csrf" : "croebet-csrf";
  const nonce = csrf.cookies.find(cookie => cookie.name === csrfName).value;
  return {
    keys,
    request: async (path, remoteAddress, headers = {}) => {
      const response = await app.inject({
        url: path,
        method: "POST",
        remoteAddress,
        cookies: { [csrfName]: nonce },
        headers: { origin: config.WEB_ORIGIN, "x-csrf-token": csrf.json().token, ...headers },
        payload: {},
      });
      assert.equal(response.statusCode, 429, response.body);
    },
  };
}

test("cadastro e login separam visitantes reais somente pelo proxy Cloudflare confiável", async t => {
  const f = await fixture(t);
  await f.request("/api/v1/auth/register", "127.0.0.1", { "cf-connecting-ip": "203.0.113.20" });
  await f.request("/api/v1/auth/register", "127.0.0.1", { "cf-connecting-ip": "203.0.113.21" });
  await f.request("/api/v1/auth/login", "::ffff:127.0.0.1", { "cf-connecting-ip": "203.0.113.22" });
  assert.deepEqual(f.keys, [
    tokenHash("register:203.0.113.20"),
    tokenHash("register:203.0.113.21"),
    tokenHash("login-ip:203.0.113.22"),
  ]);
});

test("proxy não confiável ignora CF-Connecting-IP e X-Forwarded-For", async t => {
  const f = await fixture(t, { trustCloudflareProxy: false });
  await f.request("/api/v1/auth/register", "127.0.0.1", { "cf-connecting-ip": "203.0.113.20" });
  await f.request("/api/v1/auth/login", "127.0.0.1", { "x-forwarded-for": "198.51.100.20" });
  assert.deepEqual(f.keys, [tokenHash("register:127.0.0.1"), tokenHash("login-ip:127.0.0.1")]);
});

test("conexão direta e header inválido não permitem escolher o IP do limite", async t => {
  const f = await fixture(t);
  await f.request("/api/v1/auth/register", "192.168.1.2", { "cf-connecting-ip": "203.0.113.20" });
  await f.request("/api/v1/auth/login", "127.0.0.1", { "cf-connecting-ip": "203.0.113.20, 203.0.113.21" });
  assert.deepEqual(f.keys, [tokenHash("register:192.168.1.2"), tokenHash("login-ip:127.0.0.1")]);
});
