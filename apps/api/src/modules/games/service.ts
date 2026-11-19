import type { Pool } from "pg";
import type { z } from "zod";
import { gameSchema, gamesSchema, type gameWriteSchema } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

function project(row: Record<string, unknown>) {
  return gameSchema.parse({ id: row.id, slug: row.slug, name: row.name, enabled: row.enabled, imageUrl: row.image_url, version: row.version });
}
export async function readGames(pool: Pool, admin = false) {
  const result = await pool.query(`select * from games ${admin ? "" : "where enabled=true"} order by name,slug`);
  return gamesSchema.parse({ items: result.rows.map(project) });
}
export async function readGame(pool: Pool, identifier: string, admin = false) {
  const result = await pool.query(`select * from games where ${admin ? "id" : "slug"}=$1 ${admin ? "" : "and enabled=true"}`, [identifier]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
  return project(result.rows[0]);
}
export async function saveGame(pool: Pool, actorId: string, hash: string, id: string, input: z.infer<typeof gameWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = (await client.query("select * from games where id=$1 for update", [id])).rows[0];
    if (!before) throw new ManagementError(404, "NOT_FOUND", "Jogo não encontrado.");
    if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "O jogo foi alterado. Recarregue antes de salvar.");
    const result = await client.query("update games set name=$1,enabled=$2,image_url=$3,version=version+1 where id=$4 returning *", [input.name, input.enabled, input.imageUrl, id]);
    const game = project(result.rows[0]);
    await audit(client, actorId, game.id, "game.updated", "Edição de jogo", { before: project(before), after: game });
    return game;
  });
}
