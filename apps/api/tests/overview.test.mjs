import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminOverviewSchema, overviewQuerySchema } from '@croebet/shared';
import { readOverview } from '../dist/modules/admin/overview.js';

const row = () => ({
  now: new Date('2026-11-19T03:00:00Z'),
  totals: { users: 0, activeUsers: 0, movements: 0, balance: 0 },
  rewards: { dailyClaims: 0, couponRedemptions: 0 },
  circulation: { registration: 0, daily: 0, coupons: 0, adjustments: 0, credits: 0, debits: 0 },
  buckets: [{ day: '2026-11-19', movements: 0, credits: 0, debits: 0 }],
  recent_users: [], transactions: [],
});
test('visão geral aceita somente períodos previstos e rejeita campos extras', () => {
  assert.deepEqual(overviewQuerySchema.parse({}), { days: 7 });
  for (const days of [1, '7', '30']) assert.equal(overviewQuerySchema.parse({ days }).days, Number(days));
  for (const days of [0, -1, 2, 31, 1.5, '', null, ['7']]) assert.equal(overviewQuerySchema.safeParse({ days }).success, false);
  assert.equal(overviewQuerySchema.safeParse({ days: 7, userId: 'alguém' }).success, false);
});
test('visão geral não inventa dados na falha e rejeita agregados sem precisão segura', async () => {
  const empty = await readOverview({ query: async () => ({ rows: [row()] }) }, 1);
  assert.equal(empty.totals.balance, 0);
  assert.equal(empty.generatedAt, '2026-11-19T03:00:00.000Z');
  await assert.rejects(readOverview({ query: async () => { throw new Error('offline'); } }, 1), /offline/);
  const unsafe = row(); unsafe.totals.balance = Number.MAX_SAFE_INTEGER + 1;
  await assert.rejects(readOverview({ query: async () => ({ rows: [unsafe] }) }, 1));
  assert.equal(adminOverviewSchema.safeParse({ ...empty, days: 7 }).success, false);
  await assert.rejects(readOverview({ query: async () => assert.fail('período inválido não consulta o banco') }, 365));
});
