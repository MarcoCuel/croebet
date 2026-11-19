import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEconomy, loadDailyStatus } from '../features/wallet/economy-api.ts';

const economy = { initialBalance: 30, dailyReward: 10, dailyCooldownHours: 24, suggestedBets: [1, 5, 10, 50], defaultBet: 5 };
const status = { balance: 40, lastClaimAt: '2026-11-19T02:59:00.000Z', nextClaimAt: '2026-11-20T02:59:00.000Z', eligible: false, serverNow: '2026-11-19T03:00:00.000Z' };
test('economia vem da API e dados privados iniciais encaminham cookie sem cache', async () => {
  assert.deepEqual(await loadEconomy('http://api', async (url, options) => {
    assert.equal(url, 'http://api/api/v1/economy'); assert.equal(options.cache, 'no-store');
    return Response.json(economy);
  }), economy);
  assert.deepEqual(await loadDailyStatus('http://api', 'croebet-session=token', async (url, options) => {
    assert.equal(url, 'http://api/api/v1/rewards/daily'); assert.deepEqual(options.headers, { cookie: 'croebet-session=token' });
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    return Response.json(status);
  }), status);
});
test('API indisponível ou contrato inválido não fabricam configuração, saldo ou bônus', async () => {
  for (const request of [async () => Response.json({}), async () => new Response(null, { status: 503 }), async () => { throw new Error('offline'); }]) {
    assert.equal(await loadEconomy('http://api', request), null);
    assert.equal(await loadDailyStatus('http://api', 'cookie', request), null);
  }
});
