import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { guardMatches } from '../production.mjs';

test('PostgreSQL de test: partida ativa impede parada e lock bloqueia início concorrente', async () => {
  const url=process.env.TEST_DATABASE_URL;
  assert.ok(url,'Defina TEST_DATABASE_URL para banco exclusivo de test.');
  const first=new pg.Client({connectionString:url}),second=new pg.Client({connectionString:url});
  await first.connect();await second.connect();
  try {
    assert.equal((await first.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
    await first.query('begin');
    const user=(await first.query("insert into users(username,display_name,password_hash) values($1,'Teste operacional','test') returning id",['Ops_'+randomUUID().slice(0,8)])).rows[0].id;
    await first.query("insert into game_matches(code,game_id,game_slug,created_by,owner_id,capacity,options,rules_version,version,status,state,creation_request_id,creation_hash,creation_response) select $1,id,'flip7',$2,$2,2,'{}',1,1,'playing','{}',$3,'test','{}' from games where slug='flip7'",[randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),user,randomUUID()]);
    await assert.rejects(guardMatches(first),/partida.*recusada/);
    assert.equal((await first.query("select count(*)::int as count from game_matches where status='playing'")).rows[0].count,1);
    await first.query('rollback');await first.query('select pg_advisory_unlock(47851234)');
    await guardMatches(first);
    await second.query('begin');
    assert.equal((await second.query('select pg_try_advisory_xact_lock(47851234) as locked')).rows[0].locked,false);
    await first.query('select pg_advisory_unlock(47851234)');
    assert.equal((await second.query('select pg_try_advisory_xact_lock(47851234) as locked')).rows[0].locked,true);
    await second.query('rollback');
  } finally {await first.query('rollback');await first.query('select pg_advisory_unlock_all()');await second.query('rollback');await first.end();await second.end();}
});
