import type { Pool } from "pg";
import type { z } from "zod";
import { sitePageSchema, pagesSchema, pageLinksSchema, pageAuthorsSchema, type pageWriteSchema, type PageStatus } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

// Evaluate at read time: schedules become public even after downtime, without a timer or worker.
export const pagePublicCondition = "(status='published' or (status='scheduled' and publish_at <= clock_timestamp()))";
function project(row: Record<string, unknown>) {
  const publishAt = (row.publish_at as Date | null)?.toISOString() ?? null;
  const status = row.status === "scheduled" && publishAt && Date.parse(publishAt) <= Date.now() ? "published" : row.status ?? (row.published ? "published" : "draft");
  return sitePageSchema.parse({ id: row.id, slug: row.slug, title: row.title, document: row.document,
    seo: row.seo, published: status === "published", status, publishAt, authorId: row.author_id ?? null, authorName: row.author_name ?? null,
    showInMenu: row.show_in_menu, version: row.version,
    createdAt: (row.created_at as Date | null)?.toISOString() ?? null,
    updatedAt: (row.updated_at as Date | null)?.toISOString() ?? null,
    publishedAt: row.status === "scheduled" && status === "published" ? publishAt : (row.published_at as Date | null)?.toISOString() ?? null,
    lastEditedBy: row.last_edited_by ?? null });
}
export async function readPageAuthors(pool: Pool) {
  const result = await pool.query("select id,username,display_name from users where role='admin' and status='active' order by display_name,id");
  return pageAuthorsSchema.parse({ items: result.rows.map(row => ({ id: row.id, username: row.username, displayName: row.display_name })) });
}
export async function readPageLinks(pool: Pool) {
  const result = await pool.query(`select slug,title,show_in_menu from pages where ${pagePublicCondition} order by slug`);
  return pageLinksSchema.parse({ items: result.rows.map(row => ({ slug: row.slug, title: row.title, showInMenu: row.show_in_menu })) });
}
export async function readPages(pool: Pool) {
  const result = await pool.query("select * from pages order by slug");
  return pagesSchema.parse({ items: result.rows.map(project) });
}
export async function readPage(pool: Pool, identifier: string, admin = false) {
  const result = await pool.query(`select * from pages where ${admin ? "id" : "slug"}=$1 ${admin ? "" : `and ${pagePublicCondition}`}`, [identifier]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Página não encontrada.");
  return project(result.rows[0]);
}
export async function savePage(pool: Pool, actorId: string, hash: string, id: string | null, input: z.infer<typeof pageWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = id ? (await client.query("select * from pages where id=$1 for update", [id])).rows[0] : null;
    if (id && !before) throw new ManagementError(404, "NOT_FOUND", "Página não encontrada.");
    if (input.version !== (before?.version ?? 0)) throw new ManagementError(409, "VERSION_CONFLICT", "A página foi alterada. Recarregue antes de salvar.");
    const now = new Date();
    const publishAt = input.publishAt === undefined ? before?.publish_at ?? null : input.publishAt ? new Date(input.publishAt) : null;
    let status: PageStatus = input.status ?? (input.published ? "published" : "draft");
    if (status === "scheduled" && (!publishAt || publishAt.getTime() <= now.getTime())) {
      if (publishAt && before?.status === "scheduled" && before.publish_at?.getTime() === publishAt.getTime()) status = "published";
      else throw new ManagementError(400, "INVALID_SCHEDULE", "Escolha uma data futura para agendar a publicação.");
    }
    if (status === "published" && publishAt && publishAt.getTime() > now.getTime()) status = "scheduled";
    const authorId = input.authorId ?? before?.author_id ?? actorId;
    const author = (await client.query("select id,username,display_name,role,status from users where id=$1", [authorId])).rows[0];
    if (!author || (authorId !== before?.author_id && (author.role !== "admin" || author.status !== "active"))) throw new ManagementError(400, "INVALID_AUTHOR", "Escolha um administrador ativo como autor.");
    const actor = authorId === actorId ? author : (await client.query("select username from users where id=$1", [actorId])).rows[0];
    const previouslyPublished = before ? project(before).published : false;
    const publishedAt = status === "published" ? (publishAt ?? (previouslyPublished ? project(before!).publishedAt : null) ?? now) : before ? project(before).publishedAt : null;
    const params = [input.slug, input.title, JSON.stringify(input.document), status === "published", input.showInMenu, actor.username, status, publishAt, authorId, author.display_name, publishedAt];
    const result = before
      ? await client.query("update pages set slug=$1,title=$2,document=$3,published=$4,show_in_menu=$5,last_edited_by=$6,status=$7,publish_at=$8,author_id=$9,author_name=$10,published_at=$11,updated_at=clock_timestamp(),version=version+1 where id=$12 returning *", [...params, before.id])
      : await client.query("insert into pages (slug,title,document,published,show_in_menu,last_edited_by,status,publish_at,author_id,author_name,published_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp(),clock_timestamp()) returning *", params);
    await client.query("update pages set seo=$1 where id=$2", [JSON.stringify(input.seo ?? {}), result.rows[0].id]);
    const page = project({ ...result.rows[0], seo: input.seo });
    await audit(client, actorId, page.id, before ? "page.updated" : "page.created", "Edição de página", { before: before ? project(before) : null, after: page });
    return page;
  });
}
export async function deletePage(pool: Pool, actorId: string, hash: string, id: string, version: number) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = (await client.query("select * from pages where id=$1 for update", [id])).rows[0];
    if (!before) throw new ManagementError(404, "NOT_FOUND", "Página não encontrada.");
    if (before.version !== version) throw new ManagementError(409, "VERSION_CONFLICT", "A página foi alterada. Recarregue antes de excluir.");
    await client.query("delete from pages where id=$1", [before.id]);
    await audit(client, actorId, before.id, "page.deleted", "Exclusão de página", { before: project(before) });
    return { ok: true as const };
  });
}
