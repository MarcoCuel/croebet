import type { Pool, PoolClient } from "pg";
import { bonusWindowSettingsSchema, defaultBonusWindowSettings, type BonusWindowSettings } from "@croebet/shared";

export async function readBonusWindowSettings(client: Pick<Pool, "query"> | Pick<PoolClient, "query">): Promise<BonusWindowSettings> {
  const row = (await client.query("select data,version from bonus_window_settings where id=1")).rows[0];
  return row ? bonusWindowSettingsSchema.parse({ ...row.data, version: row.version }) : defaultBonusWindowSettings;
}
