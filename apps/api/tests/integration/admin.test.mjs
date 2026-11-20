import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { grantInitialBalance, claimDailyReward } from '../../dist/modules/economy/service.js';
import { readWallet, readTransactions } from '../../dist/modules/wallet/service.js';
import { changeUser, adjustBalance, saveCoupon, readCoupon, readCoupons, readAdminUsers, readAudit, readRedemptions } from '../../dist/modules/admin/service.js';
import { redeemCoupon } from '../../dist/modules/admin/redeem.js';
import { readGame, saveGame } from '../../dist/modules/games/service.js';
import { adminQuerySchema, couponsQuerySchema, gameWriteSchema } from '@croebet/shared';

test('PostgreSQL: administração, cupons concorrentes, ajustes auditáveis, rollback e último admin', async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL com banco isolado migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [];
  t.after(async () => { try { await pool.query('delete from sessions where user_id=any($1::uuid[])', [ids]); await pool.query('delete from users where id=any($1::uuid[])', [ids]); } finally { await pool.end(); } });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  assert.equal((await pool.query("select count(*)::int as total from users where role='admin' and status='active'")).rows[0].total, 0, 'Use um banco isolado sem administradores preexistentes');
  async function account(role) {
    const client = await pool.connect();
    const hash = randomUUID().replaceAll('-', '').repeat(2);
    try {
      await client.query('begin');
      const username = `AdminTest_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const user = (await client.query('insert into users (username,display_name,password_hash,role) values ($1,$1,$1,$2) returning id', [username, role])).rows[0].id;
      await grantInitialBalance(client, user);
      await client.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash, user]);
      await client.query('commit'); ids.push(user); return { id: user, hash, username };
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  }
  const a = await account('admin'); const b = await account('admin'); const u = await account('user'); const v = await account('user');
  const originalGame = await readGame(pool, 'flip7');
  try {
    const gameId = originalGame.id;
    const fields = { name: originalGame.name, description: originalGame.description, enabled: originalGame.enabled, imageUrl: originalGame.imageUrl, seo: originalGame.seo, version: originalGame.version };
    const input = gameWriteSchema.parse({ ...fields, name: 'Nome pelo painel', description: 'Descrição pelo painel.\nSegunda linha.' });
    await assert.rejects(saveGame(pool, u.id, u.hash, gameId, input), { code: 'NOT_FOUND' });
    const saved = await saveGame(pool, a.id, a.hash, gameId, input);
    assert.equal(saved.description, input.description);
    assert.equal((await readGame(pool, 'flip7')).name, input.name);
    assert.equal((await readGame(pool, gameId, true)).description, input.description);
    await assert.rejects(saveGame(pool, a.id, a.hash, gameId, { ...input, description: 'Sobrescrever' }), { code: 'VERSION_CONFLICT' });
    assert.equal((await readGame(pool, 'flip7')).description, input.description);
    const paused = await saveGame(pool, a.id, a.hash, gameId, { ...input, enabled: false, version: saved.version });
    assert.equal(paused.description, input.description);
    await assert.rejects(readGame(pool, 'flip7'), { code: 'NOT_FOUND' });
    const cleared = await saveGame(pool, a.id, a.hash, gameId, { ...input, description: '', version: paused.version });
    assert.equal(cleared.description, '');
    const changes = await readAudit(pool, gameId);
    assert.equal(changes.items[0].details.after.description, '');
  } finally {
    await pool.query('update games set name=$1,description=$2,enabled=$3,image_url=$4,seo=$5,version=$6 where id=$7', [originalGame.name, originalGame.description, originalGame.enabled, originalGame.imageUrl, JSON.stringify(originalGame.seo), originalGame.version, originalGame.id]);
  }
  const reason = 'Teste de administração';
  const config = { code: `LIVE_${randomUUID().slice(0, 8).toUpperCase()}`, amount: 7, limit: 1, startsAt: null, endsAt: null, paused: false, version: 0, reason };
  const couponId = await saveCoupon(pool, a.id, a.hash, null, config);
  const requests = [randomUUID(), randomUUID()];
  const race = await Promise.allSettled([u, v].map((user, index) => redeemCoupon(pool, user.id, user.hash, { code: config.code.toLowerCase().toUpperCase(), requestId: requests[index] })));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(race.find(result => result.status === 'rejected').reason.code, 'COUPON_UNAVAILABLE');
  const winnerIndex = race.findIndex(result => result.status === 'fulfilled');
  const winner = [u, v][winnerIndex]; const loser = [u, v][1 - winnerIndex];
  assert.equal((await readWallet(pool, winner.id)).balance, 37);
  await redeemCoupon(pool, winner.id, winner.hash, { code: config.code, requestId: requests[winnerIndex] });
  assert.equal((await readWallet(pool, winner.id)).balance, 37);
  await assert.rejects(redeemCoupon(pool, winner.id, winner.hash, { code: config.code, requestId: randomUUID() }), { code: 'ALREADY_REDEEMED' });
  assert.equal((await readCoupon(pool, couponId)).redeemed, 1);
  await saveCoupon(pool, a.id, a.hash, couponId, { ...config, amount: 11, limit: null });
  await redeemCoupon(pool, loser.id, loser.hash, { code: config.code, requestId: randomUUID() });
  assert.equal((await readWallet(pool, loser.id)).balance, 41);
  const changed = await readCoupon(pool, couponId);
  assert.equal(changed.distributed, 18); assert.equal(changed.redeemed, 2);
  const redemptionPage = await readRedemptions(pool, couponId, '', 0, 1);
  assert.equal(redemptionPage.hasMore, true);
  assert.equal((await readRedemptions(pool, couponId, winner.username)).items[0].amount, 7);
  assert.equal((await readRedemptions(pool, couponId, 'inexistente')).items.length, 0);
  assert.equal((await readTransactions(pool, winner.id, 20, 0)).items[0].amount, 7);
  await assert.rejects(saveCoupon(pool, a.id, a.hash, couponId, config), { code: 'VERSION_CONFLICT' });
  await assert.rejects(saveCoupon(pool, a.id, a.hash, couponId, { ...config, version: 1, limit: 1 }), { code: 'INVALID_LIMIT' });
  const list = await readCoupons(pool, couponsQuerySchema.parse({ q: config.code, limit: 1 }));
  assert.equal(list.total, 1); assert.equal(list.items[0].distributed, 18);
  const users = await readAdminUsers(pool, adminQuerySchema.parse({ q: winner.username }));
  assert.equal(users.total, 1); assert.equal(users.items[0].balance, 37); assert.equal('passwordHash' in users.items[0], false);

  const adjustment = { requestId: randomUUID(), direction: 'add', amount: 5, reason };
  await adjustBalance(pool, a.id, a.hash, winner.id, adjustment);
  await adjustBalance(pool, a.id, a.hash, winner.id, adjustment);
  assert.equal((await readWallet(pool, winner.id)).balance, 42);
  await assert.rejects(adjustBalance(pool, a.id, a.hash, winner.id, { ...adjustment, amount: 6 }), { code: 'IDEMPOTENCY_CONFLICT' });
  await assert.rejects(adjustBalance(pool, a.id, a.hash, winner.id, { requestId: randomUUID(), direction: 'remove', amount: 43, reason }), { code: 'INSUFFICIENT_FUNDS' });
  assert.equal((await readWallet(pool, winner.id)).balance, 42);
  await adjustBalance(pool, a.id, a.hash, winner.id, { requestId: randomUUID(), direction: 'remove', amount: 2, reason });
  assert.equal((await readWallet(pool, winner.id)).balance, 40);
  assert.equal((await readAudit(pool, winner.id)).items.length, 2);
  const entries = (await readTransactions(pool, winner.id, 20, 0)).items;
  assert.deepEqual(entries.slice(0, 2).map(entry => entry.amount), [-2, 5]);
  assert.deepEqual(entries.slice(0, 2).map(entry => entry.balance), [40, 42]);
  await assert.rejects(pool.query("update admin_audit set reason='alterado' where target_id=$1", [winner.id]));
  await assert.rejects(pool.query('delete from coupon_redemptions where coupon_id=$1', [couponId]));
  function failingPool(prefix) { return { connect: async () => {
    const connection = await pool.connect();
    return { query: (sql, parameters) => sql.startsWith(prefix) ? Promise.reject(new Error('simulated failure')) : connection.query(sql, parameters), release: () => connection.release() };
  } }; }
  const rollback = { requestId: randomUUID(), direction: 'add', amount: 3, reason };
  await assert.rejects(adjustBalance(failingPool('insert into admin_audit'), a.id, a.hash, winner.id, rollback), /simulated failure/);
  assert.equal((await readWallet(pool, winner.id)).balance, 40);
  await adjustBalance(pool, a.id, a.hash, winner.id, rollback);
  assert.equal((await readWallet(pool, winner.id)).balance, 43);
  const secondCode = `ROLL_${randomUUID().slice(0, 8).toUpperCase()}`;
  const secondCoupon = await saveCoupon(pool, a.id, a.hash, null, { ...config, code: secondCode, amount: 3 });
  const redeem = { code: secondCode, requestId: randomUUID() };
  await assert.rejects(redeemCoupon(failingPool('insert into coupon_redemptions'), winner.id, winner.hash, redeem), /simulated failure/);
  assert.equal((await readWallet(pool, winner.id)).balance, 43); assert.equal((await readCoupon(pool, secondCoupon)).redeemed, 0);
  await redeemCoupon(pool, winner.id, winner.hash, redeem);
  assert.equal((await readWallet(pool, winner.id)).balance, 46);
  // A paused/expired/scheduled coupon cannot grant a first credit.
  for (const extra of [{ paused: true }, { endsAt: '2020-01-01T00:00:00Z' }, { startsAt: '2099-01-01T00:00:00Z' }]) {
    const code = `NO_${randomUUID().slice(0, 8).toUpperCase()}`;
    await saveCoupon(pool, a.id, a.hash, null, { ...config, code, ...extra });
    await assert.rejects(redeemCoupon(pool, winner.id, winner.hash, { code, requestId: randomUUID() }), { code: 'COUPON_UNAVAILABLE' });
  }
  await changeUser(pool, a.id, a.hash, winner.id, { role: 'user', status: 'suspended', expectedRole: 'user', expectedStatus: 'active', reason });
  assert.equal((await pool.query('select 1 from sessions where user_id=$1', [winner.id])).rowCount, 0);
  await assert.rejects(claimDailyReward(pool, winner.id, winner.hash, randomUUID()), { code: 'UNAUTHENTICATED' });
  await changeUser(pool, a.id, a.hash, winner.id, { role: 'user', status: 'active', expectedRole: 'user', expectedStatus: 'suspended', reason });
  // Concurrent self-demotions are serialized; one active admin must survive.
  const demotions = await Promise.allSettled([a, b].map(user => changeUser(pool, user.id, user.hash, user.id, { role: 'user', status: 'active', expectedRole: 'admin', expectedStatus: 'active', reason })));
  assert.equal(demotions.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(demotions.find(result => result.status === 'rejected').reason.code, 'LAST_ADMIN');
  const demoted = [a, b][demotions.findIndex(result => result.status === 'fulfilled')];
  await assert.rejects(adjustBalance(pool, demoted.id, demoted.hash, loser.id, { ...adjustment, requestId: randomUUID() }), { code: 'NOT_FOUND' });
});
