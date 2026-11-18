import assert from "node:assert/strict";
import { test } from "node:test";
import { readSetupPreferences, saveSetupPreferences, setupStorageKey } from "../features/games/flip7/setup-storage.ts";
import { createGame } from "../features/games/flip7/engine.ts";
import { matchStorageKey, saveMatch } from "../features/games/flip7/match-storage.ts";
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test("configuração persiste modo, Brutal e quantidade independentemente da partida", () => {
  const source = storage();
  assert.deepEqual(readSetupPreferences(source), { count: 2, mode: "classic", brutal: false });
  const preferences = { count: 12, mode: "vengeance", brutal: true };
  saveSetupPreferences(preferences, source);
  source.setItem(matchStorageKey, "partida temporária"); source.removeItem(matchStorageKey);
  assert.deepEqual(readSetupPreferences(source), preferences);
  saveSetupPreferences({ count: 4, mode: "classic", brutal: false }, source);
  assert.deepEqual(readSetupPreferences(source), { count: 4, mode: "classic", brutal: false });
});
test("configuração ignora dados inválidos e permite usar a tela sem armazenamento", () => {
  for (const raw of ["{", "null", "[]", JSON.stringify({ count: 13, mode: "classic", brutal: false }), JSON.stringify({ count: 2, mode: "classic", brutal: "true" }), JSON.stringify({ count: 2.5, mode: "vengeance", brutal: false })]) {
    const source = storage(); source.setItem(setupStorageKey, raw);
    assert.deepEqual(readSetupPreferences(source), { count: 2, mode: "classic", brutal: false });
  }
  assert.equal(readSetupPreferences({ getItem() { throw Error("Bloqueado"); } }).count, 2);
  assert.throws(() => saveSetupPreferences({ count: 2, mode: "classic", brutal: false }, { setItem() { throw Error("Sem espaço"); } }));
});
test("configuração adota a modalidade da partida existente na primeira leitura", () => {
  const source = storage();
  const game = createGame([{ name: "A", kind: "human" }, { name: "B", kind: "normal" }, { name: "C", kind: "normal" }], 42, { mode: "vengeance", brutal: true });
  saveMatch({ version: 1, code: "ABCDEF123456", game }, source);
  assert.deepEqual(readSetupPreferences(source), { count: 3, mode: "vengeance", brutal: true });
});

test("preferência Brutal permanece no Clássico sem ativar regras Brutais nesse jogo", () => {
  const source = storage();
  saveSetupPreferences({ count: 2, mode: "classic", brutal: true }, source);
  const preferences = readSetupPreferences(source);
  assert.deepEqual(preferences, { count: 2, mode: "classic", brutal: true });
  const game = createGame([{ name: "A", kind: "human" }, { name: "B", kind: "human" }], 1, preferences);
  assert.equal(game.brutal, false);
  assert.equal(readSetupPreferences(source).brutal, true);
});
