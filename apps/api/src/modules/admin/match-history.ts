import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { matchHistoryItemSchema, matchHistoryListSchema, gameReplaySchema, type matchHistoryQuerySchema } from "@croebet/shared";
import {gameDriver,archivedGame} from "../games/registry.ts";
import {gameDefinitions} from "@croebet/shared";
import { avatarUrl } from "../avatars/storage.ts";
import { ManagementError } from "./service.ts";
const identities = z.array(z.object({ seat: z.number().int(), userId: z.uuid().nullable(), name: z.string() }));
type ArchiveRow = { entry_amount?:string; pot_total?:string; payouts?:unknown; settlement?:string; id: string; game_id: string; code: string; rules_version: number; status: string; options: unknown; participants: unknown; state: unknown; started_at: Date; ended_at: Date | null; frame_count: number };
export function historyItem(row: ArchiveRow, avatars: ReadonlyMap<string, string | null> = new Map(), names: ReadonlyMap<string, string> = new Map()) {
  const game=archivedGame(row.state);
  const players=gameDriver(game).summarize(row.state);
  const people = identities.parse(row.participants);
  return matchHistoryItemSchema.parse({
    entryAmount:Number(row.entry_amount ?? 0),potTotal:Number(row.pot_total ?? 0),payouts:row.payouts ?? [],settlement:row.settlement ?? null,
    game,id: row.id, gameId: row.game_id, code: row.code, rulesVersion: row.rules_version, status: row.status, options: row.options,
    startedAt: row.started_at.toISOString(), endedAt: row.ended_at?.toISOString() ?? null, frameCount: row.frame_count,
    players: players.map((player, seat) => {
      const person = people.find(participant => participant.seat === seat);
      return { seat, userId: person?.userId ?? null, name: names.get(person?.userId ?? "") || person?.name || player.name,
        avatarUrl: avatars.get(person?.userId ?? "") ?? null, score: player.score,
        winner: row.status === "finished" && player.winner, bot: player.bot };
    }),
  });
}
async function readParticipantProfiles(client: Pool | PoolClient, rows: ArchiveRow[]) {
  const ids = [...new Set(rows.flatMap(row => identities.parse(row.participants).flatMap(person => person.userId ? [person.userId] : [])))];
  if (!ids.length) return { avatars: new Map<string, string | null>(), names: new Map<string, string>() };
  const users = await client.query<{ id: string; avatar_key: string | null; display_name: string; username: string }>("select id,avatar_key,display_name,username from users where id=any($1::uuid[])", [ids]);
  return {
    avatars: new Map(users.rows.map(user => [user.id, avatarUrl(user.avatar_key)])),
    names: new Map(users.rows.map(user => [user.id, user.display_name?.trim() || user.username || ""])),
  };
}
const selection = "select a.*,s.entry_amount,s.pot_total,s.payouts,s.status as settlement, (select count(*)::int from game_match_archive_frames f where f.match_id=a.id) frame_count from game_match_archives a left join game_match_stakes s on s.match_id=a.id";
export async function readGameHistory(pool: Pool, gameId: string, query: z.infer<typeof matchHistoryQuerySchema>) {
  const rows = await pool.query<ArchiveRow>(`${selection} where a.game_id=$1
    and ($2='all' or a.status=$2) and ($3='' or strpos(lower(a.code),lower($3))>0
      or exists(select 1 from jsonb_array_elements(a.participants) p where strpos(lower(p->>'name'),lower($3))>0))
    order by a.started_at desc,a.id desc limit $4 offset $5`, [gameId, query.status, query.q, query.limit + 1, query.offset]);
  const visible = rows.rows.slice(0,query.limit);
  const { avatars, names } = await readParticipantProfiles(pool, visible);
  return matchHistoryListSchema.parse({ items: visible.map(row => historyItem(row, avatars, names)), hasMore: rows.rows.length>query.limit });
}
export function readMatchReplay(pool: Pool, gameId: string, matchId: string, offset: number, limit: number) {
  return readReplay(pool, matchId, offset, limit, { gameId });
}
export function readOwnMatchReplay(pool: Pool, participantId: string, code: string, offset: number, limit: number) {
  return readReplay(pool, code, offset, limit, { participantId });
}
async function readReplay(pool: Pool, matchId: string, offset: number, limit: number, scope: { gameId: string } | { participantId: string }) {
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const condition = "gameId" in scope ? "a.game_id=$1" : "a.status in ('finished','abandoned') and exists (select 1 from jsonb_array_elements(a.participants) p where p->>'userId'=$1::text)";
    const scopeId = "gameId" in scope ? scope.gameId : scope.participantId;
    const rows = await client.query<ArchiveRow>(`${selection} where ${condition} and ${"gameId" in scope ? "a.id" : "a.code"}=$2`, [scopeId, matchId]);
    if (!rows.rows[0]) throw new ManagementError(404,"NOT_FOUND","Partida não encontrada.");
    const frames = await client.query<{event: unknown}>("select event from game_match_archive_frames where match_id=$1 order by version limit $2 offset $3", [rows.rows[0].id,limit+1,offset]);
    const { avatars, names } = await readParticipantProfiles(client, rows.rows);
    const result = gameReplaySchema.parse({ match: historyItem(rows.rows[0], avatars, names), finalState: gameDefinitions[archivedGame(rows.rows[0].state)].view.parse(rows.rows[0].state), frames: frames.rows.slice(0,limit).map(f=>f.event), offset, hasMore: frames.rows.length>limit });
    await client.query("commit");
    return result;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
