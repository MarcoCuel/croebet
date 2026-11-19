import { test } from "node:test";
import assert from "node:assert/strict";
import { healthSchema, apiErrorSchema } from "../dist/index.js";
test("contratos públicos rejeitam campos privados e formatos inválidos", () => {
  assert.equal(healthSchema.safeParse({ status: "ok", service: "croebet-api", password: "secret" }).success, false);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "UNAVAILABLE", message: "Indisponível" } }).success, true);
});


import { registerSchema, loginSchema, publicUserSchema } from "../dist/index.js";
test("cadastro normaliza usuário, rejeita papel extra e nunca normaliza a senha", () => {
 const value = registerSchema.parse({ username: "  Marco.Teste ", password: " uma senha bem comprida " });
 assert.equal(value.username, "marco.teste"); assert.equal(value.password, " uma senha bem comprida ");
 for (const body of [{ username: "xy", password: "senha extensa bastante" }, { username: "abc", password: "curta" }, { username: "abc", password: "senha extensa bastante", role: "admin" }]) assert.equal(registerSchema.safeParse(body).success, false);
 assert.equal(loginSchema.safeParse({ username: "abc", password: "curta" }).success, true);
 assert.equal(publicUserSchema.safeParse({ id: "not-uuid", username: "abc", passwordHash: "private" }).success, false);
});
