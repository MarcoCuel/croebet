import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogMarketWriteSchema, catalogMarketSchema } from '@croebet/shared';
import { readMarkets, readMarket, saveMarket, deleteMarket } from '../dist/modules/markets/service.js';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
const input = { question: 'Pergunta de teste?', criterion: 'Critério de teste', type: 'binary', options: ['Sim', 'Não'], unit: '', status: 'draft', endsAt: null, version: 0 };
const row = { ...input, id: '93089d02-0b34-4b78-9d3e-f2679c190b5c', ends_at: null, version: 1 };
test('catálogo valida formatos e recusa opções duplicadas, versões e estados de liquidação', () => {
  assert.equal(catalogMarketWriteSchema.safeParse(input).success, true);
  for (const change of [{ options: ['Sim', 'Sim'] }, { type: 'choice', options: ['A', 'a'] }, { type: 'number' }, { version: -1 }, { status: 'paid' }, { type: 'number', unit: 'minutos', options: ['A', 'B'] }])
    assert.equal(catalogMarketWriteSchema.safeParse({ ...input, ...change }).success, false);
  assert.equal(catalogMarketWriteSchema.safeParse({ ...input, type: 'number', unit: 'minutos', options: [] }).success, true);
  assert.equal(catalogMarketSchema.safeParse({ ...input, id: row.id, version: 1 }).success, true);
  assert.equal(catalogMarketSchema.safeParse({ ...input, id: row.id, version: 1, options: [] }).success, false);
});
test('catálogo vazio não gera exemplos; falha de banco difere de ausência', async () => {
  assert.deepEqual(await readMarkets({ query: async () => ({ rows: [] }) }), { items: [] });
  await assert.rejects(readMarkets({ query: async () => { throw Error('offline'); } }), /offline/);
  await assert.rejects(readMarket({ query: async () => ({ rows: [] }) }, row.id), { status: 404 });
});
function transaction({ before = row, failAudit = false, role = 'admin' } = {}) {
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push(sql);
    if (sql.startsWith('select id, role')) return { rows: [{ id: 'admin', role, status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    if (sql.startsWith('select * from markets')) return { rows: before ? [before] : [] };
    if (sql.startsWith('insert into markets') || sql.startsWith('update markets')) return { rows: [{ ...row, question: values[0], options: JSON.parse(values[3]), version: sql.startsWith('update') ? before.version + 1 : 1 }] };
    if (failAudit && sql.startsWith('insert into admin_audit')) throw Error('audit failure');
    return { rows: [] };
  }, release() { calls.push('release'); } };
  return { calls, pool: { connect: async () => client } };
}
test('criação, edição e exclusão auditadas exigem versão e revertem na falha', async () => {
  const created = transaction({ before: null });
  assert.equal((await saveMarket(created.pool, 'admin', 'hash', null, input)).version, 1);
  assert.ok(created.calls.includes('commit'));
  const stale = transaction();
  await assert.rejects(saveMarket(stale.pool, 'admin', 'hash', row.id, input), { code: 'VERSION_CONFLICT' });
  assert.equal(stale.calls.some(sql => sql.startsWith('update markets')), false);
  assert.ok(stale.calls.includes('rollback'));
  const edited = transaction();
  assert.equal((await saveMarket(edited.pool, 'admin', 'hash', row.id, { ...input, version: 1 })).version, 2);
  for (const action of [tx => saveMarket(tx.pool, 'admin', 'hash', row.id, { ...input, version: 1 }), tx => deleteMarket(tx.pool, 'admin', 'hash', row.id, 1)]) {
    const failed = transaction({ failAudit: true });
    await assert.rejects(action(failed), /audit failure/);
    assert.ok(failed.calls.includes('rollback')); assert.equal(failed.calls.includes('commit'), false);
  }
  const removed = transaction();
  assert.deepEqual(await deleteMarket(removed.pool, 'admin', 'hash', row.id, 1), { ok: true });
  assert.ok(removed.calls.includes('commit'));
  const forbidden = transaction({ role: 'user' });
  await assert.rejects(saveMarket(forbidden.pool, 'admin', 'hash', null, input), { code: 'NOT_FOUND' });
  assert.equal(forbidden.calls.some(sql => sql.startsWith('insert into markets')), false);
});
test('apostas administrativas exigem autenticação e CSRF, sem catálogo público', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  await app.register(authRoutes, { pool: { query: async () => ({ rows: [{ environment: 'test' }] }) }, config: { APP_ENV: 'test' } });
  assert.equal((await app.inject('/api/v1/admin/markets')).statusCode, 404);
  assert.equal((await app.inject('/api/v1/markets')).statusCode, 404);
  assert.equal((await app.inject({ url: '/api/v1/admin/markets', method: 'POST', payload: input })).statusCode, 403);
});
