import type { Pool, PoolClient } from "pg";
import type { AchievementMetric } from "@croebet/shared";

export async function readAchievementMetrics(client: Pick<Pool | PoolClient, "query">, userId: string) {
  const result = await client.query(`with days as (
    select distinct (d.claimed_at at time zone 'America/Sao_Paulo')::date as day
    from daily_claims d join wallet_accounts w on w.id=d.account_id
    where w.user_id=$1 and d.claimed_at<=now()
  ), islands as (
    select day, day - (row_number() over(order by day))::int as island from days
  ), streaks as (
    select count(*)::int as length,max(day) as last_day from islands group by island
  ), games as (
    select a.state, a.state->'players'->((p->>'seat')::int) as player
    from game_match_archives a cross join lateral jsonb_array_elements(a.participants) p
    where p->>'userId'=$1::text and a.status='finished' and a.state->>'phase'='over' and a.ended_at<=now()
  ), losses as (
    select s.entry_amount::numeric - coalesce((select sum((p->>'amount')::numeric)
      from jsonb_array_elements(s.payouts) p where p->>'seat'=person->>'seat' and p->>'house'='false'),0) as loss
    from game_match_stakes s cross join lateral jsonb_array_elements(s.contributions) person
    where person->>'userId'=$1::text and s.status='paid' and s.settled_at<=now()
  ) select
    (select count(*) from games where player->>'kind'='human') as games,
    (select count(*) from games where player->>'kind'='human' and (player->>'total')::numeric=(
      select max((p->>'total')::numeric) from jsonb_array_elements(state->'players') p)) as wins,
    (select count(*) from days) as "dailyDays",
    coalesce((select max(length) from streaks),0) as "dailyStreak",
    coalesce((select max(length) from streaks where last_day >= (now() at time zone 'America/Sao_Paulo')::date-1),0) as "currentStreak",
    (select count(*) from coupon_redemptions c join wallet_accounts w on w.id=c.account_id where w.user_id=$1 and c.created_at<=now()) as coupons,
    (select count(*) from losses where loss>0) as "losingGames",
    coalesce((select sum(loss) from losses where loss>0),0) as "lostCroins"`, [userId]);
  const row = result.rows[0];
  const count = (key: string) => {
    const value = Number(row[key]);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid achievement metric");
    return value;
  };
  const metrics: Record<AchievementMetric, number> = { games: count("games"), wins: count("wins"), dailyDays: count("dailyDays"), dailyStreak: count("dailyStreak"), coupons: count("coupons"), losingGames: count("losingGames") };
  return { metrics, stats: { currentStreak: count("currentStreak"), games: metrics.games, lostCroins: count("lostCroins") } };
}
