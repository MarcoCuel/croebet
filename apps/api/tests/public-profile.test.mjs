import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";

test("perfil público consulta sem sessão, ignora caixa e expõe identidade e contagens públicas de atividade", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const days = Array.from({ length: 365 }, (_, index) => ({ date: new Date(Date.UTC(2025, 10, 21 + index)).toISOString().slice(0,10), games: 0, wins: 0, dailyBonuses: 0, coupons: 0 }));
  const activity = { timeZone: "America/Sao_Paulo", days };
  const pool = { query: async (sql, params) => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    if (sql.includes("with bounds as")) {
      assert.equal(params[0], "93089d02-0b34-4b78-9d3e-f2679c190b5b");
      return { rows: days };
    }
    assert.match(sql, /status = 'active'/);
    assert.equal(params[0], params[0].toLowerCase());
    return { rows: params[0] === "tonho" ? [{ id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", display_name: "Tonho Público", password_hash: "private", role: "admin" }] : [] };
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: "test" } });
  for (const username of ["tonho", "Tonho", "TONHO"]) {
    const response = await app.inject(`/api/v1/profiles/${username}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(response.json(), { username: "Tonho", displayName: "Tonho Público", avatarUrl: null, activity });
  }
  for (const username of ["inexistente", "xy", "nome!invalido"]) {
    const response = await app.inject(`/api/v1/profiles/${username}`);
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "PROFILE_NOT_FOUND");
  }
});
