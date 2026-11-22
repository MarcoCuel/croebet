import type { Pool } from "pg";
import { defaultTableVisualSettings, tableVisualPresetSchema, type TableVisualPreset } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "./service.ts";

export async function readTableVisualSettings(pool: Pool): Promise<TableVisualPreset> {
  const row = (await pool.query("select data,version from table_visual_settings where id=1")).rows[0];
  return tableVisualPresetSchema.parse({ settings: row?.data ?? defaultTableVisualSettings, version: row?.version ?? 0 });
}
export async function saveTableVisualSettings(pool: Pool, actorId: string, hash: string, input: TableVisualPreset) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select data,version from table_visual_settings where id=1 for update")).rows[0];
    if ((row?.version ?? 0) !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "A configuração foi alterada. Restaure a configuração antes de salvar novamente.");
    const next = { settings: input.settings, version: input.version + 1 };
    await client.query("insert into table_visual_settings (id,data,version) values (1,$1,$2) on conflict (id) do update set data=excluded.data,version=excluded.version", [JSON.stringify(next.settings), next.version]);
    await audit(client, actorId, actorId, "table.visual.updated", "Configuração global dos jogos 3D", { before: row?.data ?? defaultTableVisualSettings, after: next.settings });
    return next;
  });
}
