import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { createApp } from "../dist/app.js";
import { readConfig } from "../dist/config.js";
import { csrfToken } from "../dist/modules/auth/security.js";

const config = readConfig({ APP_ENV: "test", DATABASE_URL: "postgresql://localhost/test", CSRF_SECRET: "test-secret-with-at-least-32-characters", WEB_ORIGIN: "http://localhost:3000" });

test("adiar exige sessão e CSRF, revalida revogação e preserva o perfil em falhas", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const token = "a".repeat(43), nonce = "b".repeat(43);
  const user = { id: randomUUID(), username: "Tonho", display_name: "Tonho", role: "user", status: "active", username_changed_at: null, avatar_key: null, profile_name_provided: false, onboarding_remind_at: null };
  let revoked = false, failWrite = false, writes = 0, rolledBack = false, released = false;
  const query = async sql => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    if (sql.startsWith("update sessions")) return { rows: [user] };
    if (sql.startsWith("select u.*")) return { rows: revoked ? [] : [user] };
    if (sql.startsWith("update users")) {
      writes++;
      if (failWrite) throw new Error("write failed");
      return { rows: [{ ...user, onboarding_remind_at: new Date("2026-11-22T00:00:00Z") }] };
    }
    if (sql === "rollback") rolledBack = true;
    return { rows: [] };
  };
  await app.register(authRoutes, { config, pool: { query, connect: async () => ({ query, release: () => { released = true; } }) } });
  const cookies = { "croebet-session": token, "croebet-csrf": nonce };
  const headers = { origin: config.WEB_ORIGIN, "x-csrf-token": csrfToken(config.CSRF_SECRET, nonce, token) };
  const request = overrides => app.inject({ url: "/api/v1/me/onboarding/defer", method: "POST", cookies, headers, ...overrides });
  assert.equal((await request({ headers: {} })).statusCode, 403);
  assert.equal((await request({ cookies: {} })).statusCode, 403);
  revoked = true;
  assert.equal((await request()).statusCode, 401);
  assert.equal(writes, 0);
  assert.ok(rolledBack && released);
  revoked = false; failWrite = true; rolledBack = false; released = false;
  assert.equal((await request()).statusCode, 500);
  assert.ok(rolledBack && released);
  assert.equal(user.onboarding_remind_at, null);
  failWrite = false;
  const response = await request();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().user.onboarding, { nameProvided: false, remindAt: "2026-11-22T00:00:00.000Z" });
  assert.equal(response.json().user.displayName, "Tonho");
  assert.equal(response.json().user.avatarUrl, null);
});
