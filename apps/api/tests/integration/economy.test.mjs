import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { grantInitialBalance, claimDailyReward, readDailyStatus } from '../../dist/modules/economy/service.js';
import { readTransactions, readWallet, transferCroinsInTransaction } from '../../dist/modules/wallet/service.js';
import { issuanceAccountId } from '../../dist/modules/economy/config.js';

test('PostgreSQL: cadastro, resgate sem teto, corrida, retry, cooldown e rollback econômico', async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL com banco isolado migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const users = [];
  t.after(async () => {
    try {
      await pool.query('delete from sessions where user_id=any($1::uuid[])', [users]);
      await pool.query('delete from users where id=any($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  const session = randomUUID().replaceAll('-', '').repeat(2);
  const client = await pool.connect();
  let user;
  try {
    await client.query('begin');
    const name = `Economy_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    user = (await client.query('insert into users (username, display_name, password_hash) values ($1,$1,$1) returning id', [name])).rows[0].id;
    users.push(user);
    await grantInitialBalance(client, user);
    // Initial credit is invisible until registration commits.
    assert.equal((await pool.query('select id from users where id=$1', [user])).rows.length, 0);
    await client.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [session, user]);
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  assert.deepEqual(await readWallet(pool, user), { balance: 30 });
  assert.equal((await readTransactions(pool, user, 20, 0)).items[0].description, 'Bônus de cadastro');
  // First claim is allowed immediately, including at a balance of 30 or more.
  assert.equal((await readDailyStatus(pool, user)).eligible, true);
  const requests = [randomUUID(), randomUUID()];
  const race = await Promise.allSettled(requests.map(id => claimDailyReward(pool, user, session, id)));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(race.find(result => result.status === 'rejected').reason.code, 'DAILY_COOLDOWN');
  assert.deepEqual(await readWallet(pool, user), { balance: 40 });
  const winner = requests[race.findIndex(result => result.status === 'fulfilled')];
  const replay = await claimDailyReward(pool, user, session, winner);
  assert.equal(replay.balance, 40); assert.equal(replay.eligible, false);
  assert.equal(Date.parse(replay.nextClaimAt) - Date.parse(replay.lastClaimAt), 24 * 3600000);
  const entries = (await readTransactions(pool, user, 20, 0)).items;
  assert.deepEqual(entries.map(entry => entry.amount), [10, 30]);
  assert.deepEqual(entries.map(entry => entry.balance), [40, 30]);
  const account = (await pool.query('select id from wallet_accounts where user_id=$1', [user])).rows[0].id;
  await assert.rejects(pool.query('update daily_claims set claimed_at=now() where account_id=$1', [account]));
  await assert.rejects(claimDailyReward(pool, user, 'invalid', randomUUID()), { code: 'UNAUTHENTICATED' });

  // A fixture with an older claim exercises credit after the rolling interval.
  const otherName = `Economy_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const other = (await pool.query('insert into users (username, display_name, password_hash) values ($1,$1,$1) returning id', [otherName])).rows[0].id;
  users.push(other);
  const setup = await pool.connect();
  try {
    await setup.query('begin');
    await grantInitialBalance(setup, other);
    const otherAccount = (await setup.query('select id from wallet_accounts where user_id=$1', [other])).rows[0].id;
    const receipt = await transferCroinsInTransaction(setup, { scope: 'fixture', idempotencyKey: other, from: issuanceAccountId, to: otherAccount, actorAccountId: otherAccount, amount: 10, reason: 'Resgate diário', reference: 'Fixture' });
    await setup.query("insert into daily_claims (account_id,request_id,operation_id,claimed_at) values ($1,$2,$3,clock_timestamp()-interval '24 hours 1 second')", [otherAccount, randomUUID(), receipt.operationId]);
    await setup.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", ['b'.repeat(64), other]);
    await setup.query('commit');
  } catch (error) { await setup.query('rollback'); throw error; } finally { setup.release(); }
  assert.equal((await readDailyStatus(pool, other)).eligible, true);
  // Crash between the credit and its domain record must roll back both.
  const failingPool = { connect: async () => {
    const connection = await pool.connect();
    return { query: (sql, parameters) => sql.startsWith('insert into daily_claims') ? Promise.reject(new Error('simulated failure')) : connection.query(sql, parameters), release: () => connection.release() };
  } };
  const retryId = randomUUID();
  await assert.rejects(claimDailyReward(failingPool, other, 'b'.repeat(64), retryId), /simulated failure/);
  assert.deepEqual(await readWallet(pool, other), { balance: 40 });
  assert.equal((await readTransactions(pool, other, 20, 0)).items.length, 2);
  assert.equal((await claimDailyReward(pool, other, 'b'.repeat(64), retryId)).balance, 50);
  assert.equal((await readTransactions(pool, other, 20, 0)).items.length, 3);
});
