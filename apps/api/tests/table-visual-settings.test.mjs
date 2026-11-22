import cookie from '@fastify/cookie';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTableVisualSettings, tableVisualPresetSchema } from '@croebet/shared';
import { createApp } from '../dist/app.js';
import { managementRoutes } from '../dist/modules/admin/routes.js';

test('preset global rejeita estado dos jogos e valores fora dos limites', () => {
  const valid = { version: 0, settings: defaultTableVisualSettings };
  for (const settings of [{ ...valid.settings, players: 2 }, { ...valid.settings, reveal: true }, { ...valid.settings, localCardScale: 4 }, { ...valid.settings, duration: Infinity }]) {
    assert.equal(tableVisualPresetSchema.safeParse({ ...valid, settings }).success, false);
  }
  assert.equal(tableVisualPresetSchema.safeParse(valid).success, true);
});

test('preset público não expõe estado privado; somente admin pode publicar', async t => {
  let reads = 0;
  const app = createApp(async () => {});
  t.after(() => app.close());
  await app.register(cookie);
  await app.register(managementRoutes, {
    pool: { query: async sql => { assert.equal(sql, 'select data,version from table_visual_settings where id=1'); reads++; return { rows: [] }; } },
    sessionName: 'session', current: async () => ({ id: 'user', role: 'user' }), limit: async () => true,
  });
  const response = await app.inject('/api/v1/table-visual-settings');
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.json(), { version: 0, settings: defaultTableVisualSettings });
  const denied = await app.inject({ method: 'PATCH', url: '/api/v1/admin/table-visual-settings', payload: { version: 0, settings: defaultTableVisualSettings } });
  assert.equal(denied.statusCode, 404);
  assert.equal(reads, 1);
});
