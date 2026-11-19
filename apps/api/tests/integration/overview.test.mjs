import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { readOverview } from '../../dist/modules/admin/overview.js';

test('PostgreSQL: visão geral agrega uma vez, respeita Brasília e preserva histórico de contas removidas', async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL com banco isolado identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  t.after(() => pool.end());
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Shadow only the read models in this connection. No persistent fixture data.
    await client.query(`create temporary table users (id uuid, username text, created_at timestamptz) on commit drop;
      create temporary table wallet_accounts (id uuid, user_id uuid, kind text, balance bigint) on commit drop;
      create temporary table wallet_operations (id uuid, scope text, reason text, created_at timestamptz) on commit drop;
      create temporary table wallet_entries (id uuid, sequence bigint, account_id uuid, operation_id uuid, amount bigint) on commit drop;`);
    const user = randomUUID(), second = randomUUID(), account = randomUUID(), orphan = randomUUID(), issuance = randomUUID();
    const { today, yesterday, tomorrow, local_day } = (await client.query(`select
      ((statement_timestamp() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo') as today,
      (((statement_timestamp() at time zone 'America/Sao_Paulo')::date-1)::timestamp at time zone 'America/Sao_Paulo') as yesterday,
      (((statement_timestamp() at time zone 'America/Sao_Paulo')::date+1)::timestamp at time zone 'America/Sao_Paulo') as tomorrow,
      to_char(statement_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as local_day`)).rows[0];
    await client.query('insert into users values ($1,$2,$3),($4,$5,$6)', [user, 'Tonho', today, second, 'OutraConta', yesterday]);
    await client.query(`insert into wallet_accounts values ($1,$2,'user',42),($3,null,'user',10),($4,null,'issuance',-52)`, [account,user,orphan,issuance]);
    const fixtures = [
      [account, 'registration', 30, today], [account, `daily:${account}`, 10, yesterday],
      [account, `coupon:${randomUUID()}`, 7, today], [account, `adjustment:${user}`, -5, today],
      [orphan, `daily:${orphan}`, 10, today], [account, 'future', 99, tomorrow],
    ];
    let sequence = 0;
    for (const [owner, scope, amount, createdAt] of fixtures) {
      const operation = randomUUID();
      await client.query('insert into wallet_operations values ($1,$2,$3,$4)', [operation,scope,'Motivo editável',createdAt]);
      await client.query('insert into wallet_entries values ($1,$2,$3,$4,$5),($6,$7,$8,$4,$9)', [randomUUID(),++sequence,owner,operation,amount,randomUUID(),++sequence,issuance,-amount]);
    }
    const connection = { query: client.query.bind(client) };
    const todayData = await readOverview(connection, 1);
    assert.deepEqual(todayData.totals, { users: 2, activeUsers: 1, movements: 4, balance: 42 });
    assert.deepEqual(todayData.rewards, { dailyClaims: 1, couponRedemptions: 1 });
    assert.deepEqual(todayData.circulation, { registration: 30, daily: 10, coupons: 7, adjustments: -5, credits: 47, debits: 5 });
    assert.deepEqual(todayData.buckets, [{ day: local_day, movements: 4, credits: 47, debits: 5 }]);
    assert.deepEqual(todayData.recentUsers.map(entry => entry.username), ['Tonho']);
    assert.equal(todayData.transactions[0].username, null);
    assert.equal(todayData.transactions[0].userId, null);
    assert.equal(todayData.transactions.length, 4);
    for (const days of [7,30]) {
      const data = await readOverview(connection, days);
      assert.equal(data.buckets.length, days);
      assert.equal(data.totals.balance, 42);
      assert.equal(data.totals.movements, 5);
      assert.equal(data.circulation.daily, 20);
      assert.equal(data.rewards.dailyClaims, 2);
      assert.equal(data.buckets.at(-2).credits, 10);
      assert.equal(data.buckets[0].movements, 0);
      assert.equal(data.recentUsers.length, 2);
    }
    await client.query('truncate users,wallet_entries,wallet_operations,wallet_accounts');
    const empty = await readOverview(connection, 7);
    assert.deepEqual(empty.totals, { users: 0, activeUsers: 0, movements: 0, balance: 0 });
    assert.equal(empty.buckets.length, 7);
    assert.deepEqual(empty.transactions, []);
    assert.deepEqual(empty.recentUsers, []);
  } finally { await client.query('rollback'); client.release(); }
});
