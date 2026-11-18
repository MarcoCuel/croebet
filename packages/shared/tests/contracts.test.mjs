import { test } from "node:test";
import assert from "node:assert/strict";
import { healthSchema, apiErrorSchema } from "../dist/index.js";
test("contratos públicos rejeitam campos privados e formatos inválidos", () => {
  assert.equal(healthSchema.safeParse({ status: "ok", service: "croebet-api", password: "secret" }).success, false);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "UNAVAILABLE", message: "Indisponível" } }).success, true);
});

