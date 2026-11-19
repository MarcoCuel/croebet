import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProfile } from "../features/profile/profile-request.ts";

const profile = { username: "Tonho", displayName: "Tonho Público", avatarUrl: null };

test("perfil inicial consulta somente endpoint público sem cookies e sem cache", async () => {
  const result = await loadProfile("Tonho", "http://api", async (url, options) => {
    assert.equal(url, "http://api/api/v1/profiles/Tonho");
    assert.equal(options.headers, undefined);
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(profile);
  });
  assert.deepEqual(result, { status: "ready", profile });
});

test("404 de perfil difere de falha do serviço; contratos inválidos não são renderizados", async () => {
  assert.deepEqual(await loadProfile("inexistente", "http://api", async () => new Response(null, { status: 404 })), { status: "not-found" });
  for (const request of [
    async () => new Response(null, { status: 503 }),
    async () => { throw new DOMException("timeout", "TimeoutError"); },
    async () => Response.json({ ...profile, role: "admin" }),
    async () => Response.json({ username: 5 }),
  ]) assert.deepEqual(await loadProfile("Tonho", "http://api", request), { status: "unavailable" });
});
