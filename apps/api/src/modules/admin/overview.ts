import type { Pool } from "pg";
import { adminOverviewSchema, overviewDaysSchema } from "@croebet/shared";

// One statement gives totals, time bounds and lists the same PostgreSQL snapshot.
// Only user-side entries count: their issuance counterparts must never double totals.
export async function readOverview(pool: Pool, days: 1 | 7 | 30) {
  overviewDaysSchema.parse(days);
  const result = await pool.query(`with bounds as (
    select statement_timestamp() as now,
      (statement_timestamp() at time zone 'America/Sao_Paulo')::date as today,
      (((statement_timestamp() at time zone 'America/Sao_Paulo')::date - ($1::int - 1))::timestamp at time zone 'America/Sao_Paulo') as starts_at
  ), entries as (
    select e.id, e.sequence, e.amount, o.scope, o.reason, o.created_at, u.id as user_id, u.username
    from wallet_entries e join wallet_accounts a on a.id=e.account_id
    join wallet_operations o on o.id=e.operation_id left join users u on u.id=a.user_id
    cross join bounds b
    where a.kind='user' and o.created_at >= b.starts_at and o.created_at <= b.now
  ), daily as (
    select (created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as movements,
      coalesce(sum(amount) filter (where amount > 0),0) as credits,
      coalesce(-sum(amount) filter (where amount < 0),0) as debits
    from entries group by 1
  ) select b.now,
    jsonb_build_object(
      'users',(select count(*) from users),
      'activeUsers',(select count(distinct user_id) from entries),
      'movements',(select count(*) from entries),
      'balance',(select coalesce(sum(a.balance),0) from wallet_accounts a join users u on u.id=a.user_id where a.kind='user')
    ) as totals,
    (select jsonb_build_object(
      'dailyClaims',count(*) filter (where scope like 'daily:%'),
      'couponRedemptions',count(*) filter (where scope like 'coupon:%')
    ) from entries) as rewards,
    (select jsonb_build_object(
      'registration',coalesce(sum(amount) filter (where scope='registration'),0),
      'daily',coalesce(sum(amount) filter (where scope like 'daily:%'),0),
      'coupons',coalesce(sum(amount) filter (where scope like 'coupon:%'),0),
      'adjustments',coalesce(sum(amount) filter (where scope like 'adjustment:%'),0),
      'credits',coalesce(sum(amount) filter (where amount > 0),0),
      'debits',coalesce(-sum(amount) filter (where amount < 0),0)
    ) from entries) as circulation,
    (select jsonb_agg(jsonb_build_object('day',to_char(b.today-i,'YYYY-MM-DD'),
      'movements',coalesce(d.movements,0),'credits',coalesce(d.credits,0),'debits',coalesce(d.debits,0)) order by i desc)
      from generate_series(0,$1::int-1) i left join daily d on d.day=b.today-i) as buckets,
    (select coalesce(jsonb_agg(row_to_json(recent)), '[]'::jsonb) from (
      select id,username,created_at as "createdAt" from users
      where created_at >= b.starts_at and created_at <= b.now order by created_at desc,id limit 5
    ) recent) as recent_users,
    (select coalesce(jsonb_agg(row_to_json(recent)), '[]'::jsonb) from (
      select id,user_id as "userId",username,reason as description,amount,created_at as "createdAt"
      from entries order by sequence desc limit 8
    ) recent) as transactions
    from bounds b`, [days]);
  const row = result.rows[0];
  const dates = (items: { createdAt: string }[]) => items.map(item => ({ ...item, createdAt: new Date(item.createdAt).toISOString() }));
  return adminOverviewSchema.parse({
    days, generatedAt: row.now.toISOString(), totals: row.totals, rewards: row.rewards,
    circulation: row.circulation, buckets: row.buckets,
    recentUsers: dates(row.recent_users), transactions: dates(row.transactions),
  });
}
