import { validateMediaReferences } from "../media/service.ts";
import type { Pool } from "pg";
import type { z } from "zod";
import { gameSchema, gamesSchema, type gameCreateSchema, type gameDeleteSchema, type gameWriteSchema } from "@croebet/shared";
import { getGameDefinition } from "@croebet/shared";
import { randomUUID } from "node:crypto";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

// Completed archives survive account deletion. Never expose their private state.
const selection = `select games.*, coalesce(
  (select avg(extract(epoch from (a.ended_at-a.started_at)))::float8
   from game_match_archives a where a.game_id=games.id and a.status='finished' and a.ended_at>a.started_at),
  (select avg(case when a.only_bots then nullif(a.playback_milliseconds,0)/1000.0
                   else extract(epoch from (a.ended_at-a.started_at)) end)::float8
   from game_test_archives a where a.game_id=games.id and a.status='finished' and a.ended_at>a.started_at),
  games.fallback_duration_minutes * 60
) as average_duration_seconds from games`;

function project(row: Record<string, unknown>) {
  return gameSchema.parse({ id: row.id, moduleId: row.module_id ?? row.slug, slug: row.slug, name: row.name, description: row.description, enabled: row.enabled, imageUrl: row.image_url, seo: row.seo, version: row.version, fallbackDurationMinutes: row.fallback_duration_minutes ?? null, averageDurationSeconds: row.average_duration_seconds ?? null });
}
export async function readGames(pool: Pool, admin = false) {
  const result = await pool.query(`${selection} where deleted_at is null ${admin ? "" : "and enabled=true"} order by name,slug`);
  return gamesSchema.parse({ items: result.rows.map(project) });
}
export async function readGame(pool: Pool, identifier: string, admin = false) {
  const result = await pool.query(`${selection} where ${admin ? "id=$1" : "(slug=$1 or module_id=$1)"} ${admin ? "" : "and enabled=true and deleted_at is null"}`, [identifier]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
  return project(result.rows[0]);
}
export async function saveGame(pool: Pool, actorId: string, hash: string, id: string, input: z.infer<typeof gameWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    await validateMediaReferences(client, [input.imageUrl, input.seo?.image]);
    const before = (await client.query("select * from games where id=$1 for update", [id])).rows[0];
    if (!before || before.deleted_at) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
    if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "O jogo foi alterado. Recarregue antes de salvar.");
    if (input.slug && getGameDefinition(input.slug) && input.slug !== before.module_id) throw new ManagementError(409, "CONFLICT", "Este endereço é reservado para outro jogo.");
    const result = await client.query("update games set name=$1,enabled=$2,image_url=$3,seo=$5,description=$6,fallback_duration_minutes=$7,slug=$8,version=version+1 where id=$4 returning *", [input.name, input.enabled, input.imageUrl, id, JSON.stringify(input.seo ?? {}), input.description, input.fallbackDurationMinutes ?? null, input.slug ?? before.slug]);
    const game = project(result.rows[0]);
    await audit(client, actorId, game.id, "game.updated", "Edição de jogo", { before: project(before), after: game });
    return game;
  });
}

export async function createGame(pool: Pool, actorId: string, hash: string, input: z.infer<typeof gameCreateSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    await validateMediaReferences(client, [input.imageUrl, input.seo?.image]);
    const result = await client.query(
      "insert into games (slug,name,description,enabled,image_url,seo,fallback_duration_minutes,module_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
      [input.slug, input.name, input.description, input.enabled, input.imageUrl, JSON.stringify(input.seo), input.fallbackDurationMinutes ?? null, getGameDefinition(input.slug) ? input.slug : randomUUID()],
    );
    const game = project(result.rows[0]);
    await audit(client, actorId, game.id, "game.created", "Criação de jogo", { after: game });
    return game;
  });
}

// Keep catalog identity and every foreign key for historical replay and audit.
export async function deleteGame(pool: Pool, actorId: string, hash: string, id: string, input: z.infer<typeof gameDeleteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = (await client.query("select * from games where id=$1 for update", [id])).rows[0];
    if (!before || before.deleted_at) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
    if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "O jogo foi alterado. Recarregue antes de excluir.");
    const active = await client.query("select 1 from game_matches where game_id=$1 and status in ('lobby','playing') limit 1", [id]);
    if (active.rows.length) throw new ManagementError(409, "GAME_IN_USE", "Encerre as salas e partidas em andamento antes de excluir o jogo.");
    await client.query("update games set deleted_at=now(),enabled=false,version=version+1 where id=$1", [id]);
    await audit(client, actorId, id, "game.deleted", "Exclusão de jogo do catálogo", { before: project(before) });
    return { ok: true };
  });
}
