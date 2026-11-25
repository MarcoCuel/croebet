import assert from "node:assert/strict";
import { test } from "node:test";
import { createOgGuard, ogClientKey } from "../lib/og-guard.ts";

test("proteção da imagem OG limita concorrência e janela por cliente", () => {
  let time = 0;
  const guard = createOgGuard({ maxConcurrent: 1, limit: 2, windowMs: 100, now: () => time });
  assert.equal(guard.acquire("a"), "ok");
  assert.equal(guard.acquire("b"), "busy");
  guard.release();
  assert.equal(guard.acquire("a"), "ok");
  guard.release();
  assert.equal(guard.acquire("a"), "limited");
  time = 101;
  assert.equal(guard.acquire("a"), "ok");
});

test("chave do cliente usa somente cabeçalhos encaminhados válidos", () => {
  assert.equal(ogClientKey(new Headers({ "cf-connecting-ip": "203.0.113.7" })), "203.0.113.7");
  assert.equal(ogClientKey(new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" })), "203.0.113.8");
  assert.equal(ogClientKey(new Headers()), "local");
});
