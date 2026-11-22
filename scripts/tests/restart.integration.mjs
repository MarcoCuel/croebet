import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { createMatch, lobbyAction, getMatch, inviteLobbyPlayer } from '../../apps/api/dist/modules/matches/service.js';
import { grantInitialBalance } from '../../apps/api/dist/modules/economy/service.js';
import { csrfToken, tokenHash, newToken } from '../../apps/api/dist/modules/auth/security.js';
import { botAction } from '../../apps/api/dist/modules/games/flip7/engine.js';
import { validateRelease, activeMatchDigest, facts } from '../production.mjs';
import { sourceRoot } from '../runtime.mjs';
const { io } = createRequire(new URL('../../apps/api/package.json', import.meta.url))('socket.io-client');

async function until(check) {
  for(let i=0;i<100;i++){const result=await check();if(result)return result;await delay(100);}
  throw Error('Reinício de test não concluiu no prazo.');
}

test('deploy: API reinicia com partidas pagas e privadas, drena comando em voo e recupera recibo sem duplicar',{timeout:60000},async t=>{
  assert.ok(process.env.TEST_DATABASE_URL,'Configure banco exclusivo de test.');
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
  assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
  const root=mkdtempSync(join(tmpdir(),'croebet-restart-test-'));
  const listener=createServer();await new Promise(done=>listener.listen(0,'127.0.0.1',done));
  const port=listener.address().port;await new Promise(done=>listener.close(done));
  const secret='restart-test-csrf-secret-at-least-32-characters';
  const origin='http://localhost:3000';
  let child, socket, blocker, released=false;
  async function start(){
    child=spawn(process.execPath,['apps/api/dist/main.js'],{cwd:sourceRoot,stdio:'ignore',env:{...process.env,APP_ENV:'test',NODE_ENV:'test',DATABASE_URL:process.env.TEST_DATABASE_URL,API_HOST:'127.0.0.1',API_PORT:String(port),WEB_ORIGIN:origin,CSRF_SECRET:secret,AVATAR_STORAGE:'local',AVATAR_LOCAL_DIR:join(root,'avatars'),TRUST_CLOUDFLARE_PROXY:'false'}});
    await until(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`,{signal:AbortSignal.timeout(500)})).ok;}catch{return false;}});
  }
  async function stop(){if(child && child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);}}
  t.after(async()=>{
    socket?.disconnect();
    if(blocker && !released){await blocker.query('rollback');blocker.release();}
    await stop();await pool.end();
  });
  const actors=[];
  for(let i=0;i<2;i++){
    const id=randomUUID(),token=newToken(),hash=tokenHash(token);
    await pool.query("insert into users(id,username,display_name,password_hash,role) values($1,$2,'Reinício sintético','test','admin')",[id,'Restart_'+id.replaceAll('-','').slice(0,12)]);
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",[hash,id]);
    const c=await pool.connect();
    try{await c.query('begin');await grantInitialBalance(c,id);await c.query('commit');}finally{c.release();}
    actors.push({id,token,hash});
  }
  const [host,peer]=actors;
  async function table(game,development,entryAmount=0){
    const room=await createMatch(pool,host.id,host.hash,{requestId:randomUUID(),game,development,capacity:2,entryAmount,options:{mode:'classic',brutal:false}});
    if(development)await inviteLobbyPlayer(pool,host.id,host.hash,room.code,peer.id);
    let joined=await lobbyAction(pool,peer.id,peer.hash,room.code,'join',{commandId:randomUUID()});
    if(entryAmount)joined=await lobbyAction(pool,peer.id,peer.hash,room.code,'confirm-entry',{commandId:randomUUID(),expectedVersion:joined.version,entryAmount});
    for(const actor of actors)await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actor.id]);
    return lobbyAction(pool,host.id,host.hash,room.code,'start',{commandId:randomUUID(),expectedVersion:joined.version});
  }
  const flip=await table('flip7',false,5),love=await table('love-letter',true);
  const privateBefore=(await pool.query('select state from game_matches where id=$1',[love.id])).rows[0].state;
  assert.ok(await validateRelease(pool,sourceRoot)>=2);
  await start();
  const privateFlip=(await pool.query('select state from game_matches where id=$1',[flip.id])).rows[0].state;
  const actor=actors[privateFlip.bonusChoice ?? privateFlip.pending?.source ?? privateFlip.turn],nonce=newToken();
  socket=io(`http://127.0.0.1:${port}`,{path:'/api/v1/realtime',addTrailingSlash:false,transports:['websocket'],autoConnect:false,reconnection:false,extraHeaders:{origin,cookie:`croebet-session=${actor.token}; croebet-csrf=${nonce}`},auth:{csrf:csrfToken(secret,nonce,actor.token)}});
  const connected=once(socket,'connect');socket.connect();await connected;
  const watched=await socket.timeout(5000).emitWithAck('watch',{code:flip.code,afterVersion:flip.version});
  assert.equal(watched.ok,true);
  blocker=await pool.connect();
  await blocker.query('begin');await blocker.query('select id from game_matches where id=$1 for update',[flip.id]);
  const request={type:'command',code:flip.code,input:{commandId:randomUUID(),expectedVersion:flip.version,action:botAction(privateFlip)}};
  const unconfirmed=socket.timeout(15000).emitWithAck('request',request).catch(()=>null);
  await until(async()=>(await pool.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select * from game_matches where code=%'")).rows.length);
  const disconnected=once(socket,'disconnect');
  const stopping=stop();
  const [reason]=await disconnected;assert.equal(reason,'transport close');
  await blocker.query('commit');blocker.release();released=true;
  await stopping;await unconfirmed;
  const afterStop=await getMatch(pool,actor.id,flip.code);
  assert.ok(afterStop.version>flip.version);
  const digest=await activeMatchDigest(pool),ledger=await facts(pool);
  const receipts=(await pool.query('select response from game_match_commands where match_id=$1 and command_id=$2',[flip.id,request.input.commandId])).rows;
  assert.equal(receipts.length,1);
  assert.deepEqual((await pool.query('select state from game_matches where id=$1',[love.id])).rows[0].state,privateBefore);
  await start();
  const reconnected=once(socket,'connect');socket.connect();await reconnected;
  const retry=await socket.timeout(5000).emitWithAck('request',request);
  assert.equal(retry.ok,true);assert.deepEqual(retry.data,receipts[0].response);
  assert.equal(await activeMatchDigest(pool),digest);
  assert.deepEqual(await facts(pool),ledger);
  assert.deepEqual((await getMatch(pool,actor.id,flip.code)).state,afterStop.state);
  const own=await getMatch(pool,host.id,love.code),other=await getMatch(pool,peer.id,love.code);
  assert.notDeepEqual(own.state,other.state);
  assert.equal(own.state.players[1].hand,null);assert.equal(other.state.players[0].hand,null);
  assert.equal((await pool.query('select count(*)::int total from sessions where user_id=any($1::uuid[])',[actors.map(a=>a.id)])).rows[0].total,2);
  t.diagnostic('Partidas sintéticas preservadas no banco exclusivo de test.');
});
