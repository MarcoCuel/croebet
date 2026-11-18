import { test } from "node:test";
import assert from "node:assert/strict";
import { assertResetAllowed } from "../src/db/reset-guard.ts";
const url = "postgresql://localhost/croebet_test";
const allowed = { APP_ENV: "test", DB_RESET_ALLOWED_URL: url, DB_RESET_CONFIRM: "croebet_test" };
test("reset exige ambiente, destino exato, identificação do banco e confirmação", () => {
  assert.doesNotThrow(() => assertResetAllowed(allowed, "test", "croebet_test", url));
  for (const [env, marker, name, destination] of [
    [{}, "test", "croebet_test", url],
    [{ ...allowed, APP_ENV: "production" }, "production", "croebet_test", url],
    [{ ...allowed, NODE_ENV: "production" }, "test", "croebet_test", url],
    [allowed, "production", "croebet_test", url],
    [allowed, undefined, "croebet_test", url],
    [allowed, "test", "other", url],
    [allowed, "test", "croebet_test", url + "?host=remote"],
    [{ ...allowed, DB_RESET_ALLOWED_URL: "" }, "test", "croebet_test", url],
    [{ ...allowed, DB_RESET_CONFIRM: "" }, "test", "croebet_test", url],
  ]) assert.throws(() => assertResetAllowed(env, marker, name, destination));
});
