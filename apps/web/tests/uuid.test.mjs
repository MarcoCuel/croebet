import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import { randomUUID } from "../lib/uuid.ts";

test("IDs continuam sendo UUID v4 válidos quando HTTP na LAN não oferece crypto.randomUUID", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } });
  t.after(() => Object.defineProperty(globalThis, "crypto", original));
  const values = Array.from({ length: 64 }, () => randomUUID());
  for (const value of values) assert.match(value, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(new Set(values).size, values.length);
});
