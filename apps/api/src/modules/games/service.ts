import { validateMediaReferences } from "../media/service.ts";
import type { Pool } from "pg";
import type { z } from "zod";
import { gameSchema, gamesSchema, type gameCreateSchema, type gameWriteSchema } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

// Completed archives survive account deletion. Never expose their private state.
const selection = `select games.*, coalesce(
  (select avg(extract(epoch from (a.ended_at-a.started_at)))::float8
   from game_match_archives a where a.game_id=games.id and a.status='finished' and a.ended_at>a.started_at),
  (select avg(extract(epoch from (a.ended_at-a.started_at)))::float8
   from game_test_archives a where a.game_id=games.id and a.status='finished' and a.ended_at>a.started_at),
  games.fallback_duration_minutes * 60
) as average_duration_seconds from games`;

function project(row: Record<string, unknown>) {
  return gameSchema.parse({ id: row.id, slug: row.slug, name: row.name, description: row.description, enabled: row.enabled, imageUrl: row.image_url, seo: row.seo, version: row.version, fallbackDurationMinutes: row.fallback_duration_minutes ?? null, averageDurationSeconds: row.average_duration_seconds ?? null });
}
export async function readGames(pool: Pool, admin = false) {
  const result = await pool.query(`${selection} ${admin ? "" : "where enabled=true"} order by name,slug`);
  return gamesSchema.parse({ items: result.rows.map(project) });
}
export async function readGame(pool: Pool, identifier: string, admin = false) {
  const result = await pool.query(`${selection} where ${admin ? "id" : "slug"}=$1 ${admin ? "" : "and enabled=true"}`, [identifier]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
  return project(result.rows[0]);
}
export async function saveGame(pool: Pool, actorId: string, hash: string, id: string, input: z.infer<typeof gameWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    await validateMediaReferences(client, [input.imageUrl, input.seo?.image]);
    const before = (await client.query("select * from games where id=$1 for update", [id])).rows[0];
    if (!before) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
    if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "O jogo foi alterado. Recarregue antes de salvar.");
    const result = await client.query("update games set name=$1,enabled=$2,image_url=$3,seo=$5,description=$6,fallback_duration_minutes=$7,version=version+1 where id=$4 returning *", [input.name, input.enabled, input.imageUrl, id, JSON.stringify(input.seo ?? {}), input.description, input.fallbackDurationMinutes ?? null]);
    const game = project(result.rows[0]);
    await audit(client, actorId, game.id, "game.updated", "Edição de jogo", { before: project(before), after: game });
    return game;
  });
}

export async function createGame(pool: Pool, actorId: string, hash: string, input: z.infer<typeof gameCreateSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    await validateMediaReferences(client, [input.imageUrl, input.seo?.image]);
    const result = await client.query(
      "insert into games (slug,name,description,enabled,image_url,seo,fallback_duration_minutes) values ($1,$2,$3,$4,$5,$6,$7) returning *",
      [input.slug, input.name, input.description, input.enabled, input.imageUrl, JSON.stringify(input.seo), input.fallbackDurationMinutes ?? null],
    );
    const game = project(result.rows[0]);
    await audit(client, actorId, game.id, "game.created", "Criação de jogo", { after: game });
    return game;
  });
}
