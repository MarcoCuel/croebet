import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadNavigation } from '../features/menus/api.ts';
test('menus iniciais são públicos e sem cache; indisponibilidade difere de menu vazio', async () => {
  const empty = { main: [], footer: [] };
  assert.deepEqual(await loadNavigation('http://api', async (url, options) => {
    assert.equal(url, 'http://api/api/v1/navigation'); assert.equal(options.cache, 'no-store'); assert.equal(options.headers, undefined); assert.equal(options.redirect, 'error');
    return Response.json(empty);
  }), empty);
  for (const request of [async () => new Response(null, { status: 503 }), async () => Response.json({}), async () => { throw Error('offline'); }]) assert.equal(await loadNavigation('http://api', request), null);
});
