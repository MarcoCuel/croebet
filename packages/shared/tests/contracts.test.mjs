import { test } from "node:test";
import assert from "node:assert/strict";
import { healthSchema, apiErrorSchema } from "../dist/index.js";
test("contratos públicos rejeitam campos privados e formatos inválidos", () => {
  assert.equal(healthSchema.safeParse({ status: "ok", service: "croebet-api", password: "secret" }).success, false);
  assert.equal(apiErrorSchema.safeParse({ error: { code: "UNAVAILABLE", message: "Indisponível" } }).success, true);
});


import { registerSchema, loginSchema, publicUserSchema } from "../dist/index.js";
test("cadastro preserva maiúsculas do usuário, rejeita papel extra e nunca normaliza a senha", () => {
 const value = registerSchema.parse({ username: "  Marco.Teste ", password: " uma senha bem comprida " });
 assert.equal(value.username, "Marco.Teste"); assert.equal(value.password, " uma senha bem comprida ");
 assert.equal(loginSchema.parse({ username: "TONHO", password: "senha" }).username, "TONHO");
 assert.equal(publicUserSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" }).username, "Tonho");
 for (const body of [{ username: "xy", password: "senha extensa bastante" }, { username: "abc", password: "curta" }, { username: "abc", password: "senha extensa bastante", role: "admin" }]) assert.equal(registerSchema.safeParse(body).success, false);
 assert.equal(registerSchema.safeParse({ username: "abc", password: "1234567" }).success, false);
 assert.equal(registerSchema.safeParse({ username: "abc", password: "12345678" }).success, true);
 assert.equal(loginSchema.safeParse({ username: "abc", password: "curta" }).success, true);
 assert.equal(publicUserSchema.safeParse({ id: "not-uuid", username: "abc", passwordHash: "private" }).success, false);
});

import { changeUsernameSchema } from "../dist/index.js";
test("troca de usuário valida apenas o novo nome; prazo e identidade pertencem ao servidor", () => {
 assert.deepEqual(changeUsernameSchema.parse({ username: " Tonho " }), { username: "Tonho" });
 for (const body of [{ username: "xy" }, { username: "Tonho!" }, { username: "Tonho", usernameChangedAt: null }, { username: "Tonho", userId: "outro" }]) {
   assert.equal(changeUsernameSchema.safeParse(body).success, false);
 }
});
