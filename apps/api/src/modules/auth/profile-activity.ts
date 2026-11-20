import type { Pool } from "pg";
import { profileActivitySchema } from "@croebet/shared";

// Aggregate persisted receipts and archives; never expose wallet values or game state.
export async function readProfileActivity(pool: Pick<Pool, "query">, userId: string) {
  const result = await pool.query(`
    with bounds as (
      select (now() at time zone 'America/Sao_Paulo')::date as today
    ), first_month as (
      select today, date_trunc('month', today - interval '1 year')::date as first_day from bounds
    ), period as (
      select today, first_day - extract(dow from first_day)::int as first_day from first_month
    ), receipts as (
      select d.claimed_at as happened_at, 0 as games, 0 as wins, 1 as daily_bonuses, 0 as coupons
      from daily_claims d join wallet_accounts w on w.id=d.account_id where w.user_id=$1
      union all
      select c.created_at, 0, 0, 0, 1
      from coupon_redemptions c join wallet_accounts w on w.id=c.account_id where w.user_id=$1
      union all
      select a.ended_at, 1,
        case when a.state->>'phase'='over' and player.value->>'kind'='human'
          and (player.value->>'total')::numeric = (
            select max((p->>'total')::numeric) from jsonb_array_elements(a.state->'players') p
          ) then 1 else 0 end, 0, 0
      from game_match_archives a
      join lateral jsonb_array_elements(a.participants) person on person->>'userId'=$1::text
      join lateral jsonb_array_elements(a.state->'players') with ordinality player(value, seat)
        on player.seat=(person->>'seat')::int+1
      cross join period
      where a.status='finished'
        and a.ended_at >= (period.first_day::timestamp at time zone 'America/Sao_Paulo')
        and a.ended_at < ((period.today+1)::timestamp at time zone 'America/Sao_Paulo')
    ), daily as (
      select (happened_at at time zone 'America/Sao_Paulo')::date as day,
        sum(games)::int as games, sum(wins)::int as wins,
        sum(daily_bonuses)::int as daily_bonuses, sum(coupons)::int as coupons
      from receipts cross join period
      where happened_at >= (period.first_day::timestamp at time zone 'America/Sao_Paulo')
        and happened_at < ((period.today+1)::timestamp at time zone 'America/Sao_Paulo')
      group by 1
    )
    select to_char(calendar.day, 'YYYY-MM-DD') as date,
      coalesce(d.games,0) as games, coalesce(d.wins,0) as wins,
      coalesce(d.daily_bonuses,0) as "dailyBonuses", coalesce(d.coupons,0) as coupons
    from period cross join lateral generate_series(period.first_day::timestamp, period.today::timestamp, interval '1 day') calendar(day)
    left join daily d on d.day=calendar.day::date order by calendar.day
  `, [userId]);
  return profileActivitySchema.parse({ timeZone: "America/Sao_Paulo", days: result.rows });
}
