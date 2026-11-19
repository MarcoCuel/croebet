import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";

test("perfil público consulta sem sessão, ignora caixa e expõe somente nome e usuário", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const pool = { query: async (sql, params) => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    assert.match(sql, /status = 'active'/);
    assert.equal(params[0], params[0].toLowerCase());
    return { rows: params[0] === "tonho" ? [{ username: "Tonho", display_name: "Tonho Público", password_hash: "private", role: "admin" }] : [] };
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: "test" } });
  for (const username of ["tonho", "Tonho", "TONHO"]) {
    const response = await app.inject(`/api/v1/profiles/${username}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.json(), { username: "Tonho", displayName: "Tonho Público", avatarUrl: null });
  }
  for (const username of ["inexistente", "xy", "nome!invalido"]) {
    const response = await app.inject(`/api/v1/profiles/${username}`);
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "PROFILE_NOT_FOUND");
  }
});
