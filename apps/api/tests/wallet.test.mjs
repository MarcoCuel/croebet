import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { transferCroins, transferCroinsInTransaction } from '../dist/modules/wallet/service.js';
import { croinsSchema, transactionsQuerySchema } from '@croebet/shared';

test('carteira exige sessão, rejeita paginação e não oferece gravação pública de saldo', async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  let authenticated = false;
  const pool = { query: async sql => {
    if (sql.includes('application_environment')) return { rows: [{ environment: 'test' }] };
    if (sql.includes('update sessions')) return { rows: authenticated ? [{ id: '00000000-0000-4000-8000-000000000001' }] : [] };
    if (sql.includes('select balance')) return { rows: [{ balance: '123' }] };
    throw new Error('unexpected query');
  } };
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test' } });
  for (const url of ['/api/v1/me/wallet', '/api/v1/me/transactions']) assert.equal((await app.inject(url)).statusCode, 401);
  authenticated = true;
  const cookies = { 'croebet-session': 'a'.repeat(43) };
  const wallet = await app.inject({ url: '/api/v1/me/wallet', cookies });
  assert.equal(wallet.statusCode, 200); assert.deepEqual(wallet.json(), { balance: 123 });
  assert.equal(wallet.headers['cache-control'], 'no-store');
  assert.equal((await app.inject({ url: '/api/v1/me/transactions?limit=101', cookies })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/v1/me/wallet', method: 'PATCH', cookies, payload: { balance: 900 } })).statusCode, 404);
});
test('transferência composta deixa a transação e a conexão sob controle do domínio', async () => {
  const input = { scope: 'test', idempotencyKey: 'one', from: 'a', to: 'b', actorAccountId: 'a', reason: 'test', reference: 'one', amount: 1 };
  const calls = [];
  let hash;
  const client = { query: async (sql, params) => {
    calls.push(sql);
    if (sql.startsWith('select id, payload_hash')) return { rows: hash ? [{ id: 'receipt', payload_hash: hash }] : [] };
    if (sql.startsWith('select id, kind')) return { rows: [{ id: 'a', kind: 'issuance', balance: '0' }, { id: 'b', kind: 'pot', balance: '0' }] };
    if (sql.startsWith('insert into wallet_operations')) hash = params[3];
    return { rows: [] };
  }, release: () => assert.fail('somente o domínio libera a conexão') };
  await transferCroinsInTransaction(client, input);
  assert.deepEqual(await transferCroinsInTransaction(client, input), { operationId: 'receipt' });
  await assert.rejects(transferCroinsInTransaction(client, { ...input, amount: 2 }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(calls.some(sql => /^(begin|commit|rollback)$/i.test(sql)), false);
  assert.equal(calls.filter(sql => sql.startsWith('insert into wallet_entries')).length, 1);
});
test('Croins recusam frações, overflow e transferências inválidas antes de acessar banco', async () => {
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) assert.equal(croinsSchema.safeParse(value).success, false);
  for (const value of [{ limit: 0 }, { offset: -1 }, { limit: 101 }, { extra: 1 }]) assert.equal(transactionsQuerySchema.safeParse(value).success, false);
  const input = { scope: 'test', idempotencyKey: 'one', from: 'a', to: 'b', actorAccountId: 'a', reason: 'test', reference: 'one', amount: 1 };
  const pool = { connect: async () => { throw new Error('must not connect'); } };
  for (const amount of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(transferCroins(pool, { ...input, amount }), { code: 'INVALID_TRANSFER' });
  await assert.rejects(transferCroins(pool, { ...input, to: 'a' }), { code: 'INVALID_TRANSFER' });
});

test('extrato filtra na consulta antes de paginar e inclui referência e saldo auditável', async () => {
  const { readTransactions } = await import('../dist/modules/wallet/service.js');
  const rows = Array.from({ length: 21 }, (_, index) => ({
    id: `93089d02-0b34-4b78-9d3e-${String(index).padStart(12, '0')}`,
    created_at: new Date('2026-11-19T04:00:00Z'), reason: 'Prêmio recebido', reference: 'Partida Flip 7', amount: '200', balance: '1250',
  }));
  const pool = { query: async (sql, parameters) => {
    assert.match(sql, /e.amount > 0/); assert.match(sql, /e.amount < 0/);
    assert.match(sql, /order by e.sequence desc limit/);
    assert.deepEqual(parameters, ['user', 21, 20, 'income']);
    return { rows };
  } };
  const result = await readTransactions(pool, 'user', 20, 20, 'income');
  assert.equal(result.items.length, 20); assert.equal(result.hasMore, true);
  assert.equal(result.items[0].reference, 'Partida Flip 7');
  assert.equal(result.items[0].balance, 1250);
  assert.equal(transactionsQuerySchema.safeParse({ direction: 'invalid' }).success, false);
});
