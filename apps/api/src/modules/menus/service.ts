import type { Pool } from "pg";
import type { z } from "zod";
import { lucideIconNodes } from "@croebet/shared/lucide-icon-nodes";
import { fixedMenuPages, menuSchema, menuAdminSchema, navigationSchema, type MenuRecord, type MenuItem, type MenuLocation, type NavigationData, type menuWriteSchema } from "@croebet/shared";
import { pagePublicCondition } from "../pages/service.ts";
import { adminTransaction, audit, ManagementError } from "../admin/service.ts";

function records(rows: Record<string, unknown>[]) {
  const menus = rows.map(row => menuSchema.parse(row));
  if (menus.length !== 2 || new Set(menus.map(menu => menu.location)).size !== 2) throw new Error("Menus indisponíveis.");
  return menus;
}
export function resolveMenu(items: MenuItem[], pages: { id: string; slug: string; published: boolean }[]): NavigationData["main"] {
  return items.flatMap<NavigationData["main"][number]>(item => {
    const icon = item.icon ? { icon: item.icon, iconNode: lucideIconNodes[item.icon] } : {};
    if (item.type === "page") {
      const page = pages.find(page => page.id === item.pageId && page.published);
      return page ? [{ id: item.id, label: item.label, href: `/${page.slug}`, newTab: item.newTab, fixed: null, disabled: false, ...icon }] : [];
    }
    const fixed = item.type === "fixed" ? item.target : null;
    return [{ id: item.id, label: item.label, href: item.type === "custom" ? item.url : fixedMenuPages[item.target].href,
      newTab: item.newTab, fixed, disabled: fixed ? fixedMenuPages[fixed].disabled : false, ...icon }];
  });
}
export async function readNavigation(pool: Pool) {
  const [menus, pages] = await Promise.all([
    pool.query("select location,items,version from navigation_menus order by location"),
    pool.query(`select id,slug,true as published from pages where ${pagePublicCondition}`),
  ]);
  return navigationSchema.parse(Object.fromEntries(records(menus.rows).map(menu => [menu.location, resolveMenu(menu.items, pages.rows)])));
}
export async function readMenus(pool: Pool) {
  const [menus, pages] = await Promise.all([
    pool.query("select location,items,version from navigation_menus order by location"),
    pool.query(`select id,slug,title,${pagePublicCondition} as published from pages order by title,id`),
  ]);
  return menuAdminSchema.parse({ menus: records(menus.rows), pages: pages.rows });
}
export async function saveMenu(pool: Pool, actorId: string, hash: string, location: MenuLocation, input: z.infer<typeof menuWriteSchema>): Promise<MenuRecord> {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select location,items,version from navigation_menus where location=$1 for update", [location])).rows[0];
    if (!row) throw new ManagementError(503, "UNAVAILABLE", "Menu indisponível.");
    const before = menuSchema.parse(row);
    if (before.version !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "Este menu foi alterado. Recarregue antes de salvar.");
    const ids = [...new Set(input.items.filter(item => item.type === "page").map(item => item.pageId))];
    if (ids.length) {
      const pages = await client.query("select id from pages where id=any($1::uuid[]) order by id for share", [ids]);
      if (pages.rows.length !== ids.length) throw new ManagementError(409, "PAGE_NOT_FOUND", "Uma das páginas foi removida. Recarregue o menu.");
    }
    const after = menuSchema.parse((await client.query("update navigation_menus set items=$1,version=version+1 where location=$2 returning location,items,version", [JSON.stringify(input.items), location])).rows[0]);
    // Audit uses resource UUIDs; stable IDs identify the two navigation locations.
    const resourceId = location === "main" ? "00000000-0000-4000-8000-000000000010" : "00000000-0000-4000-8000-000000000011";
    await audit(client, actorId, resourceId, "menu.updated", "Edição de menu", { before, after });
    return after;
  });
}
