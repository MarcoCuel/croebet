import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { economy, issuanceAccountId } from '../dist/modules/economy/config.js';
import { dailyStatus, grantInitialBalance, claimDailyReward } from '../dist/modules/economy/service.js';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { couponAmountSchema, dailyClaimSchema } from '@croebet/shared';

test('rotas da API carregam diretamente em TypeScript no modo de desenvolvimento do Node', () => {
  execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    'import { authRoutes } from "./src/modules/auth/routes.ts"; if (typeof authRoutes !== "function") throw new Error("Rotas indisponíveis");'],
  { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});

test('economia aprovada é centralizada; cupons aceitam valores livres inteiros positivos', () => {
  assert.deepEqual(economy, { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: 'America/Sao_Paulo', suggestedBets: [5, 10, 15, 25, 50], defaultBet: 5 });
  for (const amount of [1, 7, 333, Number.MAX_SAFE_INTEGER]) assert.equal(couponAmountSchema.parse(amount), amount);
  for (const amount of [0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(couponAmountSchema.safeParse(amount).success, false);
  assert.equal(dailyClaimSchema.safeParse({ requestId: 'invalid' }).success, false);
  assert.equal(dailyClaimSchema.safeParse({ requestId: '00000000-0000-4000-8000-000000000001', amount: 999 }).success, false);
});
test('resgate libera à meia-noite de São Paulo, sem qualquer teto de saldo', () => {
  const claimed = new Date('2026-11-19T01:00:00.000Z'); // 22h de 18/11 em São Paulo
  const next = new Date('2026-11-19T03:00:00.000Z'); // meia-noite de 19/11
  const status = (balance, lastClaimAt, now, nextClaimAt) => dailyStatus({ balance, lastClaimAt, now, nextClaimAt, windowActive: false, nextWindowAt: null });
  for (const balance of [0, 29, 30, 39, 100000]) {
    assert.equal(status(balance, null, claimed, null).eligible, true);
    assert.equal(status(balance, claimed, new Date('2026-11-19T02:00:00Z'), next).eligible, false);
    assert.equal(status(balance, claimed, new Date(next.getTime() - 1), next).eligible, false);
    assert.equal(status(balance, claimed, next, next).eligible, true);
    assert.equal(status(balance, claimed, new Date('2026-11-19T04:00:00Z'), next).eligible, true); // 1h do dia seguinte
    assert.equal(status(balance, claimed, next, next).nextClaimAt, next.toISOString());
  }
});
test('cadastro concede crédito auditável na transação do chamador', async () => {
  const calls = [];
  const client = { query: async (sql, parameters) => {
    calls.push([sql, parameters]);
    if (sql.startsWith('insert into wallet_accounts')) return { rows: [{ id: 'user-account' }] };
    if (sql.startsWith('select id, kind')) return { rows: [{ id: issuanceAccountId, kind: 'issuance', balance: '0' }, { id: 'user-account', kind: 'user', user_id: 'user', balance: '0' }] };
    return { rows: [] };
  } };
  await grantInitialBalance(client, 'user');
  const operation = calls.find(([sql]) => sql.startsWith('insert into wallet_operations'))[1];
  assert.equal(operation[1], 'registration'); assert.equal(operation[2], 'user');
  assert.equal(operation[5], 'Bônus de cadastro');
  const entries = calls.find(([sql]) => sql.startsWith('insert into wallet_entries'))[1];
  assert.deepEqual(entries.slice(1), [issuanceAccountId, '-30', '-30', 'user-account', '30', '30']);
  assert.equal(calls.some(([sql]) => /^(begin|commit|rollback)$/i.test(sql)), false);
});
test('resgate revalida sessão dentro da transação e faz rollback se a conta foi deslogada', async () => {
  const calls = [];
  const pool = { connect: async () => ({ query: async sql => { calls.push(sql); return { rows: [] }; }, release: () => calls.push('release') }) };
  await assert.rejects(claimDailyReward(pool, 'user', 'hash', 'id'), { code: 'UNAUTHENTICATED' });
  assert.equal(calls[0], 'begin'); assert.ok(calls.includes('rollback')); assert.equal(calls.at(-1), 'release');
  assert.equal(calls.some(sql => sql.startsWith('insert')), false);
});
test('HTTP expõe configuração, protege resgate por sessão/CSRF e recusa valor controlado pelo cliente', async t => {
  const pool = { query: async sql => {
    if (sql.includes('application_environment')) return { rows: [{ environment: 'test' }] };
    if (sql.includes('update sessions')) return { rows: [{ id: 'user' }] };
    throw new Error('Consulta inesperada');
  } };
  const app = createApp(async () => {}); t.after(() => app.close());
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test', WEB_ORIGIN: 'http://localhost:3000', CSRF_SECRET: 'x'.repeat(40) } });
  assert.deepEqual((await app.inject('/api/v1/economy')).json(), economy);
  assert.equal((await app.inject('/api/v1/rewards/daily')).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/v1/rewards/daily/claim', method: 'POST', payload: {} })).statusCode, 403);
  const session = 'a'.repeat(43);
  const csrf = await app.inject({ url: '/api/v1/auth/csrf', cookies: { 'croebet-session': session } });
  const response = await app.inject({ url: '/api/v1/rewards/daily/claim', method: 'POST',
    cookies: { 'croebet-session': session, ...Object.fromEntries(csrf.cookies.map(c => [c.name, c.value])) },
    headers: { origin: 'http://localhost:3000', 'x-csrf-token': csrf.json().token }, payload: { requestId: '00000000-0000-4000-8000-000000000001', amount: 1000 } });
  assert.equal(response.statusCode, 400);
});
