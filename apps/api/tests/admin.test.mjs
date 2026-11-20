import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createApp } from '../dist/app.js';
import { authRoutes } from '../dist/modules/auth/routes.js';
import { changeUserIdentity, readAdminUsers, readCoupons, protectLastAdmin, adminTransaction, changeUser, saveCoupon, couponAvailability, adjustBalance } from '../dist/modules/admin/service.js';
import { redeemCoupon } from '../dist/modules/admin/redeem.js';
import { adminUserIdentitySchema, couponWriteSchema, redeemCouponSchema, balanceAdjustmentSchema, userChangeSchema, adminUserSchema } from '@croebet/shared';

const actor = '00000000-0000-4000-8000-000000000010';
const target = '00000000-0000-4000-8000-000000000020';
const requestId = '00000000-0000-4000-8000-000000000030';
const coupon = { code: 'CROE_7', amount: 7, limit: null, startsAt: null, endsAt: null, paused: false, version: 0, reason: 'Cupom da live' };
function database(query) {
  const calls = [];
  return { calls, pool: { connect: async () => ({ query: async (sql, parameters) => {
    calls.push([sql, parameters]);
    if (/^(begin|commit|rollback)$/.test(sql) || sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('select id, role, status from users')) return { rows: [{ id: actor, role: 'admin', status: 'active' }, { id: target, role: 'user', status: 'active' }] };
    if (sql.startsWith('select 1 from sessions')) return { rows: [{}] };
    return query(sql, parameters);
  }, release: () => calls.push(['release']) }) } };
}
test('contratos administrativos rejeitam campos privados, valores inválidos e datas incoerentes', () => {
  assert.equal(couponWriteSchema.parse(coupon).amount, 7);
  assert.equal(couponWriteSchema.parse({ ...coupon, code: ' croe_7 ' }).code, 'CROE_7');
  for (const input of [{ ...coupon, amount: 0 }, { ...coupon, amount: 0.5 }, { ...coupon, amount: Infinity }, { ...coupon, limit: 0 }, { ...coupon, startsAt: '2026-11-20T00:00:00Z', endsAt: '2026-11-19T00:00:00Z' }, { ...coupon, administrator: true }]) assert.equal(couponWriteSchema.safeParse(input).success, false);
  assert.equal(redeemCouponSchema.safeParse({ code: 'CROE', requestId, amount: 1000 }).success, false);
  assert.equal(balanceAdjustmentSchema.safeParse({ requestId, amount: 0, direction: 'remove', reason: 'Teste' }).success, false);
  assert.equal(userChangeSchema.safeParse({ role: 'superadmin', status: 'active', reason: 'Teste' }).success, false);
  assert.equal(adminUserSchema.safeParse({ passwordHash: 'secret' }).success, false);
});
test('validade usa instante do servidor, início inclusivo, término exclusivo e limite global', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const active = { startsAt: null, endsAt: null, limit: null, redeemed: 0, paused: false };
  assert.equal(couponAvailability(active, now), 'Ativo');
  assert.equal(couponAvailability({ ...active, startsAt: now.toISOString() }, now), 'Ativo');
  assert.equal(couponAvailability({ ...active, startsAt: new Date(+now + 1).toISOString() }, now), 'Agendado');
  assert.equal(couponAvailability({ ...active, endsAt: now.toISOString() }, now), 'Expirado');
  assert.equal(couponAvailability({ ...active, paused: true }, now), 'Pausado');
  assert.equal(couponAvailability({ ...active, limit: 1, redeemed: 1 }, now), 'Esgotado');
});
test('último administrador ativo não pode ser removido nem suspenso', async () => {
  const client = { query: async () => ({ rows: [{ total: 1 }] }) };
  for (const next of [{ role: 'user', status: 'active' }, { role: 'admin', status: 'suspended' }]) await assert.rejects(protectLastAdmin(client, { role: 'admin', status: 'active' }, next), { code: 'LAST_ADMIN' });
  await protectLastAdmin(client, { role: 'user', status: 'active' }, { role: 'user', status: 'suspended' });
  await protectLastAdmin({ query: async () => ({ rows: [{ total: 2 }] }) }, { role: 'admin', status: 'active' }, { role: 'user', status: 'active' });
});
test('admin é revalidado na transação antes de qualquer escrita', async () => {
  const calls = [];
  const pool = { connect: async () => ({ query: async sql => {
    calls.push(sql);
    return { rows: sql.startsWith('select id, role') ? [{ id: actor, role: 'user', status: 'active' }] : [] };
  }, release() {} }) };
  await assert.rejects(adminTransaction(pool, actor, 'hash', null, async () => assert.fail('não autorizar')), { code: 'NOT_FOUND' });
  assert.ok(calls.includes('rollback')); assert.equal(calls.some(sql => sql.startsWith('insert')), false);
});
test('suspensão revoga sessões e grava auditoria junto ao status; edição obsoleta é recusada', async () => {
  const db = database(async () => ({ rows: [] }));
  const input = { role: 'user', status: 'suspended', expectedRole: 'user', expectedStatus: 'active', reason: 'Moderação da conta' };
  await changeUser(db.pool, actor, 'hash', target, input);
  assert.ok(db.calls.some(([sql]) => sql.startsWith('delete from sessions')));
  const audit = db.calls.find(([sql]) => sql.startsWith('insert into admin_audit'));
  assert.deepEqual(audit[1].slice(0, 4), [actor, target, 'user.permissions', input.reason]);
  assert.equal(db.calls.at(-2)[0], 'commit');
  await assert.rejects(changeUser(db.pool, actor, 'hash', target, { ...input, expectedRole: 'admin' }), { code: 'VERSION_CONFLICT' });
});
test('cupom recusa alteração concorrente e limite abaixo dos resgates', async () => {
  const db = database(async sql => ({ rows: sql.startsWith('select * from coupons') ? [{ id: target, version: 2 }] : [{ total: 5 }] }));
  await assert.rejects(saveCoupon(db.pool, actor, 'hash', target, coupon), { code: 'VERSION_CONFLICT' });
  await assert.rejects(saveCoupon(db.pool, actor, 'hash', target, { ...coupon, version: 2, limit: 4 }), { code: 'INVALID_LIMIT' });
  assert.equal(db.calls.some(([sql]) => sql.startsWith('update coupons')), false);
});
test('ajuste reutiliza recibo com o mesmo conteúdo e recusa chave reaproveitada para outro valor', async () => {
  const { createHash } = await import('node:crypto');
  const input = { requestId, direction: 'add', amount: 7, reason: 'Correção de teste' };
  const payloadHash = createHash('sha256').update(JSON.stringify([target, input.direction, input.amount, input.reason])).digest('hex');
  const db = database(async () => ({ rows: [{ details: { payloadHash } }] }));
  await adjustBalance(db.pool, actor, 'hash', target, input);
  await assert.rejects(adjustBalance(db.pool, actor, 'hash', target, { ...input, amount: 8 }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(db.calls.some(([sql]) => sql.startsWith('insert')), false);
});
test('retry de resgate não credita novamente; outro cupom não pode reutilizar a chave', async () => {
  const calls = [];
  const now = new Date();
  const pool = { connect: async () => ({ query: async (sql) => {
    calls.push(sql);
    if (sql.startsWith('select u.id')) return { rows: [{ id: target }] };
    if (sql.startsWith('select id from wallet_accounts')) return { rows: [{ id: target }] };
    if (sql.startsWith('select code_snapshot')) return { rows: [{ code_snapshot: 'CROE' }] };
    if (sql.startsWith('select a.balance')) return { rows: [{ balance: '37', last_claim_at: null, now }] };
    return { rows: [] };
  }, release() {} }) };
  assert.equal((await redeemCoupon(pool, target, 'hash', { code: 'CROE', requestId })).balance, 37);
  await assert.rejects(redeemCoupon(pool, target, 'hash', { code: 'OUTRO', requestId }), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(calls.some(sql => sql.startsWith('insert')), false);
});
test('rotas administrativas escondem recursos de visitantes e usuários comuns e exigem CSRF', async t => {
  let role = null;
  const pool = { query: async sql => {
    if (sql.includes('application_environment')) return { rows: [{ environment: 'test' }] };
    if (sql.includes('update sessions')) return { rows: role ? [{ id: actor, role }] : [] };
    throw new Error('Consulta inesperada');
  } };
  const app = createApp(async () => {}); t.after(() => app.close());
  await app.register(authRoutes, { pool, config: { APP_ENV: 'test', WEB_ORIGIN: 'http://localhost:3000', CSRF_SECRET: 'x'.repeat(40) } });
  for (const currentRole of [null, 'user']) {
    role = currentRole;
    for (const path of ['/api/v1/admin/overview', '/api/v1/admin/users', '/api/v1/admin/coupons', `/api/v1/admin/users/${target}`, `/api/v1/admin/audit/${target}`]) assert.equal((await app.inject({ url: path, cookies: { 'croebet-session': 'a'.repeat(43) } })).statusCode, 404);
  }
  role = 'admin';
  for (const url of ['/api/v1/admin/overview?days=2', '/api/v1/admin/overview?days=7&userId=outro']) {
    const response = await app.inject({ url, cookies: { 'croebet-session': 'a'.repeat(43) } });
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  role = 'user';
  assert.equal((await app.inject({ url: '/api/v1/coupons/redeem', method: 'POST', payload: { code: 'CROE', requestId } })).statusCode, 403);
  const session = 'a'.repeat(43);
  const csrf = await app.inject({ url: '/api/v1/auth/csrf', cookies: { 'croebet-session': session } });
  const cookies = { 'croebet-session': session, ...Object.fromEntries(csrf.cookies.map(c => [c.name, c.value])) };
  for (const [url, method] of [[`/api/v1/admin/users/${target}/identity`, 'PATCH'], [`/api/v1/admin/users/${target}`, 'PATCH'], [`/api/v1/admin/users/${target}/adjustments`, 'POST'], ['/api/v1/admin/coupons', 'POST']]) {
    assert.equal((await app.inject({ url, method, cookies, headers: { origin: 'http://localhost:3000', 'x-csrf-token': csrf.json().token }, payload: { role: 'admin' } })).statusCode, 404);
  }

  assert.equal(z.uuid().safeParse(target).success, true);
});

test('contagens de usuários abrangem todos os status antes da paginação', async () => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push([sql, params]);
    return { rows: sql.includes('count(*)') ? [{ all: 42, active: 40, suspended: 2 }] : [] };
  } };
  const result = await readAdminUsers(pool, { q: 'Tonho', status: 'suspended', offset: 20, limit: 20 });
  assert.deepEqual(result.counts, { all: 42, active: 40, suspended: 2 });
  assert.equal(result.total, 2);
  assert.deepEqual(calls[1][1], ['%Tonho%']);
  assert.ok(!calls[1][0].includes("$2"));
});
test('contagens de cupons incluem status vazios e não dependem da página selecionada', async () => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push([sql, params]);
    return { rows: sql.includes('group by state') ? [{ state: 'Ativo', total: 25 }, { state: 'Pausado', total: 3 }] : [] };
  } };
  const result = await readCoupons(pool, { q: 'CROE', status: 'Pausado', offset: 20, limit: 20 });
  assert.deepEqual(result.counts, { Todos: 28, Ativo: 25, Agendado: 0, Pausado: 3, Expirado: 0, Esgotado: 0 });
  assert.equal(result.total, 3);
  assert.deepEqual(calls[1][1], ['%CROE%']);
  assert.ok(!calls[1][0].includes('$2'));
});

test('motivo administrativo aceita ausência, branco e texto curto, preservando limites', () => {
  const inputs = [
    [balanceAdjustmentSchema, { requestId, direction: 'add', amount: 7 }],
    [balanceAdjustmentSchema, { requestId, direction: 'remove', amount: 7 }],
    [userChangeSchema, { role: 'user', status: 'suspended', expectedRole: 'user', expectedStatus: 'active' }],
    [couponWriteSchema, { ...coupon, reason: undefined }],
  ];
  for (const [schema, input] of inputs) {
    for (const reason of [undefined, '', '   ']) assert.equal(schema.parse({ ...input, reason }).reason, '');
    assert.equal(schema.parse({ ...input, reason: ' ok ' }).reason, 'ok');
    for (const reason of ['a'.repeat(257), 'texto\u0000inválido', null]) assert.equal(schema.safeParse({ ...input, reason }).success, false);
  }
});

test('crédito e retirada sem motivo geram lançamento e auditoria na mesma transação', async () => {
  const { issuanceAccountId } = await import('../dist/modules/economy/config.js');
  for (const direction of ['add', 'remove']) {
    const db = database(async sql => {
      if (sql.startsWith('select id,user_id from wallet_accounts')) return { rows: [{ id: actor, user_id: actor }, { id: target, user_id: target }] };
      if (sql.startsWith('select id, kind, user_id, balance from wallet_accounts')) return { rows: [
        { id: issuanceAccountId, kind: 'issuance', user_id: null, balance: '-100' },
        { id: target, kind: 'user', user_id: target, balance: '30' },
      ] };
      return { rows: [] };
    });
    await adjustBalance(db.pool, actor, 'hash', target, balanceAdjustmentSchema.parse({ requestId, direction, amount: 7 }));
    const operation = db.calls.find(([sql]) => sql.startsWith('insert into wallet_operations'));
    assert.equal(operation[1][6], 'Ajuste administrativo');
    const audit = db.calls.find(([sql]) => sql.startsWith('insert into admin_audit'));
    assert.equal(audit[1][3], '');
    assert.ok(db.calls.some(([sql]) => sql.startsWith('insert into wallet_entries')));
    assert.ok(db.calls.some(([sql]) => sql === 'commit'));
  }
});

const identityInput = { displayName: 'Novo nome', username: 'Novo.Tonho', expectedDisplayName: 'Tonho', expectedUsername: 'Tonho' };
test('edição administrativa de identidade valida nomes e não aceita campos de permissão', () => {
  assert.equal(adminUserIdentitySchema.parse({ ...identityInput, displayName: ' Novo nome ' }).displayName, 'Novo nome');
  for (const input of [{ ...identityInput, displayName: '' }, { ...identityInput, username: 'espaço invalido' }, { ...identityInput, role: 'admin' }, { ...identityInput, expectedUsername: undefined }]) assert.equal(adminUserIdentitySchema.safeParse(input).success, false);
});
test('identidade é atualizada e auditada na mesma transação com valores anteriores', async () => {
  const {pool,calls} = database(async sql => sql.startsWith('select username,display_name') ? {rows:[{username:'Tonho',display_name:'Tonho'}]} : {rows:[]});
  await changeUserIdentity(pool,actor,'hash',target,identityInput);
  const update=calls.find(([sql])=>sql.startsWith('update users set display_name'));
  assert.deepEqual(update[1],['Novo nome','Novo.Tonho',target]);
  assert.ok(update[0].includes('username_changed_at=case'));
  const entry=calls.find(([sql])=>sql.startsWith('insert into admin_audit'));
  assert.equal(entry[1][2],'user.identity');
  assert.deepEqual(JSON.parse(entry[1][4]),{before:{displayName:'Tonho',username:'Tonho'},after:{displayName:'Novo nome',username:'Novo.Tonho'}});
  assert.equal(calls.at(-2)[0],'commit');
});
test('edição obsoleta e username ocupado revertem sem confirmar identidade', async () => {
  for (const conflict of ['stale','duplicate','audit']) {
    const {pool,calls}=database(async sql=>{
      if(sql.startsWith('select username,display_name'))return {rows:[{username:'Tonho',display_name:conflict==='stale'?'Outro':'Tonho'}]};
      if(sql.startsWith('update users')&&conflict==='duplicate')throw Object.assign(new Error('unique'),{code:'23505'});
      if(sql.startsWith('insert into admin_audit')&&conflict==='audit')throw new Error('audit unavailable');
      return {rows:[]};
    });
    await assert.rejects(changeUserIdentity(pool,actor,'hash',target,identityInput), conflict==='audit'?/audit unavailable/:{code:conflict==='stale'?'VERSION_CONFLICT':'USERNAME_TAKEN'});
    assert.equal(calls.at(-2)[0],'rollback');assert.equal(calls.some(([sql])=>sql==='commit'),false);
  }
});

test('exclusão agenda uma vez, revoga sessões e reverte se a auditoria falha', async () => {
  const { scheduleUserDeletion } = await import('../dist/modules/admin/service.js');
  let scheduled = false;
  const db = database(async sql => {
    if (sql.startsWith('update users set status=')) {
      if (scheduled) return { rows: [] };
      scheduled = true;
      return { rows: [{ deletion_scheduled_at: new Date('2026-12-20T00:00:00Z') }] };
    }
    return { rows: [] };
  });
  await scheduleUserDeletion(db.pool, actor, 'hash', target);
  await scheduleUserDeletion(db.pool, actor, 'hash', target);
  assert.equal(db.calls.filter(([sql]) => sql.startsWith('insert into admin_audit')).length, 1);
  assert.equal(db.calls.filter(([sql]) => sql.startsWith('delete from sessions')).length, 2);
  assert.equal(db.calls.some(([sql]) => sql.startsWith('delete from users')), false);
  const failed = database(async sql => {
    if (sql.startsWith('update users set status=')) return { rows: [{ deletion_scheduled_at: new Date() }] };
    if (sql.startsWith('insert into admin_audit')) throw Error('audit unavailable');
    return { rows: [] };
  });
  await assert.rejects(scheduleUserDeletion(failed.pool, actor, 'hash', target), /audit unavailable/);
  assert.ok(failed.calls.some(([sql]) => sql === 'rollback'));
  assert.equal(failed.calls.some(([sql]) => sql === 'commit'), false);
});

test('limpeza recusa ambiente incompatível e reverte falha na exclusão', async () => {
  const { cleanupDeletedAccounts } = await import('../dist/modules/auth/account-cleanup.js');
  const mismatch = database(async () => ({ rows: [{ environment: 'production' }] }));
  await assert.rejects(cleanupDeletedAccounts(mismatch.pool, 'test'), /Ambiente/);
  assert.equal(mismatch.calls.some(([sql]) => sql.startsWith('delete')), false);
  const failed = database(async sql => {
    if (sql.startsWith('select environment')) return { rows: [{ environment: 'test' }] };
    if (sql.startsWith('select id,avatar_key')) return { rows: [{ id: target, avatar_key: 'old.webp' }] };
    if (sql.startsWith('delete from users')) throw Error('database unavailable');
    return { rows: [] };
  });
  await assert.rejects(cleanupDeletedAccounts(failed.pool, 'test'), /database unavailable/);
  assert.ok(failed.calls.some(([sql]) => sql.startsWith('insert into avatar_cleanup')));
  assert.ok(failed.calls.some(([sql]) => sql === 'rollback'));
  assert.equal(failed.calls.some(([sql]) => sql === 'commit'), false);
});
