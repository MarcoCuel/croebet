import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPageLinks, loadPublicPage } from '../features/pages/api.ts';
test('páginas públicas chegam sem cookies/cache e falha difere de ausência', async () => {
  const request = async (url, options) => {
    assert.equal(url, 'http://api/api/v1/pages/sobre');
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error'); assert.equal(options.headers, undefined);
    return new Response(null, { status: 404 });
  };
  assert.deepEqual(await loadPublicPage('http://api', 'sobre', request), { status: 'not-found' });
  assert.deepEqual(await loadPublicPage('http://api', 'sobre', async () => new Response(null, { status: 503 })), { status: 'unavailable' });
  assert.deepEqual(await loadPublicPage('http://api', 'sobre', async () => Response.json({ slug: 'sobre' })), { status: 'unavailable' });
  assert.equal(await loadPageLinks('http://api', async () => { throw Error('offline'); }), null);
  assert.deepEqual(await loadPageLinks('http://api', async () => Response.json({ items: [] })), []);
});
