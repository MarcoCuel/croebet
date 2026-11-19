import type { Pool } from "pg";
import type { z } from "zod";
import { sitePageSchema, pagesSchema, pageLinksSchema, type pageWriteSchema } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

function project(row: Record<string, unknown>) {
  return sitePageSchema.parse({ id: row.id, slug: row.slug, title: row.title, document: row.document,
    published: row.published, showInMenu: row.show_in_menu, version: row.version });
}
export async function readPageLinks(pool: Pool) {
  const result = await pool.query("select slug,title,show_in_menu from pages where published=true order by slug");
  return pageLinksSchema.parse({ items: result.rows.map(row => ({ slug: row.slug, title: row.title, showInMenu: row.show_in_menu })) });
}
export async function readPages(pool: Pool) {
  const result = await pool.query("select * from pages order by slug");
  return pagesSchema.parse({ items: result.rows.map(project) });
}
export async function readPage(pool: Pool, slug: string, admin = false) {
  const result = await pool.query(`select * from pages where slug=$1 ${admin ? "" : "and published=true"}`, [slug]);
  if (!result.rows[0]) throw new ManagementError(404, "NOT_FOUND", "Página não encontrada.");
  return project(result.rows[0]);
}
export async function savePage(pool: Pool, actorId: string, hash: string, slug: string | null, input: z.infer<typeof pageWriteSchema>) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const before = slug ? (await client.query("select * from pages where slug=$1 for update", [slug])).rows[0] : null;
    if (slug && !before) throw new ManagementError(404, "NOT_FOUND", "Página não encontrada.");
    if (input.version !== (before?.version ?? 0)) throw new ManagementError(409, "VERSION_CONFLICT", "A página foi alterada. Recarregue antes de salvar.");
    const params = [input.slug, input.title, JSON.stringify(input.document), input.published, input.showInMenu];
    const result = before
      ? await client.query("update pages set slug=$1,title=$2,document=$3,published=$4,show_in_menu=$5,version=version+1 where id=$6 returning *", [...params, before.id])
      : await client.query("insert into pages (slug,title,document,published,show_in_menu) values ($1,$2,$3,$4,$5) returning *", params);
    const page = project(result.rows[0]);
    await audit(client, actorId, page.id, before ? "page.updated" : "page.created", "Edição de página", {
      before: before ? project(before) : null, after: page,
    });
    return page;
  });
}
