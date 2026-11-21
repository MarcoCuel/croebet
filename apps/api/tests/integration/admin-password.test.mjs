import { tokenHash } from "../../dist/modules/auth/security.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "argon2";
import { createDatabase } from "../../dist/db/client.js";
import { changeUserPassword, readAudit } from "../../dist/modules/admin/service.js";
import { adminUserPasswordSchema } from "@croebet/shared";

test("senha administrativa: autorização, hash, revogação, conta preservada e auditoria sem segredos", async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error("Configure TEST_DATABASE_URL com banco exclusivo de test migrado.");
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [];
  t.after(async () => { try { await pool.query("delete from sessions where user_id=any($1::uuid[])", [ids]); await pool.query("delete from users where id=any($1::uuid[])", [ids]); } finally { await pool.end(); } });
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment, "test");
  const passwordHash = await hash("senha anterior de teste");
  async function account(role) {
    const username = `Password_${randomBytes(6).toString("hex")}`;
    const id = (await pool.query("insert into users(username,display_name,password_hash,role) values($1,$1,$2,$3) returning id", [username,passwordHash,role])).rows[0].id;
    ids.push(id);
    const sessionHash = tokenHash(randomUUID());
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [sessionHash,id]);
    return { id, sessionHash, username };
  }
  const admin = await account("admin"), user = await account("user");
  const input = adminUserPasswordSchema.parse({ newPassword: "nova senha de teste" });
  assert.equal(adminUserPasswordSchema.safeParse({ newPassword: "curta" }).success, false);
  assert.equal(adminUserPasswordSchema.safeParse({ newPassword: "a".repeat(129) }).success, false);
  await assert.rejects(changeUserPassword(pool,user.id,user.sessionHash,user.id,input), { code: "NOT_FOUND" });
  await assert.rejects(changeUserPassword(pool,admin.id,"sessao-invalida",user.id,input), { code: "NOT_FOUND" });
  assert.equal((await readAudit(pool,user.id)).items.length, 0);
  await changeUserPassword(pool,admin.id,admin.sessionHash,user.id,input);
  const saved = (await pool.query("select username,role,status,password_hash from users where id=$1",[user.id])).rows[0];
  assert.equal(saved.username, user.username); assert.equal(saved.role,"user"); assert.equal(saved.status,"active");
  assert.ok(saved.password_hash.startsWith("$argon2id$"));
  assert.equal(await verify(saved.password_hash,input.newPassword),true);
  assert.equal(await verify(saved.password_hash,"senha anterior de teste"),false);
  assert.equal((await pool.query("select 1 from sessions where user_id=$1",[user.id])).rows.length,0);
  const audit = (await readAudit(pool,user.id)).items;
  assert.equal(audit.length,1); assert.equal(audit[0].action,"user.password");
  assert.deepEqual(audit[0].details,{}); assert.equal(audit[0].reason,"");
  assert.equal(JSON.stringify(audit).includes(input.newPassword),false);
  assert.equal(JSON.stringify(audit).includes(saved.password_hash),false);
  await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",[tokenHash(randomUUID()),admin.id]);
  await changeUserPassword(pool,admin.id,admin.sessionHash,admin.id,input);
  assert.deepEqual((await pool.query("select token_hash from sessions where user_id=$1",[admin.id])).rows,[{token_hash:admin.sessionHash}]);
  // A missing audit table must roll back both password and session changes.
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("alter table admin_audit rename to admin_audit_password_test");
    const transactionPool = { connect: async () => ({ query: (sql,args) => client.query(sql === "begin" ? "savepoint password_write" : sql === "rollback" ? "rollback to savepoint password_write" : sql === "commit" ? "release savepoint password_write" : sql,args), release() {} }), query: (sql,args) => client.query(sql,args) };
    await assert.rejects(changeUserPassword(transactionPool,admin.id,admin.sessionHash,admin.id,{newPassword:"outra senha de teste"}), { code: "42P01" });
    assert.equal(await verify((await client.query("select password_hash from users where id=$1",[admin.id])).rows[0].password_hash,input.newPassword),true);
    assert.equal((await client.query("select 1 from sessions where token_hash=$1",[admin.sessionHash])).rows.length,1);
  } finally { await client.query("rollback"); client.release(); }
});
