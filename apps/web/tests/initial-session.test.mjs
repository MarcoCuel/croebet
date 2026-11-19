import assert from "node:assert/strict";
import { test } from "node:test";
import { loadInitialSession } from "../features/auth/initial-session.ts";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user", avatarUrl: null, usernameChangeAvailableAt: null };

test("visitante sem cookie não precisa consultar a API", async () => {
  assert.deepEqual(await loadInitialSession(undefined, "http://api", () => { throw new Error("consulta desnecessária"); }), { user: null, ready: true });
});

test("sessão inicial valida a projeção da API e encaminha cookie sem cache", async () => {
  const session = await loadInitialSession("croebet-session=token", "http://api", async (url, options) => {
    assert.equal(url, "http://api/api/v1/me");
    assert.deepEqual(options.headers, { cookie: "croebet-session=token" });
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ user });
  });
  assert.deepEqual(session, { user, ready: true });
});

test("sessão expirada confirmada pela API é visitante", async () => {
  assert.deepEqual(await loadInitialSession("croebet-session=expired", "http://api", async () => Response.json({ user: null })), { user: null, ready: true });
});

test("indisponibilidade, timeout e contrato inválido não confirmam logout", async () => {
  for (const request of [
    async () => new Response(null, { status: 503 }),
    async () => { throw new DOMException("timeout", "TimeoutError"); },
    async () => Response.json({ user: { ...user, role: "owner" } }),
    async () => Response.json({ user, token: "secret" }),
  ]) {
    assert.deepEqual(await loadInitialSession("croebet-session=token", "http://api", request), { user: null, ready: false });
  }
});
