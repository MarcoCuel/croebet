import type { Pool } from "pg";
import type { AvatarStorage } from "./storage.ts";

// Durable retries also remove staged uploads left behind by a failed request/restart.
export async function cleanupAvatars(pool: Pool, storage: AvatarStorage, environment: "development" | "test" | "production") {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const identity = await client.query("select environment from application_environment where id = 1");
    if (identity.rows[0]?.environment !== environment) throw new Error("Ambiente do banco incompatível.");
    const pending = await client.query("select key from avatar_cleanup where delete_after <= now() order by delete_after limit 20 for update skip locked");
    for (const { key } of pending.rows as { key: string }[]) {
      const used = await client.query("select 1 from users where avatar_key = $1", [key]);
      if (!used.rows.length) await storage.remove(key);
      await client.query("delete from avatar_cleanup where key = $1", [key]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
