import assert from "node:assert/strict";
import { test } from "node:test";
import { demoPermissions } from "../features/auth/permissions.ts";

test("admin é negado por padrão, para visitantes e para usuários comuns", () => {
  for (const name of [null, "", "Visitante", "admin", "Marco"]) {
    assert.equal(demoPermissions(name, undefined, true).canManageSite, false);
    assert.equal(
      demoPermissions(name, "Administrador", true).canManageSite,
      false,
    );
  }
  assert.equal(demoPermissions("qualquer", "*", true).canManageSite, false);
});

test("somente usuários explicitamente configurados recebem permissão local", () => {
  assert.equal(
    demoPermissions("  MARCO  ", " outro, marco, ", true).canManageSite,
    true,
  );
  assert.equal(demoPermissions("mar", "Marco", true).canManageSite, false);
  assert.equal(demoPermissions("Marco", "Marco", false).canManageSite, false);
  assert.equal(demoPermissions(null, "Marco", true).canManageSite, false);
});
