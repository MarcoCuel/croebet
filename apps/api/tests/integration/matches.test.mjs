import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createMatch, commandMatch, getMatch, getRoomSync, listMatches, listLobbies, lobbyAction } from "../../dist/modules/matches/service.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import { tokenHash, newToken } from "../../dist/modules/auth/security.js";
import { botAction } from "../../dist/modules/games/flip7/engine.js";

const wire=value=>JSON.parse(JSON.stringify(value));

async function environment(t) {
  if(!process.env.TEST_DATABASE_URL)throw Error("Configure TEST_DATABASE_URL para banco isolado, migrado e identificado como test.");
  const {pool}=createDatabase(process.env.TEST_DATABASE_URL),actors=[],sessions=[],tokens=[];
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment,"test");
  t.after(async()=>{try{await pool.query("delete from game_matches where id in (select match_id from game_match_players where user_id=any($1::uuid[])) or created_by=any($1::uuid[])",[actors]);await pool.query("delete from sessions where user_id=any($1::uuid[])",[actors]);await pool.query("delete from users where id=any($1::uuid[])",[actors]);}finally{await pool.end();}});
  for(let i=0;i<4;i++){
    actors.push((await pool.query("insert into users(username,display_name,password_hash) values($1,$1,'test') returning id",[`Match_${randomBytes(6).toString("hex")}`])).rows[0].id);
    tokens.push(newToken());sessions.push(tokenHash(tokens[i]));
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",[sessions[i],actors[i]]);
  }
  const create=(capacity=6)=>createMatch(pool,actors[0],sessions[0],{requestId:randomUUID(),game:"flip7",capacity,options:{mode:"vengeance",brutal:true}});
  const lobby=(code,index,action,extra={})=>lobbyAction(pool,actors[index],sessions[index],code,action,{commandId:randomUUID(),...extra});
  return {pool,actors,sessions,tokens,create,lobby};
}
test("PostgreSQL: lobby, mínimo/capacidade, host, contas individuais e recuperação de eventos",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create();
 assert.equal(room.status,"lobby");assert.equal(room.capacity,6);assert.equal(room.state,null);
 assert.ok((await listLobbies(pool)).items.some(r=>r.id===room.id));
 assert.equal((await getMatch(pool,actors[2],room.code)).status,"lobby");
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:1}),{code:"NOT_ENOUGH_PLAYERS"});
 const joined=await lobby(room.code,1,"join");
 await assert.rejects(lobby(room.code,1,"start",{expectedVersion:joined.version}),{code:"HOST_ONLY"});
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:1}),{code:"VERSION_CONFLICT"});
 const started=await lobby(room.code,0,"start",{expectedVersion:joined.version});
 assert.equal(started.status,"playing");assert.equal(started.state.players.length,2);assert.equal(started.capacity,6);
 assert.ok(started.state.players.every(p=>p.kind==="human"));
 assert.equal((await listLobbies(pool)).items.some(r=>r.id===room.id),false);
 for(const actor of actors.slice(0,2))assert.ok((await listMatches(pool,actor)).items.some(m=>m.id===room.id));
 await assert.rejects(getMatch(pool,actors[2],room.code),{code:"NOT_FOUND"});
 await assert.rejects(lobby(room.code,2,"join"),{code:"LOBBY_CLOSED"});
 const sync=await getRoomSync(pool,actors[1],room.code,joined.version);
 assert.equal(sync.reset,false);assert.equal(sync.frames[0].action.type,"start");assert.equal(sync.frames.at(-1).version,started.version);
 const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
 const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
 const actor=actors.indexOf(started.participants.find(p=>p.seat===seat).userId),other=actor===0?1:0;
 const command={commandId:randomUUID(),expectedVersion:started.version,action:botAction(state)};
 await assert.rejects(commandMatch(pool,actors[other],sessions[other],room.code,command),{code:"NOT_YOUR_TURN"});
 const replies=await Promise.all([1,2].map(()=>commandMatch(pool,actors[actor],sessions[actor],room.code,command)));
 assert.deepEqual(wire(replies[0]),wire(replies[1]));
 await assert.rejects(commandMatch(pool,actors[actor],sessions[actor],room.code,{...command,expectedVersion:command.expectedVersion+1}),{code:"IDEMPOTENCY_CONFLICT"});
 await assert.rejects(commandMatch(pool,actors[actor],sessions[actor],room.code,{...command,commandId:randomUUID()}),{code:"VERSION_CONFLICT"});
 const catchup=await getRoomSync(pool,actors[other],room.code,started.version);
 assert.equal(catchup.reset,false);assert.deepEqual(wire(catchup.frames),wire(replies[0].frames));
 assert.equal(JSON.stringify(catchup).includes('"deck"'),false);assert.equal(JSON.stringify(catchup).includes('"seed"'),false);
 await pool.query("delete from game_match_events where match_id=$1 and version=$2",[room.id,catchup.frames[0].version]);
 assert.equal((await getRoomSync(pool,actors[actor],room.code,started.version)).reset,true);
});
test("PostgreSQL: capacidade concorrente, transferência de host, compactação e fechamento",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create(2);
 const results=await Promise.allSettled([1,2].map(i=>lobby(room.code,i,"join")));
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(results.find(r=>r.status==="rejected").reason.code,"LOBBY_FULL");
 const joined=await getMatch(pool,actors[0],room.code),survivor=joined.participants.find(p=>p.userId!==actors[0]);
 const next=await lobby(room.code,0,"leave");assert.equal(next.hostId,survivor.userId);
 const rejoined=await lobby(room.code,0,"join");
 const started=await lobby(room.code,actors.indexOf(next.hostId),"start",{expectedVersion:rejoined.version});
 assert.deepEqual(started.participants.map(p=>p.seat),[0,1]);assert.equal(started.participants[0].userId,survivor.userId);
 const alone=await create();assert.equal((await lobby(alone.code,0,"leave")).status,"closed");
 await assert.rejects(getMatch(pool,actors[0],alone.code),{code:"NOT_FOUND"});
 const input={requestId:randomUUID(),game:"flip7",capacity:3,options:{mode:"classic",brutal:false}};
 const original=await createMatch(pool,actors[0],sessions[0],input);
 await lobby(original.code,1,"join");await lobby(original.code,0,"leave");
 assert.deepEqual(await createMatch(pool,actors[0],sessions[0],input),original);
 await assert.rejects(createMatch(pool,actors[0],sessions[0],{...input,capacity:4}),{code:"IDEMPOTENCY_CONFLICT"});
});
test("PostgreSQL: rollback, sessão revogada e encerramento compartilhado",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create();
 const joined=await lobby(room.code,1,"join"),started=await lobby(room.code,0,"start",{expectedVersion:joined.version});
 const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
 const seat=state.bonusChoice ?? state.pending?.source ?? state.turn,actor=actors.indexOf(started.participants.find(p=>p.seat===seat).userId);
 const failingPool={connect:async()=>{const client=await pool.connect();return {query:(sql,args)=>sql.startsWith("insert into game_match_events")?Promise.reject(Error("event failure")):client.query(sql,args),release:()=>client.release()};}};
 await assert.rejects(commandMatch(failingPool,actors[actor],sessions[actor],room.code,{commandId:randomUUID(),expectedVersion:started.version,action:botAction(state)}),/event failure/);
 assert.deepEqual(wire(await getMatch(pool,actors[actor],room.code)),wire(started));
 await pool.query("delete from sessions where token_hash=$1",[sessions[actor]]);
 await assert.rejects(commandMatch(pool,actors[actor],sessions[actor],room.code,{commandId:randomUUID(),expectedVersion:started.version},true),{code:"UNAUTHENTICATED"});
 const peer=actor===0?1:0,command={commandId:randomUUID(),expectedVersion:started.version};
 const ended=await commandMatch(pool,actors[peer],sessions[peer],room.code,command,true);
 assert.equal(ended.match.status,"abandoned");assert.deepEqual(await commandMatch(pool,actors[peer],sessions[peer],room.code,command,true),ended);
 assert.equal((await listMatches(pool,actors[peer])).items.some(m=>m.id===room.id),false);
 assert.equal((await getRoomSync(pool,actors[peer],room.code,started.version)).room.status,"abandoned");
});

test("HTTP/SSE: autentica assinatura, transmite commits e revoga conexão sem expor mesa alheia",async t=>{
 const {pool,actors,sessions,tokens,create,lobby}=await environment(t);
 const app=createApp(async()=>{});
 await app.register(authRoutes,{pool,config:{APP_ENV:"test",WEB_ORIGIN:"http://localhost:3000",CSRF_SECRET:"test-secret-multiplayer-32-characters"}});
 const origin=await app.listen({host:"127.0.0.1",port:0});
 const aborts=[];
 // Close streams before the app, before environment() deletes its accounts.
 t.after(async()=>{for(const controller of aborts)controller.abort();await app.close();});
 assert.equal((await fetch(`${origin}/api/v1/matches/live`)).status,401);
 const room=await create();
 const connect=async(index,path)=>{
  const controller=new AbortController();aborts.push(controller);
  const response=await fetch(`${origin}/api/v1/matches/live${path}`,{headers:{cookie:`croebet-session=${tokens[index]}`},signal:controller.signal});
  return {response,controller};
 };
 const denied=await fetch(`${origin}/api/v1/matches/live?code=${room.code}`,{headers:{cookie:`croebet-session=${tokens[0]}`,origin:"https://another-origin.invalid"}});
 assert.equal(denied.status,403);
 const {response}=await connect(0,`?code=${room.code}&afterVersion=${room.version}`);
 assert.equal(response.headers.get("content-type"),"text/event-stream; charset=utf-8");
 const reader=response.body.getReader();let buffer="";
 async function event(name){
  const timeout=AbortSignal.timeout(5000);
  while(true){
   const split=buffer.indexOf("\n\n");
   if(split>=0){const block=buffer.slice(0,split);buffer=buffer.slice(split+2);if(block.includes(`event: ${name}\n`)){const line=block.split("\n").find(line=>line.startsWith("data: "));return JSON.parse(line.slice(6));}continue;}
   const chunk=await new Promise((resolve,reject)=>{const fail=()=>reject(Error("SSE timeout"));timeout.addEventListener("abort",fail,{once:true});reader.read().then(resolve,reject).finally(()=>timeout.removeEventListener("abort",fail));});
   if(chunk.done)throw Error("SSE closed unexpectedly");buffer+=new TextDecoder().decode(chunk.value);
  }
 }
 assert.equal((await event("room")).room.status,"lobby");
 const joined=await lobby(room.code,1,"join");assert.equal((await event("room")).room.participants.length,2);
 await lobby(room.code,0,"start",{expectedVersion:joined.version});
 const started=await event("room");assert.equal(started.room.status,"playing");assert.ok(started.frames.some(frame=>frame.action.type==="start"));
 assert.equal((await connect(2,`?code=${room.code}`)).response.status,404);
 const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
 const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
 const actor=actors.indexOf(started.room.participants.find(p=>p.seat===seat).userId);
 const command={commandId:randomUUID(),expectedVersion:started.room.version,action:botAction(state)};
 await pool.query("delete from sessions where token_hash=$1",[sessions[0]]);
 if(actor===0)await commandMatch(pool,actors[1],sessions[1],room.code,{commandId:randomUUID(),expectedVersion:started.room.version},true);
 else await commandMatch(pool,actors[actor],sessions[actor],room.code,command);
 assert.equal((await event("closed")).code,"UNAUTHENTICATED");
});
