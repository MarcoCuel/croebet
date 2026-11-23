import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../dist/db/client.js';
import { tokenHash } from '../../dist/modules/auth/security.js';
import { createMatch,lobbyAction,commandMatch,getRoomSync,advanceDeferredMatches } from '../../dist/modules/matches/service.js';
import { soloDeck,createSolo } from '../../dist/modules/games/solo/engine.js';

test('PostgreSQL Solo: desenvolvimento, intervenções concorrentes, recibos, privacidade e bots persistidos',async t=>{
 assert.ok(process.env.TEST_DATABASE_URL,'Configure TEST_DATABASE_URL exclusivo de test.');
 const {pool}=createDatabase(process.env.TEST_DATABASE_URL),users=[],hashes=[];
 t.after(()=>pool.end());assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
 for(let n=0;n<3;n++){
  const name=`Solo_${randomUUID().replaceAll('-','').slice(0,12)}`;
  const id=(await pool.query("insert into users(username,display_name,password_hash,role) values($1,$1,'test',$2) returning id",[name,n===0?'admin':'user'])).rows[0].id;users.push(id);hashes.push(tokenHash(randomUUID()));
  await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",[hashes[n],id]);
 }
 const input={requestId:randomUUID(),game:'solo',capacity:3,options:{mode:'single',brutal:false},development:true,entryAmount:0};
 await assert.rejects(createMatch(pool,users[0],hashes[0],{...input,development:false}),{code:'DEVELOPMENT_ONLY'});
 const lobby=await createMatch(pool,users[0],hashes[0],input);
 for(let n=1;n<3;n++)await lobbyAction(pool,users[n],hashes[n],lobby.code,'join',{commandId:randomUUID()});
 for(const user of users)await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),lobby.id,user]);
 const ready=(await getRoomSync(pool,users[0],lobby.code)).room;
 await lobbyAction(pool,users[0],hashes[0],lobby.code,'start',{commandId:randomUUID(),expectedVersion:ready.version});
 const state=createSolo(users.map((_,i)=>({name:`P${i}`,kind:'human'}))),deck=soloDeck();
 const take=(number,color)=>{const index=deck.findIndex(c=>c.number===number && c.color===color);assert.ok(index>=0);return deck.splice(index,1)[0];};
 state.turn=0;state.discard=[take(5,'red')];state.activeColor='red';state.players[0].hand=[take(1,'blue'),take(2,'blue')];state.players[1].hand=[take(5,'red'),take(3,'blue')];state.players[2].hand=[take(8,'green'),take(3,'green')];state.deck=deck;
 await pool.query('update game_matches set state=$2 where id=$1',[lobby.id,JSON.stringify(state)]);
 const before=(await getRoomSync(pool,users[1],lobby.code)).room;
 const jump={commandId:randomUUID(),expectedVersion:before.version,action:{type:'solo-play',seat:1,cardId:state.players[1].hand[0].id,solo:true}};
 await assert.rejects(commandMatch(pool,users[2],hashes[2],lobby.code,jump),{code:'NOT_YOUR_TURN'});
 const replies=await Promise.all([0,1].map(()=>commandMatch(pool,users[1],hashes[1],lobby.code,jump)));assert.deepEqual(replies,[{ok:true},{ok:true}]);
 const after=(await getRoomSync(pool,users[1],lobby.code)).room;assert.equal(after.state.turn,2);assert.equal(after.version,before.version+1);
 assert.equal(after.state.players[0].hand,null);assert.equal(after.state.players[2].hand,null);assert.equal(after.state.players[1].hand.length,1);
 await assert.rejects(commandMatch(pool,users[1],hashes[1],lobby.code,{...jump,commandId:randomUUID()}),{code:'VERSION_CONFLICT'});
 const events=(await pool.query('select event from game_match_events where match_id=$1',[lobby.id])).rows;
 for(const {event} of events)if(event.state.phase==='playing'){assert.ok(event.state.players.every(p=>p.hand===null));assert.deepEqual(event.state.legalActions,[]);assert.equal('cardId' in event.action,false);assert.equal('deck' in event.state,false);}
 const current=(await pool.query('select state from game_matches where id=$1',[lobby.id])).rows[0].state;current.players[2].kind='normal';
 await pool.query("update game_matches set state=$2,updated_at=clock_timestamp()-interval '3 seconds' where id=$1",[lobby.id,JSON.stringify(current)]);
 await Promise.all([advanceDeferredMatches(pool),advanceDeferredMatches(pool)]);
 const advanced=(await getRoomSync(pool,users[0],lobby.code)).room;assert.equal(advanced.version,after.version+1);
 await advanceDeferredMatches(pool);assert.equal((await getRoomSync(pool,users[0],lobby.code)).room.version,advanced.version);
 // Synthetic accounts/match remain available for inspection; no production/reset path.
});

test('PostgreSQL Solo: migration vincula placeholder existente sem substituir catálogo ou históricos',async t=>{
 assert.ok(process.env.TEST_DATABASE_URL,'Configure TEST_DATABASE_URL exclusivo de test.');
 const {pool}=createDatabase(process.env.TEST_DATABASE_URL);t.after(()=>pool.end());
 assert.equal((await pool.query('select environment from application_environment where id=1')).rows[0]?.environment,'test');
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../../drizzle/0040_bind_solo_module.sql',import.meta.url),'utf8');
 const client=await pool.connect();
 try{
  await client.query('begin');
  // Rollback restores the synthetic catalog, including any registered Solo row.
  await client.query("update games set module_id=gen_random_uuid()::text,slug='temporary-'||id::text where module_id='solo' or slug='solo'");
  const placeholder=(await client.query("insert into games(slug,name,description,enabled,module_id) values('solo','Meu Solo','Texto personalizado',true,gen_random_uuid()::text) returning *")).rows[0];
  await client.query(sql);
  const bound=(await client.query('select * from games where id=$1',[placeholder.id])).rows[0];
  assert.deepEqual(bound,{...placeholder,module_id:'solo',version:placeholder.version+1});
  await client.query(sql);
  assert.deepEqual((await client.query('select * from games where id=$1',[placeholder.id])).rows[0],bound);
 }finally{await client.query('rollback');client.release();}
});
