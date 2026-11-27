import type { Pool } from "pg";

// Both profile changes and postponement revalidate the session under lock.
export async function updateOwnProfile(pool: Pool, sessionHash: string, change: { kind: "name"; displayName: string } | { kind: "defer" }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const locked = await client.query(`select u.* from users u join sessions s on s.user_id = u.id
      where s.token_hash = $1 and u.status = 'active' and s.expires_at > clock_timestamp()
      and s.idle_expires_at > clock_timestamp() for update of u, s`, [sessionHash]);
    if (!locked.rows[0]) { await client.query("rollback"); return null; }
    const result = change.kind === "name"
      ? await client.query("update users set display_name = $1, profile_name_provided = true where id = $2 returning *", [change.displayName, locked.rows[0].id])
      : await client.query("update users set onboarding_remind_at = clock_timestamp() + interval '48 hours' where id = $1 returning *", [locked.rows[0].id]);
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}
