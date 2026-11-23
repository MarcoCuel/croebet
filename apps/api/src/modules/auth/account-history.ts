import type { Pool } from "pg";
import { accountHistorySchema } from "@croebet/shared";

export async function readAccountHistory(pool: Pick<Pool, "query">, userId: string, limit: number, offset: number, gamesOnly = false) {
  const result = await pool.query(`
    select * from (
      ${gamesOnly ? "" : `select 'transaction:' || e.id as id, 'transaction' as kind, o.reason as description,
        o.created_at, e.amount, null::uuid as match_id, null::text as match_code, null::text as game_slug, null::text as game_name, null::text as game_image_url
      from wallet_entries e join wallet_accounts w on w.id=e.account_id
      join wallet_operations o on o.id=e.operation_id where w.user_id=$1
      union all`}
      select 'game:' || a.id as id, 'game' as kind, g.name || ' · ' ||
        case when a.status='finished' then 'Partida concluída' else 'Partida encerrada' end as description,
        a.ended_at as created_at, null::bigint as amount, a.id as match_id, a.code as match_code, g.module_id as game_slug, g.name as game_name, g.image_url as game_image_url
      from game_match_archives a join games g on g.id=a.game_id
      where a.status in ('finished','abandoned') and a.ended_at is not null
        and exists (select 1 from jsonb_array_elements(a.participants) p where p->>'userId'=$1::text)
    ) history order by created_at desc, id desc limit $2 offset $3
  `, [userId, limit + 1, offset]);
  return accountHistorySchema.parse({
    items: result.rows.slice(0, limit).map(row => ({
      gameName: row.game_name ?? null, gameImageUrl: row.game_image_url ?? null,
      id: row.id, matchId: gamesOnly ? null : row.match_id ?? null, matchCode: gamesOnly ? null : row.match_code ?? null, gameSlug: gamesOnly ? null : row.game_slug ?? null, kind: row.kind, description: row.description,
      createdAt: row.created_at.toISOString(), amount: row.amount === null ? null : Number(row.amount),
    })), hasMore: result.rows.length > limit,
  });
}
