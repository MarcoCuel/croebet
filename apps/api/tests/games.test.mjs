import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameWriteSchema } from '@croebet/shared';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { readGames, readGame, saveGame } from '../dist/modules/games/service.js';

const row = { id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', slug: 'flip7', name: 'Flip 7', enabled: true, image_url: null, version: 1 };
const input = { name: 'Flip 7', enabled: true, imageUrl: null, version: 1 };
test('jogos aceitam capa ausente e recusam URLs executáveis e versões inválidas', () => {
  assert.equal(gameWriteSchema.safeParse(input).success, true);
  for (const imageUrl of ['javascript:alert(1)', 'data:image/svg+xml,x', '//example.com/a', '/\\example.com/a']) assert.equal(gameWriteSchema.safeParse({ ...input, imageUrl }).success, false);
  for (const imageUrl of ['https://example.com/capa.webp', '/art/minha-capa.webp']) assert.equal(gameWriteSchema.safeParse({ ...input, imageUrl }).success, true);
  assert.equal(gameWriteSchema.safeParse({ ...input, version: 0 }).success, false);
});
test('consulta pública só permite jogos ativos e não inventa jogos ou imagens', async () => {
  const pool = { query: async sql => { assert.match(sql, /enabled=true/); return { rows: [row] }; } };
  assert.equal((await readGames(pool)).items[0].imageUrl, null);
  assert.equal((await readGame(pool, 'flip7')).name, 'Flip 7');
  await assert.rejects(readGame({ query: async () => ({ rows: [] }) }, 'flip7'), { status: 404 });
});
test('endpoints administrativos de jogos exigem sessão e proteção de escrita', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  const pool = { query: async () => ({ rows: [{ environment: 'test' }] }) };
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test' } });
  assert.equal((await app.inject('/api/v1/admin/games')).statusCode, 404);
  assert.equal((await app.inject('/api/v1/games/roleta')).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/admin/games/flip7', method: 'PATCH', payload: input })).statusCode, 403);
});
function transaction(version, failAudit = false) {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role: 'admin', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select * from games')) return { rows: [{ ...row, version }] };
    if (sql.startsWith('update games')) return { rows: [{ ...row, name: params[0], enabled: params[1], image_url: params[2], version: version + 1 }] };
    if (failAudit && sql.startsWith('insert into admin_audit')) throw new Error('audit unavailable');
    return { rows: [] };
  }, release: () => calls.push('release') };
  return { calls, pool: { connect: async () => client } };
}
test('edição recusa versão obsoleta; status e auditoria confirmam juntos', async () => {
  const stale = transaction(2);
  await assert.rejects(saveGame(stale.pool, 'admin', 'hash', 'flip7', input), { code: 'VERSION_CONFLICT' });
  assert.equal(stale.calls.some(sql => sql.startsWith('update')), false);
  assert.ok(stale.calls.includes('rollback'));
  const valid = transaction(1);
  const game = await saveGame(valid.pool, 'admin', 'hash', 'flip7', { ...input, enabled: false });
  assert.equal(game.enabled, false); assert.equal(game.version, 2); assert.equal(game.imageUrl, null);
  assert.ok(valid.calls.some(sql => sql.startsWith('insert into admin_audit')));
  assert.ok(valid.calls.includes('commit'));
  const failed = transaction(1, true);
  await assert.rejects(saveGame(failed.pool, 'admin', 'hash', 'flip7', input));
  assert.ok(failed.calls.includes('rollback')); assert.equal(failed.calls.includes('commit'), false);
});
