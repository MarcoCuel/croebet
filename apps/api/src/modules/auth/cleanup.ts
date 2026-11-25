import type { Pool } from "pg";

const RATE_LIMIT_RETENTION_HOURS = 24;

/** Removes expired sessions and stale hourly auth limits without touching active rows. */
export async function cleanupAuthState(pool: Pool, environment: "development" | "test" | "production") {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const identity = await client.query("select environment from application_environment where id=1");
    if (identity.rows[0]?.environment !== environment) throw new Error("Ambiente do banco incompatível.");
    const sessions = await client.query("delete from sessions where expires_at<=clock_timestamp() or idle_expires_at<=clock_timestamp()");
    const limits = await client.query(`delete from auth_rate_limits where window_start<date_trunc('hour',clock_timestamp())-($1::int * interval '1 hour')`, [RATE_LIMIT_RETENTION_HOURS]);
    await client.query("commit");
    return { sessions: sessions.rowCount ?? 0, limits: limits.rowCount ?? 0 };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
