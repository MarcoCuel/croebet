import type { Pool } from "pg";
import { accountHistorySchema } from "@croebet/shared";

export async function readAccountHistory(pool: Pick<Pool, "query">, userId: string, limit: number, offset: number) {
  const result = await pool.query(`
    select * from (
      select 'transaction:' || e.id as id, 'transaction' as kind, o.reason as description,
        o.created_at, e.amount
      from wallet_entries e join wallet_accounts w on w.id=e.account_id
      join wallet_operations o on o.id=e.operation_id where w.user_id=$1
      union all
      select 'game:' || a.id, 'game', g.name || ' · ' ||
        case when a.status='finished' then 'Partida concluída' else 'Partida encerrada' end,
        a.ended_at, null::bigint
      from game_match_archives a join games g on g.id=a.game_id
      where a.status in ('finished','abandoned') and a.ended_at is not null
        and exists (select 1 from jsonb_array_elements(a.participants) p where p->>'userId'=$1::text)
    ) history order by created_at desc, id desc limit $2 offset $3
  `, [userId, limit + 1, offset]);
  return accountHistorySchema.parse({
    items: result.rows.slice(0, limit).map(row => ({
      id: row.id, kind: row.kind, description: row.description,
      createdAt: row.created_at.toISOString(), amount: row.amount === null ? null : Number(row.amount),
    })), hasMore: result.rows.length > limit,
  });
}
