import { test } from "node:test";
import assert from "node:assert/strict";
import { newToken, tokenHash, csrfToken, validCsrf } from "../src/modules/auth/security.ts";
test("sessões têm entropia e armazenamento unidirecional; CSRF vincula sessão, nonce e segredo", () => {
  const session = newToken(); const nonce = newToken(); const secret = newToken();
  assert.match(session, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(session, newToken()); assert.notEqual(tokenHash(session), session);
  const token = csrfToken(secret, nonce, session);
  assert.equal(validCsrf(secret, nonce, session, token), true);
  for (const [key, n, s, t] of [[secret, nonce, newToken(), token], [newToken(), nonce, session, token], [secret, newToken(), session, token], [secret, undefined, session, token], [secret, nonce, session, "bad"], [secret, nonce, session, [token]]]) assert.equal(validCsrf(key, n, s, t), false);
  const anonymous = csrfToken(secret, nonce, "");
  assert.equal(validCsrf(secret, nonce, session, anonymous), false);
});
