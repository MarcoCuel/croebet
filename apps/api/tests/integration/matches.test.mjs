import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createMatch, commandMatch, getMatch, listMatches } from "../../dist/modules/matches/service.js";
import { botAction } from "../../dist/modules/games/flip7/engine.js";

test("PostgreSQL: partidas persistidas, controle de acesso, retry concorrente, versão, rollback e abandono", async t => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("Configure TEST_DATABASE_URL para banco isolado, migrado e identificado como test.");
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const actors = [];
  t.after(async () => {
    try { await pool.query("delete from sessions where user_id=any($1::uuid[])",[actors]); await pool.query("delete from users where id=any($1::uuid[])",[actors]); }
    finally { await pool.end(); }
  });
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment,"test");
  for (let i=0;i<2;i++) actors.push((await pool.query("insert into users (username,display_name,password_hash) values ($1,$1,'test') returning id",[`Match_${randomBytes(6).toString('hex')}`])).rows[0].id);
  const sessionHash=randomBytes(32).toString("hex");
  await pool.query("insert into sessions (token_hash,user_id,expires_at,idle_expires_at) values ($1,$2,now()+interval '1 day',now()+interval '1 day')",[sessionHash,actors[0]]);
  const input={ requestId:randomUUID(),game:"flip7",setup:[{ name:"Ignored",kind:"human" },{ name:"Bot",kind:"normal" }],options:{ mode:"vengeance",brutal:true } };
  const created=await createMatch(pool,actors[0],sessionHash,input);
  assert.deepEqual(await createMatch(pool,actors[0],sessionHash,input),created);
  assert.equal((await listMatches(pool,actors[0])).items.length,1);
  assert.equal((await listMatches(pool,actors[1])).items.length,0);
  await assert.rejects(getMatch(pool,actors[1],created.match.code),{ code:"NOT_FOUND" });
  const row=(await pool.query("select state from game_matches where id=$1",[created.match.id])).rows[0];
  const command={ commandId:randomUUID(),expectedVersion:created.match.version,action:botAction(row.state) };
  const replies=await Promise.all([1,2].map(() => commandMatch(pool,actors[0],sessionHash,created.match.code,command)));
  assert.deepEqual(replies[0],replies[1]);
  assert.equal((await pool.query("select count(*)::int as n from game_match_commands where match_id=$1",[created.match.id])).rows[0].n,1);
  await assert.rejects(commandMatch(pool,actors[0],sessionHash,created.match.code,{ ...command,action:{ type:"bonus",target:null } }),{ code:"IDEMPOTENCY_CONFLICT" });
  await assert.rejects(commandMatch(pool,actors[0],sessionHash,created.match.code,{ ...command,commandId:randomUUID() }),{ code:"VERSION_CONFLICT" });
  const confirmed=await getMatch(pool,actors[0],created.match.code);
  assert.equal(JSON.stringify(confirmed).includes('"seed"'),false);
  assert.equal(JSON.stringify(confirmed).includes('"deck"'),false);
  const current=(await pool.query("select state from game_matches where id=$1",[created.match.id])).rows[0].state;
  const failingPool={ connect:async () => {
    const client=await pool.connect();
    return { query:(sql,args) => sql.startsWith("insert into game_match_events") ? Promise.reject(Error("event failure")) : client.query(sql,args), release:() => client.release() };
  } };
  await assert.rejects(commandMatch(failingPool,actors[0],sessionHash,created.match.code,{ commandId:randomUUID(),expectedVersion:confirmed.version,action:botAction(current) }),/event failure/);
  assert.deepEqual(await getMatch(pool,actors[0],created.match.code),confirmed);
  await pool.query("update users set status='suspended' where id=$1",[actors[0]]);
  await assert.rejects(commandMatch(pool,actors[0],sessionHash,created.match.code,{ commandId:randomUUID(),expectedVersion:confirmed.version },true),{ code:"UNAUTHENTICATED" });
  await pool.query("update users set status='active' where id=$1",[actors[0]]);
  const abandon={ commandId:randomUUID(),expectedVersion:confirmed.version };
  const abandoned=await commandMatch(pool,actors[0],sessionHash,created.match.code,abandon,true);
  assert.deepEqual(await commandMatch(pool,actors[0],sessionHash,created.match.code,abandon,true),abandoned);
  assert.equal((await listMatches(pool,actors[0])).items.length,0);
  await assert.rejects(getMatch(pool,actors[0],created.match.code),{ code:"NOT_FOUND" });
});
