import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { scheduleUserDeletion, changeUser, readAdminUser, readAudit } from "../../dist/modules/admin/service.js";
import { cleanupDeletedAccounts } from "../../dist/modules/auth/account-cleanup.js";
import { grantInitialBalance } from "../../dist/modules/economy/service.js";
import { createMatch, lobbyAction } from "../../dist/modules/matches/service.js";

test("PostgreSQL: exclusão em 30 dias, cancelamento e preservação dos históricos", async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error("Configure TEST_DATABASE_URL para banco isolado, migrado e identificado como test.");
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  try { assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment, "test"); }
  catch (error) { await pool.end(); throw error; }
  const ids = [];
  let matchId;
  t.after(async () => {
    try {
      await pool.query("delete from game_matches where created_by=any($1::uuid[])", [ids]);
      await pool.query("delete from sessions where user_id=any($1::uuid[])", [ids]);
      await pool.query("delete from users where id=any($1::uuid[])", [ids]);
      if (matchId) {
        await pool.query("delete from game_match_archive_frames where match_id=$1", [matchId]);
        await pool.query("delete from game_match_archives where id=$1", [matchId]);
      }
    } finally { await pool.end(); }
  });
  async function account(role) {
    const username = `Delete_${randomBytes(6).toString("hex")}`;
    const id = (await pool.query("insert into users(username,display_name,password_hash,role) values($1,$1,'test',$2) returning id", [username, role])).rows[0].id;
    ids.push(id);
    const hash = randomUUID();
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash, id]);
    const client = await pool.connect();
    try { await client.query("begin"); await grantInitialBalance(client, id); await client.query("commit"); }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
    return { id, hash };
  }
  const admin = await account("admin"), user = await account("user"), other = await account("user");
  await assert.rejects(scheduleUserDeletion(pool, user.id, user.hash, admin.id), { code: "NOT_FOUND" });
  await assert.rejects(scheduleUserDeletion(pool, admin.id, admin.hash, admin.id), { code: "LAST_ADMIN" });
  const room = await createMatch(pool, user.id, user.hash, { requestId: randomUUID(), game: "flip7", capacity: 2, options: { mode: "classic", brutal: false } });
  matchId = room.id;
  const joined = await lobbyAction(pool, other.id, other.hash, room.code, "join", { commandId: randomUUID() });
  for (const actor of [user, other]) await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')", [randomUUID(), room.id, actor.id]);
  await lobbyAction(pool, user.id, user.hash, room.code, "start", { commandId: randomUUID(), expectedVersion: joined.version });
  const frames = (await pool.query("select * from game_match_archive_frames where match_id=$1 order by version", [room.id])).rows;
  assert.ok(frames.length);
  const wallet = (await pool.query("select id,balance from wallet_accounts where user_id=$1", [user.id])).rows[0];
  const entries = (await pool.query("select * from wallet_entries where account_id=$1 order by id", [wallet.id])).rows;
  await Promise.all([1, 2].map(() => scheduleUserDeletion(pool, admin.id, admin.hash, user.id)));
  const saved = await readAdminUser(pool, user.id);
  assert.equal(saved.status, "suspended");
  assert.ok(Math.abs(Date.parse(saved.deletionScheduledAt) - Date.now() - 30 * 86400000) < 10000);
  assert.equal((await pool.query("select 1 from sessions where user_id=$1", [user.id])).rowCount, 0);
  assert.equal((await readAudit(pool, user.id)).items.filter(a => a.action === "user.deletion_scheduled").length, 1);
  await cleanupDeletedAccounts(pool, "test");
  assert.ok(await readAdminUser(pool, user.id));
  await changeUser(pool, admin.id, admin.hash, user.id, { expectedRole: "user", role: "user", expectedStatus: "suspended", status: "active", reason: "" });
  assert.equal((await readAdminUser(pool, user.id)).deletionScheduledAt, null);
  await scheduleUserDeletion(pool, admin.id, admin.hash, user.id);
  await changeUser(pool, admin.id, admin.hash, other.id, { expectedRole: "user", role: "user", expectedStatus: "active", status: "suspended", reason: "" });
  await pool.query("update users set deletion_scheduled_at=clock_timestamp()-interval '1 second' where id=$1", [user.id]);
  await assert.rejects(cleanupDeletedAccounts(pool, "production"), /Ambiente/);
  assert.ok(await readAdminUser(pool, user.id));
  await Promise.all([cleanupDeletedAccounts(pool, "test"), cleanupDeletedAccounts(pool, "test")]);
  await assert.rejects(readAdminUser(pool, user.id), { code: "NOT_FOUND" });
  assert.equal((await readAdminUser(pool, other.id)).status, "suspended");
  const detached = (await pool.query("select user_id,balance from wallet_accounts where id=$1", [wallet.id])).rows[0];
  assert.equal(detached.user_id, null); assert.equal(detached.balance, wallet.balance);
  assert.deepEqual((await pool.query("select * from wallet_entries where account_id=$1 order by id", [wallet.id])).rows, entries);
  assert.deepEqual((await pool.query("select * from game_match_archive_frames where match_id=$1 order by version", [room.id])).rows, frames);
  assert.equal((await pool.query("select status from game_match_archives where id=$1", [room.id])).rows[0].status, "abandoned");
  assert.equal((await readAudit(pool, user.id)).items.filter(a => a.action === "user.deleted").length, 1);
});
