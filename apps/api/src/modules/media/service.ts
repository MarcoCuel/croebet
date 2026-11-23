import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { mediaItemSchema, mediaListSchema } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";
import type { ImageStorage } from "../storage/images.ts";
import { processMedia } from "./image.ts";
export const mediaUrl = (id: string) => `/api/v1/media/${id}.webp`;
function project(row: Record<string, unknown>) {
  return mediaItemSchema.parse({ ...row, url: mediaUrl(String(row.id)), createdAt: (row.created_at as Date).toISOString() });
}
export async function readMedia(pool: Pool, q: string, offset: number) {
  const result = await pool.query("select * from media_assets where state='ready' and name ilike $1 order by created_at desc,id desc limit 25 offset $2", [`%${q.replace(/[\\%_]/g, "\\$&")}%`, offset]);
  return mediaListSchema.parse({ items: result.rows.slice(0, 24).map(project), hasMore: result.rows.length > 24 });
}
// All writers already share adminTransaction's governance lock, including deletion.
export async function validateMediaReferences(client: PoolClient, values: (string | null | undefined)[]) {
  for (const value of new Set(values.filter((v): v is string => !!v))) {
    let path = value;
    try { path = new URL(value, "https://media.invalid").pathname; } catch { /* legacy URL validation belongs to the shared contracts */ }
    if (!path.startsWith("/api/v1/media/")) continue;
    const match = /^\/api\/v1\/media\/([0-9a-f-]{36})\.webp$/.exec(path);
    if (!match || !(await client.query("select 1 from media_assets where id::text=$1 and state='ready'", [match[1]])).rows.length)
      throw new ManagementError(409, "MEDIA_UNAVAILABLE", "Esta imagem foi excluída ou está indisponível. Selecione outra na biblioteca.");
  }
}
export async function uploadMedia(pool: Pool, storage: ImageStorage, actorId: string, hash: string, input: Buffer, contentType: string, filename: string) {
  const image = await processMedia(input, contentType);
  const id = randomUUID();
  const name = filename.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 160) || "Imagem";
  await adminTransaction(pool, actorId, hash, null, async client => {
    await client.query("insert into media_assets(id,name,width,height,bytes,created_by) values($1,$2,$3,$4,$5,$6)", [id, name, image.width, image.height, image.data.length, actorId]);
  });
  // A durable uploading row makes a failed upload/finalization eligible for cleanup.
  await storage.put(`${id}.webp`, image.data);
  return adminTransaction(pool, actorId, hash, null, async client => {
    const result = await client.query("update media_assets set state='ready' where id=$1 and state='uploading' returning *", [id]);
    if (!result.rows[0]) throw new ManagementError(409, "MEDIA_UNAVAILABLE", "Envie a imagem novamente.");
    const item = project(result.rows[0]);
    await audit(client, actorId, id, "media.created", "Envio de imagem", { after: item });
    return item;
  });
}
export async function deleteMedia(pool: Pool, actorId: string, hash: string, id: string) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select * from media_assets where id=$1 and state='ready' for update", [id])).rows[0];
    if (!row) throw new ManagementError(404, "NOT_FOUND", "Imagem não encontrada.");
    // Include drafts, paused games and trash. JSON text also catches absolute legacy URLs.
    const pattern = `%/api/v1/media/${id}.webp%`;
    const used = await client.query(`select 1 where exists(select 1 from games where image_url like $1 or seo::text like $1)
      or exists(select 1 from achievement_definitions where image_url like $1)
      or exists(select 1 from achievement_levels where image_url like $1)
      or exists(select 1 from pages where seo::text like $1)
      or exists(select 1 from seo_settings where data::text like $1)
      or exists(select 1 from navigation_menus where items::text like $1)`, [pattern]);
    if (used.rows.length) throw new ManagementError(409, "MEDIA_IN_USE", "Esta imagem está em uso. Remova ou substitua suas referências antes de excluir.");
    await client.query("update media_assets set state='deleted' where id=$1", [id]);
    await audit(client, actorId, id, "media.deleted", "Exclusão de imagem", { before: project(row) });
    return { ok: true as const };
  });
}
export async function cleanupMedia(pool: Pool, storage: ImageStorage, environment: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if ((await client.query("select environment from application_environment where id=1")).rows[0]?.environment !== environment) throw Error("Ambiente incompatível.");
    const rows = await client.query("select id from media_assets where state='deleted' or (state='uploading' and created_at < now()-interval '1 hour') order by created_at limit 20 for update skip locked");
    for (const { id } of rows.rows) {
      await storage.remove(`${id}.webp`);
      await client.query("delete from media_assets where id=$1", [id]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
