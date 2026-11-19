import type { Pool } from "pg";
import { defaultSeoSettings, seoSettingsSchema, type SeoSettings } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "./service.ts";
export async function readSeo(pool: Pool): Promise<SeoSettings> {
  const row = (await pool.query("select data,version from seo_settings where id=1")).rows[0];
  return row ? seoSettingsSchema.parse({ ...row.data, version: row.version }) : defaultSeoSettings;
}
export async function saveSeo(pool: Pool, actorId: string, hash: string, input: SeoSettings) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select data,version from seo_settings where id=1 for update")).rows[0];
    if ((row?.version ?? 0) !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "As configurações foram alteradas. Recarregue antes de salvar.");
    const next = { ...input, version: input.version + 1 };
    await client.query("insert into seo_settings (id,data,version) values (1,$1,$2) on conflict (id) do update set data=excluded.data,version=excluded.version", [JSON.stringify(next), next.version]);
    await audit(client, actorId, actorId, "seo.updated", "Configurações de SEO", { before: row?.data ?? defaultSeoSettings, after: next });
    return next;
  });
}
