import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame } from "../features/games/flip7/engine.ts";
import { readMatch } from "../features/games/flip7/match-storage.ts";
import { startLocalMatch, leaveLocalMatch } from "../features/games/flip7/match-actions.ts";

test("partidas livres usam armazenamento próprio, preservam outras partidas e recusam entradas econômicas", async t => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const locks = [];
  for (const [name, value] of Object.entries({ window: { localStorage: storage }, navigator: { locks: { request: async (key, action) => { locks.push(key); return action(); } } } })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
  }
  const game = createGame([{ name: "Marco", kind: "human" }, { name: "Bot", kind: "normal" }], 42);
  const first = { version: 1, code: "ABCDEF123456", game };
  const second = { ...first, code: "123456ABCDEF" };
  await startLocalMatch(first);
  await startLocalMatch(second);
  assert.deepEqual(readMatch(storage, first.code)?.game, game);
  await assert.rejects(startLocalMatch(first), /Já existe/);
  await assert.rejects(startLocalMatch({ ...first, code: "ABCDEF123457", wager: { username: "Marco", stake: 5 } }), /Croins ainda não/);
  assert.equal(readMatch(storage, "ABCDEF123457"), null);
  await leaveLocalMatch(first.code);
  assert.equal(readMatch(storage, first.code), null);
  assert.deepEqual(readMatch(storage, second.code)?.game, game);
  await assert.rejects(leaveLocalMatch(first.code), /partida mudou/);
  assert.ok(locks.every(key => key === "croebet:flip7:matches"));
  assert.deepEqual([...values.keys()], ["croebet:flip7:match"]);
});
