import assert from "node:assert/strict";
import { test } from "node:test";
import { authRequest } from "../features/auth/api.ts";
import { createApp } from "../../api/dist/app.js";
import { authRoutes } from "../../api/dist/modules/auth/routes.js";

test("logout passa por proxy com transferência chunked sem rejeitar Content-Type ou remover CSRF", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const origin = "https://share.example.test";
  const jar = {};
  await app.register(authRoutes, { pool: { query: async () => ({ rows: [{ environment: "test" }] }) }, config: { APP_ENV: "test", WEB_ORIGIN: origin, CSRF_SECRET: "proxy-auth-test-secret-at-least-32-characters" } });
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const reply = await app.inject({
      method: options.method ?? "GET", url, cookies: jar,
      headers: { origin, ...options.headers, ...(options.method === "POST" ? { "transfer-encoding": "chunked" } : {}) },
      ...(options.body === undefined ? {} : { payload: options.body }),
    });
    for (const cookie of reply.cookies) jar[cookie.name] = cookie.value;
    return new Response(reply.statusCode === 204 ? null : reply.body, { status: reply.statusCode, headers: { "content-type": "application/json" } });
  });
  assert.equal(await authRequest("/auth/logout", "POST"), null);
  assert.equal((await app.inject({ method: "POST", url: "/api/v1/auth/logout", cookies: jar, headers: { origin, "content-type": "application/json" }, payload: "{}" })).statusCode, 403);
});
