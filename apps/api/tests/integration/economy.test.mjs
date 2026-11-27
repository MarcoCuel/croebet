import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { grantInitialBalance, claimDailyReward, readDailyStatus } from '../../dist/modules/economy/service.js';
import { readTransactions, readWallet, transferCroinsInTransaction } from '../../dist/modules/wallet/service.js';
import { issuanceAccountId } from '../../dist/modules/economy/config.js';
import { readAdminTransactions } from '../../dist/modules/admin/service.js';

test('PostgreSQL: cadastro, resgate sem teto, corrida, retry, cooldown e rollback econômico', async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL com banco isolado migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const users = [];
  t.after(async () => {
    try {
      // A window left enabled would leak the extra claim into later runs.
      await pool.query('delete from bonus_window_settings where id=1').catch(() => {});
      await pool.query('delete from sessions where user_id=any($1::uuid[])', [users]);
      await pool.query('delete from users where id=any($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  // Start from the approved one-claim rule even if a previous interrupted run left a window behind.
  await pool.query('delete from bonus_window_settings where id=1');
  // Exercise the production SQL calendar boundary directly, including UTC/local date differences.
  for (const [claimed, expected] of [
    [null, null],
    ['2026-11-19T01:00:00Z', '2026-11-19T03:00:00.000Z'],
    ['2026-11-19T03:00:00Z', '2026-11-20T03:00:00.000Z'],
    ['2026-12-31T23:00:00-03:00', '2027-01-01T03:00:00.000Z'],
    ['2026-02-28T22:00:00-03:00', '2026-03-01T03:00:00.000Z'],
  ]) {
    const row = (await pool.query(`select (((($1::timestamptz) at time zone $2)::date + 1)::timestamp at time zone $2) as next_claim_at`,
      [claimed, 'America/Sao_Paulo'])).rows[0];
    assert.equal(row.next_claim_at?.toISOString() ?? null, expected);
  }
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
  const nextLocal = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(replay.nextClaimAt));
  assert.equal(nextLocal, '00:00');
  assert.ok(Date.parse(replay.nextClaimAt) > Date.parse(replay.lastClaimAt));
  const entries = (await readTransactions(pool, user, 20, 0)).items;
  assert.deepEqual(entries.map(entry => entry.amount), [10, 30]);
  assert.deepEqual(entries.map(entry => entry.balance), [40, 30]);
  const account = (await pool.query('select id from wallet_accounts where user_id=$1', [user])).rows[0].id;
  await assert.rejects(pool.query('update daily_claims set claimed_at=now() where account_id=$1', [account]));
  await assert.rejects(claimDailyReward(pool, user, 'invalid', randomUUID()), { code: 'UNAUTHENTICATED' });

  // A fixture from the previous local day exercises the calendar reset.
  const otherName = `Economy_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const other = (await pool.query('insert into users (username, display_name, password_hash) values ($1,$1,$1) returning id', [otherName])).rows[0].id;
  users.push(other);
  const setup = await pool.connect();
  try {
    await setup.query('begin');
    await grantInitialBalance(setup, other);
    const otherAccount = (await setup.query('select id from wallet_accounts where user_id=$1', [other])).rows[0].id;
    const receipt = await transferCroinsInTransaction(setup, { scope: 'fixture', idempotencyKey: other, from: issuanceAccountId, to: otherAccount, actorAccountId: otherAccount, amount: 10, reason: 'Resgate diário', reference: 'Fixture' });
    await setup.query("insert into daily_claims (account_id,request_id,operation_id,claimed_at) values ($1,$2,$3,((clock_timestamp() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo')-interval '1 hour')", [otherAccount, randomUUID(), receipt.operationId]);
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

  // The configured "horário bugado" window raises the daily limit to two claims, even under clicks racing.
  const clockRow = (await pool.query(`select extract(hour from (clock_timestamp() at time zone 'America/Sao_Paulo'))::int as hour,
    extract(minute from (clock_timestamp() at time zone 'America/Sao_Paulo'))::int as minute`)).rows[0];
  const localMinute = clockRow.hour * 60 + clockRow.minute;
  // A window always ends before 23:59, so the last minute of the day cannot be covered.
  if (localMinute >= 1439) return;
  const formatClock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const data = { enabled: true, windows: [{ start: formatClock(Math.max(0, localMinute - 2)), end: formatClock(Math.min(1439, localMinute + 2)) }] };
  await pool.query("insert into bonus_window_settings (id,data,version) values (1,$1,1) on conflict (id) do update set data=excluded.data,version=excluded.version",
    [JSON.stringify({ ...data, version: 1 })]);
  const thirdSession = 'c'.repeat(64);
  const thirdName = `Economy_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const third = (await pool.query('insert into users (username, display_name, password_hash) values ($1,$1,$1) returning id', [thirdName])).rows[0].id;
  users.push(third);
  const thirdSetup = await pool.connect();
  try {
    await thirdSetup.query('begin');
    await grantInitialBalance(thirdSetup, third);
    await thirdSetup.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [thirdSession, third]);
    await thirdSetup.query('commit');
  } catch (error) { await thirdSetup.query('rollback'); throw error; } finally { thirdSetup.release(); }
  const status = await readDailyStatus(pool, third);
  assert.equal(status.eligible, true);
  const windowRequests = [randomUUID(), randomUUID(), randomUUID()];
  const windowRace = await Promise.allSettled(windowRequests.map(id => claimDailyReward(pool, third, thirdSession, id)));
  assert.equal(windowRace.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal(windowRace.find(result => result.status === 'rejected').reason.code, 'DAILY_COOLDOWN');
  assert.deepEqual(await readWallet(pool, third), { balance: 50 });
  const thirdAccount = (await pool.query('select id from wallet_accounts where user_id=$1', [third])).rows[0].id;
  const claimed = (await pool.query('select kind from daily_claims where account_id=$1 order by claimed_at', [thirdAccount])).rows;
  assert.deepEqual(claimed.map(row => row.kind), ['daily', 'window']);
  const thirdEntries = (await readTransactions(pool, third, 20, 0)).items;
  // Both window credits use the standard statement text; origin stays only in the internal claim kind.
  assert.equal(thirdEntries.filter(entry => entry.description === 'Resgate diário').length, 2);
  assert.equal(thirdEntries.filter(entry => entry.reference === 'Resgate diário').length, 2);
  assert.equal(thirdEntries.filter(entry => /bugado/i.test(entry.description) || /bugado/i.test(entry.reference ?? '')).length, 0);
  assert.equal(thirdEntries.some(entry => 'claimOrder' in entry), false);
  // The admin view identifies the day's first claim and the extra one.
  const adminView = await readAdminTransactions(pool, third, 20, 0);
  assert.deepEqual(adminView.items.filter(entry => entry.claimOrder !== null).map(entry => entry.claimOrder).sort(), [1, 2]);
  assert.equal(adminView.items.filter(entry => entry.claimOrder === 2)[0].description, 'Resgate diário');
  const winnerClaim = windowRequests[windowRace.findIndex(result => result.status === 'fulfilled')];
  assert.equal((await claimDailyReward(pool, third, thirdSession, winnerClaim)).balance, 50);
  assert.equal((await readTransactions(pool, third, 20, 0)).items.length, 3);

  // A claim made before the window consumes the day and must not open the extra when the window starts.
  const outsideMinute = localMinute >= 60 ? localMinute - 60 : localMinute + 60;
  const fourthSession = 'd'.repeat(64);
  const fourthName = `Economy_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const fourth = (await pool.query('insert into users (username, display_name, password_hash) values ($1,$1,$1) returning id', [fourthName])).rows[0].id;
  users.push(fourth);
  const fourthSetup = await pool.connect();
  try {
    await fourthSetup.query('begin');
    await grantInitialBalance(fourthSetup, fourth);
    const fourthAccount = (await fourthSetup.query('select id from wallet_accounts where user_id=$1', [fourth])).rows[0].id;
    const receipt = await transferCroinsInTransaction(fourthSetup, { scope: 'fixture-outside-window', idempotencyKey: fourth, from: issuanceAccountId, to: fourthAccount, actorAccountId: fourthAccount, amount: 10, reason: 'Resgate diário', reference: 'Fixture' });
    await fourthSetup.query(`insert into daily_claims (account_id,request_id,operation_id,claimed_at,kind)
      values ($1,$2,$3, ((clock_timestamp() at time zone 'America/Sao_Paulo')::date::timestamp + make_interval(hours => $4::int, mins => $5::int)) at time zone 'America/Sao_Paulo', 'daily')`,
      [fourthAccount, randomUUID(), receipt.operationId, Math.floor(outsideMinute / 60), outsideMinute % 60]);
    await fourthSetup.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')", [fourthSession, fourth]);
    await fourthSetup.query('commit');
  } catch (error) { await fourthSetup.query('rollback'); throw error; } finally { fourthSetup.release(); }
  assert.equal((await readDailyStatus(pool, fourth)).eligible, false);
  await assert.rejects(claimDailyReward(pool, fourth, fourthSession, randomUUID()), { code: 'DAILY_COOLDOWN' });
  assert.deepEqual(await readWallet(pool, fourth), { balance: 40 });
});
