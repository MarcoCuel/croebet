import { refundAccountMatches } from "../matches/economy.ts";
import type { Pool } from "pg";
import { governanceLock } from "../admin/service.ts";

// Persistent deadlines survive process restarts. Each batch commits atomically;
// all instances serialize with permission changes and match lifecycle writes.
export async function cleanupDeletedAccounts(pool: Pool, environment: "development" | "test" | "production") {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const identity = await client.query("select environment from application_environment where id=1");
    if (identity.rows[0]?.environment !== environment) throw new Error("Ambiente do banco incompatível.");
    await client.query(governanceLock);
    const pending = await client.query(`select id,avatar_key from users
      where status='suspended' and deletion_scheduled_at<=clock_timestamp()
      order by id limit 20 for update`);
    for (const user of pending.rows) {
      await client.query("delete from sessions where user_id=$1", [user.id]);
      if (user.avatar_key) await client.query("insert into avatar_cleanup (key) values ($1) on conflict do nothing", [user.avatar_key]);
      // Operational rooms may reference the account; archives have no user FK.
      await refundAccountMatches(client,user.id);
      await client.query("delete from game_matches where created_by=$1 or owner_id=$1 or id in (select match_id from game_match_players where user_id=$1)", [user.id]);
      await client.query(`insert into admin_audit (actor_id,target_id,action,reason,details)
        values ($1,$1,'user.deleted','','{}')`, [user.id]);
      await client.query("delete from users where id=$1", [user.id]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
