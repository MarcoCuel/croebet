import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { normalizeDisplayName, persistDisplayName, readDisplayName } from "../features/auth/profile-storage.ts";

let entries;
beforeEach(() => {
  entries = new Map();
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
});

test("nome público é independente do usuário e preserva contas anteriores", () => {
  entries.set("croebet:demo-username", "Marco");
  entries.set("croebet:demo-wallet:marco", "carteira existente");
  assert.equal(readDisplayName("Marco"), "Marco");
  assert.equal(persistDisplayName("Marco", "  Marco Cuel  "), "Marco Cuel");
  assert.equal(readDisplayName("MARCO"), "Marco Cuel");
  assert.equal(readDisplayName("Outro"), "Outro");
  persistDisplayName("Outro", "Marco Cuel");
  assert.equal(readDisplayName("Outro"), "Marco Cuel");
  assert.equal(entries.get("croebet:demo-username"), "Marco");
  assert.equal(entries.get("croebet:demo-wallet:marco"), "carteira existente");
});

test("nome rejeita entradas inválidas e falhas de gravação são propagadas", () => {
  persistDisplayName("Marco", "Marco Cuel");
  for (const value of ["", "   ", "a".repeat(41), "linha\nquebra", null, 123]) {
    assert.throws(() => normalizeDisplayName(value));
  }
  globalThis.localStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => persistDisplayName("Marco", "Outro nome"), /quota/);
  assert.equal(readDisplayName("Marco"), "Marco Cuel");
  entries.set("croebet:demo-display-name:marco", "\n");
  assert.equal(readDisplayName("Marco"), "Marco");
});
