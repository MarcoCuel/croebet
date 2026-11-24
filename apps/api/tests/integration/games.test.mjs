import { tokenHash } from "../../dist/modules/auth/security.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { deleteGame, createGame, readGames, readGame, saveGame } from '../../dist/modules/games/service.js';
import { readAudit } from '../../dist/modules/admin/service.js';
import { gameCreateSchema } from '@croebet/shared';

test('PostgreSQL: cadastro de jogo preserva catálogo, valida unicidade, permissões e auditoria', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco isolado, migrado e identificado como test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  const ids = [], games = [];
  let verified = false;
  t.after(async () => {
    try {
      if (!verified) return;
      await pool.query('delete from game_matches where game_id=any($1::uuid[])', [games]);
      await pool.query('delete from games where id=any($1::uuid[])', [games]);
      await pool.query('delete from sessions where user_id=any($1::uuid[])', [ids]);
      await pool.query('delete from users where id=any($1::uuid[])', [ids]);
    } finally { await pool.end(); }
  });
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  verified = true;
  async function account(role) {
    const name = `Game_${randomUUID().replaceAll('-', '').slice(0,12)}`;
    const id = (await pool.query('insert into users(username,display_name,password_hash,role) values($1,$1,$1,$2) returning id', [name,role])).rows[0].id;
    ids.push(id);
    const hash = tokenHash(randomUUID());
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash,id]);
    return {id,hash};
  }
  const admin = await account('admin'), user = await account('user');
  const original = await readGame(pool, 'flip7', false);
  const input = gameCreateSchema.parse({slug:`teste-${randomUUID()}`,name:'Novo jogo',description:'Em desenvolvimento.',enabled:true,imageUrl:null});
  await assert.rejects(createGame(pool,user.id,user.hash,input), {code:'NOT_FOUND'});
  await assert.rejects(createGame(pool,admin.id,'revoked',input), {code:'NOT_FOUND'});
  const game = await createGame(pool,admin.id,admin.hash,input);
  games.push(game.id);
  assert.equal(game.version,1);
  assert.equal((await readGame(pool,input.slug)).id,game.id);
  assert.deepEqual(await readGame(pool,'flip7'),original);
  await assert.rejects(createGame(pool,admin.id,admin.hash,input), {code:'23505'});
  const audit = await readAudit(pool,game.id);
  assert.equal(audit.items.length,1);
  assert.equal(audit.items[0].action,'game.created');
  assert.equal(audit.items[0].details.after.slug,input.slug);
  await saveGame(pool,admin.id,admin.hash,game.id,{name:game.name,description:game.description,seo:game.seo,imageUrl:game.imageUrl,version:game.version,enabled:false});
  await assert.rejects(readGame(pool,input.slug),{code:'NOT_FOUND'});
  assert.equal((await readGame(pool,game.id,true)).enabled,false);
  const current = await readGame(pool,game.id,true);
  const renamed = await saveGame(pool,admin.id,admin.hash,game.id,{...input,slug:input.slug+'-novo',version:current.version});
  assert.equal(renamed.moduleId,game.moduleId);
  await assert.rejects(readGame(pool,input.slug),{code:'NOT_FOUND'});
  await assert.rejects(saveGame(pool,admin.id,admin.hash,game.id,{...input,slug:'flip7',version:renamed.version}),{code:'CONFLICT'});
  await assert.rejects(deleteGame(pool,user.id,user.hash,game.id,{version:renamed.version}),{code:'NOT_FOUND'});
  await assert.rejects(deleteGame(pool,admin.id,'revoked',game.id,{version:renamed.version}),{code:'NOT_FOUND'});
  await assert.rejects(deleteGame(pool,admin.id,admin.hash,game.id,{version:1}),{code:'VERSION_CONFLICT'});
  const matchId=randomUUID();
  await pool.query(`insert into game_matches(id,code,game_id,game_slug,created_by,owner_id,capacity,options,rules_version,version,status,creation_request_id,creation_hash,creation_response)
    values($1,$4::text,$2,'flip7',$3,$3,2,'{}',1,1,'lobby',$1,'test','{}')`,[matchId,game.id,admin.id,matchId]);
  await assert.rejects(deleteGame(pool,admin.id,admin.hash,game.id,{version:renamed.version}),{code:'GAME_IN_USE'});
  await pool.query("update game_matches set status='playing' where id=$1",[matchId]);
  await assert.rejects(deleteGame(pool,admin.id,admin.hash,game.id,{version:renamed.version}),{code:'GAME_IN_USE'});
  await pool.query("update game_matches set status='abandoned' where id=$1",[matchId]);
  const preserved=(await pool.query('select * from game_matches where id=$1',[matchId])).rows[0];
  await deleteGame(pool,admin.id,admin.hash,game.id,{version:renamed.version});
  assert.deepEqual((await pool.query('select * from game_matches where id=$1',[matchId])).rows[0],preserved);
  assert.equal((await readGames(pool,true)).items.some(item=>item.id===game.id),false);
  assert.equal((await pool.query('select deleted_at is not null as deleted from games where id=$1',[game.id])).rows[0].deleted,true);
  assert.equal((await readAudit(pool,game.id)).items[0].action,'game.deleted');
});

test('PostgreSQL: duração do hero prioriza oficiais, testes e fallback sem duplicar partidas', async t => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL com banco exclusivo de test.');
  const { pool } = createDatabase(process.env.TEST_DATABASE_URL);
  t.after(() => pool.end());
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const gameId = randomUUID();
    const slug = 'duration-' + gameId;
    await client.query("insert into games(id,slug,name,fallback_duration_minutes) values($1,$2,'Duração',25)", [gameId,slug]);
    const duration = async () => (await readGame(client,slug)).averageDurationSeconds;
    assert.equal(await duration(),1500);
    await client.query('update games set fallback_duration_minutes=null where id=$1',[gameId]);
    assert.equal(await duration(),null);
    await client.query('update games set fallback_duration_minutes=25 where id=$1',[gameId]);
    async function archive(table, seconds, status='finished', onlyBots=false, playback=0) {
      const id=randomUUID();
      const columns=table==='game_test_archives'?',owner_id,only_bots,recorded_at,playback_milliseconds':'';
      const extra=table==='game_test_archives'?', $1, $5, now(), $6':'';
      await client.query(`insert into ${table}(id,game_id,code,rules_version,status,options,participants,state,started_at,ended_at${columns})
        values($1,$2,${table==='game_test_archives'?'$7::text':'$5::text'},1,$3,'{}','[]','{}',now()-($4 * interval '1 second'),now()${extra})`,
        table==='game_test_archives'?[id,gameId,status,seconds,onlyBots,playback,id]:[id,gameId,status,seconds,id]);
    }
    await archive('game_test_archives',600,'abandoned');
    assert.equal(await duration(),1500);
    await archive('game_test_archives',0);
    assert.equal(await duration(),1500);
    await archive('game_test_archives',600);
    assert.equal(await duration(),600);
    await archive('game_test_archives',1,'finished',true,1200000);
    assert.equal(await duration(),900);
    await archive('game_match_archives',1200);
    assert.equal(await duration(),1200);
    await archive('game_match_archives',2400);
    assert.equal(await duration(),1800);
    await archive('game_match_archives',6000,'abandoned');
    assert.equal(await duration(),1800);
  } finally {
    await client.query('rollback');
    client.release();
  }
});
