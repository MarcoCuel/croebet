import assert from "node:assert/strict";
import { test } from "node:test";
import { permanentRealtimeFailure } from "../lib/realtime-errors.ts";

test("falhas permanentes do Socket.IO preservam código e mensagem do servidor", () => {
  assert.deepEqual(permanentRealtimeFailure({ data: { ok: false, error: { code: "UNAUTHENTICATED", message: "Entre novamente." } } }), { code: "UNAUTHENTICATED", message: "Entre novamente." });
  assert.deepEqual(permanentRealtimeFailure({ data: { code: "CONNECTION_LIMIT", message: "Muitas conexões abertas." } }), { code: "CONNECTION_LIMIT", message: "Muitas conexões abertas." });
  assert.deepEqual(permanentRealtimeFailure({ data: { code: "RATE_LIMIT" } }), { code: "RATE_LIMIT", message: "Conexão em tempo real indisponível." });
});

test("erros transitórios ou desconhecidos continuam elegíveis para retry", () => {
  assert.equal(permanentRealtimeFailure(undefined), null);
  assert.equal(permanentRealtimeFailure(new Error("offline")), null);
  assert.equal(permanentRealtimeFailure({ data: { code: "SERVER_RESTARTING", message: "Reiniciando." } }), null);
});
