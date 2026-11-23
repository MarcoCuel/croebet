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

test("partidas do perfil são públicas, paginadas e não expõem carteira nem acesso ao replay", async t => {
  const app = createApp(async () => {});
  t.after(() => app.close());
  const id = "93089d02-0b34-4b78-9d3e-f2679c190b5b";
  let historyQueries = 0;
  const pool = { query: async (sql, params) => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    if (sql.includes("from users")) {
      assert.match(sql, /status = 'active'/);
      return { rows: params[0] === "tonho" ? [{ id }] : [] };
    }
    historyQueries++;
    assert.doesNotMatch(sql, /wallet_|wallet_operations|state|frames/);
    assert.match(sql, /g.image_url as game_image_url/);
    assert.match(sql, /status in \('finished','abandoned'\)/);
    assert.match(sql, /p->>'userId'=\$1::text/);
    assert.match(sql, /order by created_at desc, id desc/);
    assert.deepEqual(params, [id, 2, 3]);
    return { rows: [0, 1].map(index => ({ game_name: "Flip 7", game_image_url: "/games/flip7.webp", id: `game:${index}`, kind: "game", description: "Flip 7 · Partida concluída", created_at: new Date("2026-11-23T01:00:00Z"), amount: null, match_id: id, match_code: "ABCDEF123456", game_slug: "flip7" })) };
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: "test" } });
  const response = await app.inject("/api/v1/profiles/TONHO/matches?limit=1&offset=3");
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), { items: [{ gameName: "Flip 7", gameImageUrl: "/games/flip7.webp", id: "game:0", kind: "game", description: "Flip 7 · Partida concluída", createdAt: "2026-11-23T01:00:00.000Z", amount: null, matchId: null, matchCode: null, gameSlug: null }], hasMore: true });
  for (const name of ["inexistente", "xy", "nome!invalido"]) {
    assert.equal((await app.inject(`/api/v1/profiles/${name}/matches`)).statusCode, 404);
  }
  assert.equal((await app.inject("/api/v1/profiles/Tonho/matches?limit=101")).statusCode, 400);
  assert.equal(historyQueries, 1);
});
