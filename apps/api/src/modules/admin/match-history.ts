import type { Pool } from "pg";
import { z } from "zod";
import { flip7ViewSchema, matchHistoryItemSchema, matchHistoryListSchema, matchReplaySchema, type matchHistoryQuerySchema } from "@croebet/shared";
import { ManagementError } from "./service.ts";
const identities = z.array(z.object({ seat: z.number().int(), userId: z.uuid().nullable(), name: z.string() }));
type ArchiveRow = { entry_amount?:string; pot_total?:string; payouts?:unknown; settlement?:string; id: string; game_id: string; code: string; rules_version: number; status: string; options: unknown; participants: unknown; state: unknown; started_at: Date; ended_at: Date | null; frame_count: number };
export function historyItem(row: ArchiveRow) {
  const state = flip7ViewSchema.parse(row.state);
  const people = identities.parse(row.participants);
  const maximum = Math.max(...state.players.map(p => p.total));
  return matchHistoryItemSchema.parse({
    entryAmount:Number(row.entry_amount ?? 0),potTotal:Number(row.pot_total ?? 0),payouts:row.payouts ?? [],settlement:row.settlement ?? null,
    id: row.id, gameId: row.game_id, code: row.code, rulesVersion: row.rules_version, status: row.status, options: row.options,
    startedAt: row.started_at.toISOString(), endedAt: row.ended_at?.toISOString() ?? null, frameCount: row.frame_count,
    players: state.players.map((player, seat) => ({ seat, userId: people.find(p => p.seat === seat)?.userId ?? null,
      name: people.find(p => p.seat === seat)?.name ?? player.name, score: player.total,
      winner: row.status === "finished" && state.phase === "over" && player.total === maximum, bot: player.kind !== "human" })),
  });
}
const selection = "select a.*,s.entry_amount,s.pot_total,s.payouts,s.status as settlement, (select count(*)::int from game_match_archive_frames f where f.match_id=a.id) frame_count from game_match_archives a left join game_match_stakes s on s.match_id=a.id";
export async function readGameHistory(pool: Pool, gameId: string, query: z.infer<typeof matchHistoryQuerySchema>) {
  const rows = await pool.query<ArchiveRow>(`${selection} where a.game_id=$1
    and ($2='all' or a.status=$2) and ($3='' or strpos(lower(a.code),lower($3))>0
      or exists(select 1 from jsonb_array_elements(a.participants) p where strpos(lower(p->>'name'),lower($3))>0))
    order by a.started_at desc,a.id desc limit $4 offset $5`, [gameId, query.status, query.q, query.limit + 1, query.offset]);
  return matchHistoryListSchema.parse({ items: rows.rows.slice(0,query.limit).map(historyItem), hasMore: rows.rows.length>query.limit });
}
export async function readMatchReplay(pool: Pool, gameId: string, matchId: string, offset: number, limit: number) {
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const rows = await client.query<ArchiveRow>(`${selection} where a.game_id=$1 and a.id=$2`, [gameId, matchId]);
    if (!rows.rows[0]) throw new ManagementError(404,"NOT_FOUND","Partida não encontrada.");
    const frames = await client.query<{event: unknown}>("select event from game_match_archive_frames where match_id=$1 order by version limit $2 offset $3", [matchId,limit+1,offset]);
    const result = matchReplaySchema.parse({ match: historyItem(rows.rows[0]), frames: frames.rows.slice(0,limit).map(f=>f.event), offset, hasMore: frames.rows.length>limit });
    await client.query("commit");
    return result;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
