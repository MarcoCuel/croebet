import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../../apps/api/package.json', import.meta.url))('sharp');
import { facts, verifyImages } from '../production.mjs';
import { grantInitialBalance } from '../../apps/api/dist/modules/economy/service.js';
import { createMatch, lobbyAction, commandMatch } from '../../apps/api/dist/modules/matches/service.js';
import { tokenHash } from '../../apps/api/dist/modules/auth/security.js';

const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function docker(args, stdio = ['ignore', 'pipe', 'pipe']) {
  const result = spawnSync('docker', args, { stdio, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, `Docker de test falhou: ${result.error?.message ?? result.stderr ?? ''}`);
  return result.stdout;
}
async function contents(pool) {
  const result = {};
  const tables = (await pool.query("select schemaname,tablename from pg_tables where schemaname in ('public','drizzle') order by 1,2")).rows;
  for (const { schemaname, tablename } of tables) {
    const table = [schemaname, tablename].map(name => '"' + name.replaceAll('"', '""') + '"').join('.');
    result[table] = (await pool.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table} t`)).rows[0].rows;
  }
  return result;
}

test('recuperação: dump e imagens sintéticas preservam contas, saldos, ledger e replay em destino vazio', async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  const container = process.env.TEST_RECOVERY_CONTAINER;
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /test$/);
  assert.match(container ?? '', /^croebet-[a-z0-9-]*test[a-z0-9-]*$/);
  const pool = new pg.Pool({ connectionString: url.href });
  t.after(() => pool.end());
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment, 'test');
  const source = url.pathname.slice(1), user = decodeURIComponent(url.username);
  // Verify the explicitly selected container points to this synthetic database.
  assert.equal(docker(['exec', container, 'psql', '-U', user, '-d', source, '-Atc', 'select environment from application_environment where id=1']).trim(), 'test');
  const root = mkdtempSync(join(tmpdir(), 'croebet-recovery-test-'));
  const images = join(root, 'source-images'), backup = join(root, 'backup'), restoredImages = join(root, 'restored-images');
  for (const path of [images, backup, join(images, 'avatars'), join(images, 'media')]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const accounts = [];
  for (let seat = 0; seat < 2; seat++) {
    const id = randomUUID(), hash = tokenHash(randomUUID());
    await pool.query("insert into users(id,username,display_name,password_hash) values($1,$2,'Recuperação sintética','test')", [id, `Restore_${id.replaceAll('-', '').slice(0,12)}`]);
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')", [hash,id]);
    const client = await pool.connect();
    try { await client.query('begin'); await grantInitialBalance(client,id); await client.query('commit'); }
    catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
    accounts.push({id,hash});
  }
  const [host, peer] = accounts;
  const room = await createMatch(pool,host.id,host.hash,{requestId:randomUUID(),game:'flip7',capacity:2,entryAmount:5,options:{mode:'classic',brutal:false}});
  const joined = await lobbyAction(pool,peer.id,peer.hash,room.code,'join',{commandId:randomUUID()});
  for (const actor of accounts) await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')", [randomUUID(),room.id,actor.id]);
  const started = await lobbyAction(pool,host.id,host.hash,room.code,'start',{commandId:randomUUID(),expectedVersion:joined.version});
  const left = await commandMatch(pool,host.id,host.hash,room.code,{commandId:randomUUID(),expectedVersion:started.version},true);
  await commandMatch(pool,peer.id,peer.hash,room.code,{commandId:randomUUID(),expectedVersion:left.match.version},true);
  const image = await sharp({create:{width:32,height:32,channels:3,background:'purple'}}).webp().toBuffer();
  const media = randomUUID();
  writeFileSync(join(images,'avatars',host.id+'.webp'),image,{mode:0o600});
  writeFileSync(join(images,'media',media+'.webp'),image,{mode:0o600});
  await pool.query('update users set avatar_key=$1 where id=$2',[host.id+'.webp',host.id]);
  await pool.query("insert into media_assets(id,name,width,height,bytes,state,created_by) values($1,'Imagem sintética',32,32,$2,'ready',$3)",[media,image.length,host.id]);
  await verifyImages(pool,images);
  const before = await contents(pool), protectedFacts = await facts(pool);
  const dump = join(backup,'database.dump'), fd = openSync(dump,'wx',0o600);
  try { docker(['exec',container,'pg_dump','-U',user,'-d',source,'--format=custom','--no-owner','--no-acl'],['ignore',fd,'pipe']); } finally { closeSync(fd); }
  cpSync(images,join(backup,'images'),{recursive:true});
  writeFileSync(join(backup,'manifest.json'),JSON.stringify({facts:protectedFacts,databaseSHA256:digest(dump)}),{mode:0o600});
  const target = 'croebet_restore_'+randomUUID().replaceAll('-','')+'_test';
  docker(['exec',container,'createdb','-U',user,target]);
  const input = openSync(dump,'r');
  try { docker(['exec','-i',container,'pg_restore','-U',user,'-d',target,'--no-owner','--no-acl','--exit-on-error'],[input,'pipe','pipe']); } finally { closeSync(input); }
  url.pathname = '/'+target;
  const restored = new pg.Pool({connectionString:url.href});
  t.after(() => restored.end());
  assert.equal((await restored.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
  assert.deepEqual(await facts(restored),protectedFacts);
  assert.deepEqual(await contents(restored),before);
  cpSync(join(backup,'images'),restoredImages,{recursive:true});
  await verifyImages(restored,restoredImages);
  for(const file of ['avatars/'+host.id+'.webp','media/'+media+'.webp']) {
    assert.equal(digest(join(restoredImages,file)),digest(join(images,file)));
    assert.equal((await sharp(join(restoredImages,file)).metadata()).format,'webp');
  }
  await assert.rejects(verifyImages(restored,join(root,'missing-images')),/Imagem referenciada ausente/);
  t.diagnostic(`Ensaio sintético preservado em ${root}; banco restaurado ${target}.`);
});
