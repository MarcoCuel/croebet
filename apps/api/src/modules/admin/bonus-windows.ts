import type { Pool } from "pg";
import { defaultBonusWindowSettings, type BonusWindowSettings } from "@croebet/shared";
import { adminTransaction, audit, ManagementError } from "./service.ts";

export async function saveBonusWindowSettings(pool: Pool, actorId: string, hash: string, input: BonusWindowSettings) {
  return adminTransaction(pool, actorId, hash, null, async client => {
    const row = (await client.query("select data,version from bonus_window_settings where id=1 for update")).rows[0];
    if ((row?.version ?? 0) !== input.version) throw new ManagementError(409, "VERSION_CONFLICT", "As configurações foram alteradas. Recarregue antes de salvar.");
    const next = { ...input, version: input.version + 1 };
    await client.query("insert into bonus_window_settings (id,data,version) values (1,$1,$2) on conflict (id) do update set data=excluded.data,version=excluded.version",
      [JSON.stringify(next), next.version]);
    await audit(client, actorId, actorId, "bonus_window.updated", "Horário bugado", { before: row?.data ?? defaultBonusWindowSettings, after: next });
    return next;
  });
}
