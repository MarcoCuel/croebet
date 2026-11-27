import type { Pool } from "pg";
import { rankingSchema, type RankingQuery } from "@croebet/shared";
import { avatarUrl } from "../avatars/storage.ts";

// One snapshot ranks every eligible account before applying pagination or selecting the viewer.
export async function readRanking(pool: Pick<Pool, "query">, query: RankingQuery, viewer: string | null = null) {
  const period = query.category === "richest" ? "all" : query.period;
  // Saldo pertence à carteira, não a um jogo; a rota rejeita essa combinação.
  const game = query.category === "richest" ? null : query.game ?? null;
  const gameFilter = game ? "and a.game_id=(select id from games where slug=$4)" : "";
  const offset = (query.page - 1) * 10;
  const result = await pool.query(`with bounds as (
    select case when $1='month' then date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' else '-infinity'::timestamptz end as since
  ), metrics as (${query.category === "richest" ? `
    select user_id::text as user_id, balance::numeric as value, 0::bigint as games
    from wallet_accounts where kind='user' and user_id is not null
  ` : query.category === "wins" ? `
    select person->>'userId' as user_id,
      sum(case when player->>'kind'='human' and (
        case when a.state ? 'winners' then a.state->'winners' @> jsonb_build_array((person->>'seat')::int)
        else (player->>'total')::numeric=(
          select max((p->>'total')::numeric) from jsonb_array_elements(a.state->'players') p
        ) end
      ) then 1 else 0 end)::numeric as value, count(*) as games
    from game_match_archives a cross join bounds
    cross join lateral jsonb_array_elements(a.participants) person
    cross join lateral (select a.state->'players'->((person->>'seat')::int) as player) seat
    where a.status='finished' and a.state->>'phase'='over' and a.ended_at>=bounds.since and a.ended_at<=now() ${gameFilter}
    group by person->>'userId'
  ` : `
    select person->>'userId' as user_id,
      sum(case when player->>'kind'='human' and (
        case when a.state ? 'winners' then not (a.state->'winners' @> jsonb_build_array((person->>'seat')::int))
        else (player->>'total')::numeric < (
          select max((p->>'total')::numeric) from jsonb_array_elements(a.state->'players') p
        ) end
      ) then 1 else 0 end)::numeric as value, count(*) as games
    from game_match_archives a cross join bounds
    cross join lateral jsonb_array_elements(a.participants) person
    cross join lateral (select a.state->'players'->((person->>'seat')::int) as player) seat
    where a.status='finished' and a.state->>'phase'='over' and a.ended_at>=bounds.since and a.ended_at<=now() ${gameFilter}
    group by person->>'userId'
  `}), ranked as (
    select u.id as "userId",u.username,u.display_name as "displayName",u.avatar_key,
      m.value,m.games,rank() over(order by m.value desc) as position,
      row_number() over(order by m.value desc,lower(u.username),u.id) as ordering
    from metrics m join users u on u.id::text=m.user_id
    where u.status='active' and u.deletion_scheduled_at is null ${query.category === "richest" ? "" : "and m.value>0"}
  ) select * from ranked where (ordering>$2 and ordering<=$2+11) or "userId"=$3::uuid
    order by ordering`, game ? [period, offset, viewer, game] : [period, offset, viewer]);
  const entry = (row: typeof result.rows[number]) => ({
    userId: row.userId, username: row.username, displayName: row.displayName, avatarUrl: avatarUrl(row.avatar_key),
    position: Number(row.position), value: Number(row.value), games: Number(row.games),
  });
  return rankingSchema.parse({ category: query.category, period, page: query.page,
    items: result.rows.filter(row => Number(row.ordering)>offset && Number(row.ordering)<=offset+10).map(entry),
    hasMore: result.rows.some(row => Number(row.ordering)===offset+11),
    own: result.rows.find(row => row.userId===viewer) ? entry(result.rows.find(row => row.userId===viewer)!) : null,
  });
}
