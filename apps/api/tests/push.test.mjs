import { test } from "node:test";
import assert from "node:assert/strict";
import { createPushService, PushError } from "../src/modules/push/service.ts";
import { createGame } from "../src/modules/games/flip7/engine.ts";

// game_matches stores the engine state, not the public projection.
const state = createGame([{ name: "A", kind: "human" }, { name: "B", kind: "human" }], 42, { mode: "classic", brutal: false });
const match = { id: "m1", code: "ABCDEF123456", status: "playing", state, game_slug: "flip7", game_name: "Flip 7" };
const subscription = { endpoint: "https://push.example/device", p256dh: "key", auth: "secret" };

function poolFor({ row = match, controller = "user-1", subscriptions = [subscription], fail, onQuery } = {}) {
  return { query: async (sql, params) => {
    onQuery?.(sql, params);
    if (fail) throw fail;
    if (sql.includes("from game_matches")) return { rows: row ? [row] : [] };
    if (sql.includes("from game_match_players")) return { rows: controller ? [{ controller_id: controller }] : [] };
    if (sql.includes("delete from push_subscriptions")) return { rows: [] };
    if (sql.includes("count(*)::int as count")) return { rows: [{ count: 0 }] };
    if (sql.includes("from push_subscriptions")) return { rows: subscriptions };
    return { rows: [] };
  } };
}

function service({ pool = poolFor(), send = async () => ({ statusCode: 201 }), rows = [] } = {}) {
  return createPushService(pool, { publicKey: "public", privateKey: "private", subject: "mailto:test@example.com", webOrigin: "https://croebet.test", resolve: async () => ["8.8.8.8"], send: async (target, payload, options) => { rows.push({ target, payload, options }); return send(target, payload, options); }, log: { warn: () => {} } });
}

test("push de turno vai para o controlador offline com destino e tag da partida", async () => {
  const rows = [];
  const push = service({ rows });
  assert.equal(await push.dispatchTurn(match.code, () => false), 1);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].target, { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } });
  assert.equal(rows[0].options.TTL, 300);
  const payload = JSON.parse(rows[0].payload);
  assert.equal(payload.title, "Sua vez");
  assert.equal(payload.body, "Sua vez em Flip 7.");
  assert.equal(payload.url, "https://croebet.test/jogos/flip7?partida=ABCDEF123456");
  assert.equal(payload.tag, "turn:ABCDEF123456");
});

test("o mesmo turno não repete push e quem está online não recebe", async () => {
  const rows = [];
  const push = service({ rows });
  await push.dispatchTurn(match.code, () => false);
  assert.equal(await push.dispatchTurn(match.code, () => false), 0);
  assert.equal(rows.length, 1);
  const online = service({ rows: [] });
  assert.equal(await online.dispatchTurn(match.code, () => true), 0);
});

test("assinatura expirada no serviço de push é removida", async () => {
  const queries = [];
  const pool = poolFor({ onQuery: (sql, params) => queries.push({ sql, params }) });
  const push = service({ pool, send: async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); } });
  assert.equal(await push.dispatchTurn(match.code, () => false), 0);
  assert.ok(queries.some(query => query.sql.startsWith("delete from push_subscriptions") && query.params[0] === subscription.endpoint && query.params[1] === "user-1"));
});

test("push desligado mantém o recurso indisponível sem quebrar a partida", async () => {
  const push = createPushService(poolFor(), null);
  assert.deepEqual(push.status(), { enabled: false, publicKey: null });
  assert.equal(await push.dispatchTurn(match.code, () => false), 0);
  await assert.rejects(push.subscribe("user-1", { endpoint: subscription.endpoint, keys: { p256dh: "key", auth: "secret" } }), error => error instanceof PushError && error.status === 503);
  await assert.rejects(push.test("user-1"), error => error instanceof PushError && error.status === 503);
});

test("teste envia para os dispositivos inscritos e conta entregas", async () => {
  const rows = [];
  const push = service({ rows });
  assert.deepEqual(await push.test("user-1"), { sent: 1 });
  assert.equal(JSON.parse(rows[0].payload).title, "Croebet");
  assert.equal(await service({ rows: [], pool: poolFor({ subscriptions: [] }) }).test("user-1").then(result => result.sent), 0);
});

test("assinatura é gravada com upsert e limite de dispositivos", async () => {
  const queries = [];
  const pool = poolFor({ onQuery: (sql, params) => queries.push({ sql, params }) });
  const push = service({ pool });
  assert.deepEqual(await push.subscribe("user-1", { endpoint: subscription.endpoint, keys: { p256dh: "key", auth: "secret" } }, "navegador"), { subscriptions: 0 });
  assert.ok(queries.some(query => query.sql.includes("on conflict (endpoint) do update")));
  const full = { query: async sql => sql.includes("count(*)") && sql.includes("endpoint<>$2") ? { rows: [{ count: 10 }] } : { rows: [] } };
  await assert.rejects(service({ pool: full }).subscribe("user-1", { endpoint: subscription.endpoint, keys: { p256dh: "key", auth: "secret" } }), error => error instanceof PushError && error.status === 409);
});

test("endpoint privado ou loopback é recusado antes de virar requisição do servidor", async () => {
  const privatePush = createPushService(poolFor(), { publicKey: "public", privateKey: "private", subject: "mailto:test@example.com", webOrigin: "https://croebet.test", resolve: async () => ["10.0.0.7"], send: async () => ({}), log: { warn: () => {} } });
  await assert.rejects(privatePush.subscribe("user-1", { endpoint: "https://internal.example/device", keys: { p256dh: "key", auth: "secret" } }), error => error instanceof PushError && error.status === 400);
  const literal = createPushService(poolFor(), { publicKey: "public", privateKey: "private", subject: "mailto:test@example.com", webOrigin: "https://croebet.test", send: async () => ({}), log: { warn: () => {} } });
  await assert.rejects(literal.subscribe("user-1", { endpoint: "https://127.0.0.1/device", keys: { p256dh: "key", auth: "secret" } }), error => error instanceof PushError && error.status === 400);
});
