import assert from 'node:assert/strict';
import { test } from 'node:test';
import { managementRequest } from '../features/admin/management-api.ts';

test('requisições administrativas sem corpo omitem Content-Type e preservam CSRF', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/v1/auth/csrf') return Response.json({ token: 'csrf-test' });
    requests.push({ url, ...options });
    return Response.json({ ok: true });
  });
  const schema = { parse: value => value };
  const path = '/admin/media/93089d02-0b34-4b78-9d3e-f2679c190b5c';
  assert.deepEqual(await managementRequest(path, schema, 'DELETE'), { ok: true });
  assert.equal(requests[0].url, `/api/v1${path}`);
  assert.equal(requests[0].method, 'DELETE');
  assert.equal(requests[0].body, undefined);
  assert.deepEqual(requests[0].headers, { 'x-csrf-token': 'csrf-test' });
  assert.equal(requests[0].credentials, 'same-origin');

  await managementRequest('/admin/games', schema, 'POST', { name: 'Jogo' });
  assert.equal(requests[1].headers['Content-Type'], 'application/json');
  assert.equal(requests[1].body, JSON.stringify({ name: 'Jogo' }));
  const image = new Blob(['image'], { type: 'image/png' });
  await managementRequest('/admin/media', schema, 'POST', image);
  assert.equal(requests[2].headers['Content-Type'], 'image/png');
  assert.equal(requests[2].body, image);
});
