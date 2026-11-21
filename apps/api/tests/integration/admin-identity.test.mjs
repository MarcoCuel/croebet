import { tokenHash } from "../../dist/modules/auth/security.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { changeUserIdentity, readAdminUser, readAudit } from "../../dist/modules/admin/service.js";

test("PostgreSQL: edição administrativa de identidade preserva conta, unicidade, concorrência e auditoria", async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error("Configure TEST_DATABASE_URL para banco isolado, migrado e identificado como test.");
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [];
  t.after(async () => { try { await pool.query("delete from sessions where user_id=any($1::uuid[])", [ids]); await pool.query("delete from users where id=any($1::uuid[])", [ids]); } finally { await pool.end(); } });
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment, "test");
  async function account(role) {
    const username = `Identity_${randomBytes(6).toString("hex")}`;
    const id = (await pool.query("insert into users(username,display_name,password_hash,role) values($1,'Inicial','test',$2) returning id", [username,role])).rows[0].id;
    ids.push(id);
    const hash = tokenHash(randomUUID());
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash,id]);
    return {id,username,hash};
  }
  const admin = await account("admin"), user = await account("user"), duplicate = await account("user");
  const input = {displayName:"Nome corrigido",username:user.username,expectedUsername:user.username,expectedDisplayName:"Inicial"};
  await assert.rejects(changeUserIdentity(pool,user.id,user.hash,user.id,input),{code:"NOT_FOUND"});
  await changeUserIdentity(pool,admin.id,admin.hash,user.id,input);
  let saved = await readAdminUser(pool,user.id);
  assert.equal(saved.displayName,"Nome corrigido");assert.equal(saved.username,user.username);assert.equal(saved.role,"user");
  assert.equal((await pool.query("select username_changed_at from users where id=$1",[user.id])).rows[0].username_changed_at,null);
  await assert.rejects(changeUserIdentity(pool,admin.id,admin.hash,user.id,{...input,displayName:"Edição obsoleta"}),{code:"VERSION_CONFLICT"});
  const next = {...input,expectedDisplayName:saved.displayName,username:duplicate.username.toUpperCase()};
  await assert.rejects(changeUserIdentity(pool,admin.id,admin.hash,user.id,next),{code:"USERNAME_TAKEN"});
  assert.equal((await readAdminUser(pool,user.id)).username,user.username);
  assert.equal((await readAudit(pool,user.id)).items.length,1);
  next.username = `Edited_${randomBytes(6).toString("hex")}`;
  await changeUserIdentity(pool,admin.id,admin.hash,user.id,next);
  saved = await readAdminUser(pool,user.id);
  assert.equal(saved.id,user.id);assert.equal(saved.username,next.username);
  assert.ok((await pool.query("select username_changed_at from users where id=$1",[user.id])).rows[0].username_changed_at);
  const audit = await readAudit(pool,user.id);
  assert.equal(audit.items.length,2);assert.equal(audit.items[0].action,"user.identity");
  assert.equal(audit.items[0].details.before.username,user.username);
});
