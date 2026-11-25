import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { readConfig } from "../dist/config.js";
test("liveness independente do banco; readiness falha sem vazar detalhes", async t => {
  const app = createApp(async () => { throw new Error("postgresql://user:secret@private/db"); });
  t.after(() => app.close());
  const health = await app.inject("/api/v1/health");
  assert.equal(health.statusCode, 200);
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  assert.equal(health.headers["x-frame-options"], "DENY");
  assert.match(health.headers["content-security-policy"], /frame-ancestors 'none'/);
  const result = await app.inject("/api/v1/health/ready");
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.json(), { status: "unavailable" });
  assert.equal((await app.inject("/api/v1/unknown")).statusCode, 404);
});
test("readiness sinaliza banco validado e configuração recusa valores inválidos", async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  assert.deepEqual((await app.inject("/api/v1/health/ready")).json(), { status: "ready" });
  assert.throws(() => readConfig({ APP_ENV: "test", DATABASE_URL: "not-a-url" }));
  assert.throws(() => readConfig({ DATABASE_URL: "postgresql://localhost/db" }));
  assert.throws(() => readConfig({ APP_ENV: "test", DATABASE_URL: "postgresql://localhost/db", API_PORT: "0" }));
});
