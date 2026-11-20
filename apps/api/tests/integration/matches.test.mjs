import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createDatabase } from "../../dist/db/client.js";
import { createMatch, commandMatch, getMatch, getRoomSync, listMatches, listLobbies, lobbyAction, kickMatch } from "../../dist/modules/matches/service.js";
import { createApp } from "../../dist/app.js";
import { authRoutes } from "../../dist/modules/auth/routes.js";
import { csrfToken, tokenHash, newToken } from "../../dist/modules/auth/security.js";
import { io } from "socket.io-client";
import { setTimeout as delay } from "node:timers/promises";
import { botAction } from "../../dist/modules/games/flip7/engine.js";

const wire=value=>JSON.parse(JSON.stringify(value));

async function environment(t) {
  if(!process.env.TEST_DATABASE_URL)throw Error("Configure TEST_DATABASE_URL para banco isolado, migrado e identificado como test.");
  const {pool}=createDatabase(process.env.TEST_DATABASE_URL),actors=[],sessions=[],tokens=[],cleanup=[];
  assert.equal((await pool.query("select environment from application_environment where id=1")).rows[0]?.environment,"test");
  t.after(async()=>{try{for(const close of cleanup.reverse())await close();await pool.query("delete from game_matches where id in (select match_id from game_match_players where user_id=any($1::uuid[])) or created_by=any($1::uuid[])",[actors]);await pool.query("delete from sessions where user_id=any($1::uuid[])",[actors]);await pool.query("delete from users where id=any($1::uuid[])",[actors]);}finally{await pool.end();}});
  for(let i=0;i<4;i++){
    actors.push((await pool.query("insert into users(username,display_name,password_hash) values($1,$1,'test') returning id",[`Match_${randomBytes(6).toString("hex")}`])).rows[0].id);
    tokens.push(newToken());sessions.push(tokenHash(tokens[i]));
    await pool.query("insert into sessions(token_hash,user_id,expires_at,idle_expires_at) values($1,$2,now()+interval '1 day',now()+interval '1 day')",[sessions[i],actors[i]]);
  }
  const createFor=async(index,capacity=6)=>{const room=await createMatch(pool,actors[index],sessions[index],{requestId:randomUUID(),game:"flip7",capacity,options:{mode:"vengeance",brutal:true}});await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actors[index]]);return room;};
  const create=capacity=>createFor(0,capacity);
  const lobby=async(code,index,action,extra={})=>{
    const room=await lobbyAction(pool,actors[index],sessions[index],code,action,{commandId:randomUUID(),...extra});
    if(action==="join")await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actors[index]]);
    return room;
  };
  return {pool,actors,sessions,tokens,create,createFor,lobby,cleanup};
}
test("PostgreSQL: lobby, mínimo/capacidade, host, contas individuais e recuperação de eventos",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create();
 assert.equal(room.status,"lobby");assert.equal(room.capacity,6);assert.equal(room.state,null);
 assert.ok((await listLobbies(pool,actors[0])).items.some(r=>r.id===room.id));
 assert.equal((await getMatch(pool,actors[2],room.code)).status,"lobby");
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:1}),{code:"NOT_ENOUGH_PLAYERS"});
 const joined=await lobby(room.code,1,"join");
 await assert.rejects(lobby(room.code,1,"start",{expectedVersion:joined.version}),{code:"HOST_ONLY"});
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:1}),{code:"VERSION_CONFLICT"});
 const started=await lobby(room.code,0,"start",{expectedVersion:joined.version});
 assert.equal(started.status,"playing");assert.equal(started.state.players.length,2);assert.equal(started.capacity,6);
 assert.ok(started.state.players.every(p=>p.kind==="human"));
 assert.equal((await listLobbies(pool,actors[0])).items.some(r=>r.id===room.id),false);
 for(const actor of actors.slice(0,2))assert.ok((await listMatches(pool,actor)).items.some(m=>m.id===room.id));
 assert.equal((await getMatch(pool,null,room.code)).status,"playing");
 assert.ok((await listMatches(pool,null)).items.some(m=>m.id===room.id));
 const summary=(await listMatches(pool,null)).items.find(m=>m.id===room.id);
 assert.equal(summary.round,started.state.round);
 assert.deepEqual(new Set(summary.controllerIds),new Set(actors.slice(0,2)));
 assert.equal("state" in summary,false);

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
test("PostgreSQL: várias filas por conta, uma criação própria e concorrência entre abas",async t=>{
 const {pool,actors,sessions,lobby,createFor}=await environment(t);
 const input=()=>({requestId:randomUUID(),game:"flip7",capacity:6,options:{mode:"classic",brutal:false}});
 const first=input(),second=input();
 const attempts=await Promise.allSettled([first,second].map(data=>createMatch(pool,actors[0],sessions[0],data)));
 assert.equal(attempts.filter(result=>result.status==="fulfilled").length,1);
 assert.equal(attempts.find(result=>result.status==="rejected").reason.code,"LOBBY_EXISTS");
 const room=attempts.find(result=>result.status==="fulfilled").value;
 assert.deepEqual(await createMatch(pool,actors[0],sessions[0],attempts[0].status==="fulfilled"?first:second),room);
 assert.equal((await listLobbies(pool,actors[0])).owned.id,room.id);
 const other=await createFor(2);
 await lobby(other.code,0,"join");await lobby(room.code,1,"join");
 const own=await createFor(1);
 assert.equal((await listLobbies(pool,actors[1])).owned.code,own.code);
 assert.equal((await listLobbies(pool,actors[0])).joined.length,2);
 assert.equal((await listLobbies(pool,actors[1])).joined.length,2);
 const race=await Promise.allSettled([createFor(3),lobby(other.code,3,"join")]);
 assert.ok(race.every(result=>result.status==="fulfilled"));
 await lobby(room.code,0,"leave");
 assert.equal((await listLobbies(pool,actors[0])).owned,null);
 assert.equal((await getMatch(pool,actors[1],room.code)).hostId,actors[1]);
 assert.equal((await listLobbies(pool,actors[1])).owned.code,own.code);
 const newOwn=await createFor(0);
 await lobby(room.code,0,"join");
 assert.equal((await listLobbies(pool,actors[0])).owned.code,newOwn.code);
});

test("PostgreSQL: iniciar retira todos das outras filas, libera reservas e transfere host atomicamente",async t=>{
 const {pool,actors,sessions,lobby,createFor}=await environment(t);
 const {inviteLobbyPlayer}=await import("../../dist/modules/matches/service.js");
 const old=await createFor(0);await lobby(old.code,3,"join");
 await inviteLobbyPlayer(pool,actors[0],sessions[0],old.code,actors[1]);
 const solo=await createFor(1),winner=await createFor(2);
 await lobby(winner.code,0,"join");const ready=await lobby(winner.code,1,"join");
 const input={commandId:randomUUID(),expectedVersion:ready.version};
 const started=await lobbyAction(pool,actors[2],sessions[2],winner.code,"start",input);
 assert.equal(started.status,"playing");
 const remaining=await getMatch(pool,actors[3],old.code);
 assert.deepEqual(remaining.participants.map(p=>p.userId),[actors[3]]);assert.equal(remaining.hostId,actors[3]);
 assert.equal(remaining.pendingInvitations.length,0);
 await assert.rejects(getMatch(pool,actors[1],solo.code),{code:"NOT_FOUND"});
 for(const actor of actors.slice(0,3)){
  const directory=await listLobbies(pool,actor);
  assert.deepEqual(directory.joined,[]);assert.equal(directory.owned,null);assert.equal(directory.active.code,winner.code);
 }
 const version=remaining.version;
 assert.deepEqual(wire(await lobbyAction(pool,actors[2],sessions[2],winner.code,"start",input)),wire(started));
 assert.equal((await getMatch(pool,actors[3],old.code)).version,version);
 await assert.rejects(createFor(0),{code:"ALREADY_PLAYING"});
 await assert.rejects(lobby(old.code,0,"join"),{code:"ALREADY_PLAYING"});
 const after=await commandMatch(pool,actors[0],sessions[0],winner.code,{commandId:randomUUID(),expectedVersion:started.version},true);
 assert.equal(after.match.state.players.find(p=>p.name===started.participants.find(p=>p.userId===actors[0]).username).kind,"normal");
 assert.equal((await createFor(0)).status,"lobby");
});

test("PostgreSQL: dois inícios simultâneos com a mesma pessoa confirmam só uma partida",async t=>{
 const {pool,actors,sessions,lobby,createFor}=await environment(t);
 const a=await createFor(0),b=await createFor(2);
 const ra=await lobby(a.code,1,"join"),rb=await lobby(b.code,1,"join");
 const starts=[{room:ra,actor:0},{room:rb,actor:2}];
 const results=await Promise.allSettled(starts.map(({room,actor})=>lobbyAction(pool,actors[actor],sessions[actor],room.code,"start",{commandId:randomUUID(),expectedVersion:room.version})));
 assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
 assert.equal(results.find(result=>result.status==="rejected").reason.code,"VERSION_CONFLICT");
 const count=(await pool.query("select count(*)::int total from game_matches m join game_match_players p on p.match_id=m.id where p.controller_id=$1 and m.status='playing'",[actors[1]])).rows[0].total;
 assert.equal(count,1);
 const loser=starts[results.findIndex(result=>result.status==="rejected")].room;
 assert.equal((await getMatch(pool,null,loser.code)).participants.length,1);
});

test("PostgreSQL: salas sem participantes em comum podem iniciar simultaneamente",async t=>{
 const {pool,actors,sessions,lobby,createFor}=await environment(t);
 const a=await createFor(0),b=await createFor(2);
 const ra=await lobby(a.code,1,"join"),rb=await lobby(b.code,3,"join");
 const results=await Promise.all([{room:ra,actor:0},{room:rb,actor:2}].map(({room,actor})=>lobbyAction(pool,actors[actor],sessions[actor],room.code,"start",{commandId:randomUUID(),expectedVersion:room.version})));
 assert.ok(results.every(room=>room.status==="playing"));
 for(const [actor,code] of [[0,a.code],[1,a.code],[2,b.code],[3,b.code]])assert.equal((await listLobbies(pool,actors[actor])).active.code,code);
});

test("PostgreSQL: falha no início reverte também saídas, reservas, presença e versões das outras filas",async t=>{
 const {pool,actors,sessions,lobby,createFor}=await environment(t);
 const {inviteLobbyPlayer}=await import("../../dist/modules/matches/service.js");
 const a=await createFor(0),b=await createFor(2);
 const ra=await lobby(a.code,1,"join");await lobby(b.code,1,"join");
 await inviteLobbyPlayer(pool,actors[2],sessions[2],b.code,actors[0]);
 const before=wire(await getMatch(pool,null,b.code));
 const failingPool={connect:async()=>{const client=await pool.connect();return {query:(sql,args)=>sql.startsWith("insert into game_match_events")?Promise.reject(Error("event failure")):client.query(sql,args),release:()=>client.release()};}};
 await assert.rejects(lobbyAction(failingPool,actors[0],sessions[0],a.code,"start",{commandId:randomUUID(),expectedVersion:ra.version}),/event failure/);
 assert.deepEqual(wire(await getMatch(pool,null,b.code)),before);
 assert.equal((await getMatch(pool,null,a.code)).status,"lobby");
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
 let closing=started;
 for(const person of started.participants){const index=actors.indexOf(person.userId);closing=(await commandMatch(pool,person.userId,sessions[index],room.code,{commandId:randomUUID(),expectedVersion:closing.version},true)).match;}
 const alone=await create();assert.equal((await lobby(alone.code,0,"leave")).status,"closed");
 await assert.rejects(getMatch(pool,actors[0],alone.code),{code:"NOT_FOUND"});
 const input={requestId:randomUUID(),game:"flip7",capacity:3,options:{mode:"classic",brutal:false}};
 const original=await createMatch(pool,actors[0],sessions[0],input);
 await lobby(original.code,1,"join");await lobby(original.code,0,"leave");
 assert.deepEqual(await createMatch(pool,actors[0],sessions[0],input),original);
 await assert.rejects(createMatch(pool,actors[0],sessions[0],{...input,capacity:4}),{code:"IDEMPOTENCY_CONFLICT"});
});
test("PostgreSQL: só o host edita lobby aberto, preservando ocupação, versão e idempotência",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create(6);
 await lobby(room.code,1,"join");
 const joined=await lobby(room.code,2,"join");
 const input={commandId:randomUUID(),expectedVersion:joined.version,capacity:4,options:{mode:"classic",brutal:false}};
 await assert.rejects(lobbyAction(pool,actors[1],sessions[1],room.code,"update",input),{code:"HOST_ONLY"});
 await assert.rejects(lobbyAction(pool,actors[0],sessions[0],room.code,"update",{...input,expectedVersion:1}),{code:"VERSION_CONFLICT"});
 await assert.rejects(lobbyAction(pool,actors[0],sessions[0],room.code,"update",{...input,capacity:2}),{code:"CAPACITY_TOO_SMALL"});
 const updated=await lobbyAction(pool,actors[0],sessions[0],room.code,"update",input);
 assert.equal(updated.capacity,4);assert.deepEqual(updated.options,input.options);assert.equal(updated.version,joined.version+1);
 assert.deepEqual(updated.participants,joined.participants);
 assert.deepEqual(await lobbyAction(pool,actors[0],sessions[0],room.code,"update",input),updated);
 await assert.rejects(lobbyAction(pool,actors[0],sessions[0],room.code,"update",{...input,capacity:5}),{code:"IDEMPOTENCY_CONFLICT"});
 assert.equal((await listLobbies(pool,actors[0])).items.find(r=>r.id===room.id).capacity,4);
 const started=await lobby(room.code,0,"start",{expectedVersion:updated.version});
 assert.equal(started.state.mode,"classic");assert.equal(started.state.brutal,false);
 await assert.rejects(lobbyAction(pool,actors[0],sessions[0],room.code,"update",{...input,commandId:randomUUID(),expectedVersion:started.version}),{code:"LOBBY_CLOSED"});
});
test("PostgreSQL: rollback, sessão revogada e abandono individual",async t=>{
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
 assert.equal(ended.match.status,"playing");assert.deepEqual(wire(await commandMatch(pool,actors[peer],sessions[peer],room.code,command,true)),wire(ended));
 assert.equal(ended.match.state.players[ended.match.participants.find(p=>p.userId===actors[peer]).seat].kind,"normal");
 assert.equal((await listMatches(pool,actors[peer])).items.some(m=>m.id===room.id),true);
 assert.equal((await getRoomSync(pool,actors[peer],room.code,started.version)).room.status,"playing");
});

test("PostgreSQL: expulsão no lobby e no jogo, bot sem controle pela conta e saída do último humano",async t=>{
 const {pool,actors,sessions,create,lobby}=await environment(t),room=await create();
 await lobby(room.code,1,"join");const joined=await lobby(room.code,2,"join");
 const input={commandId:randomUUID(),expectedVersion:joined.version,targetUserId:actors[1]};
 await assert.rejects(kickMatch(pool,actors[2],sessions[2],room.code,input),{code:"HOST_ONLY"});
 await assert.rejects(kickMatch(pool,actors[0],sessions[0],room.code,{...input,targetUserId:actors[0]}),{code:"INVALID_TARGET"});
 const kicked=await kickMatch(pool,actors[0],sessions[0],room.code,input);
 assert.equal(kicked.participants.length,2);assert.equal(kicked.capacity,6);
 assert.deepEqual(await kickMatch(pool,actors[0],sessions[0],room.code,input),kicked);
 const rejoined=await lobby(room.code,1,"join");
 const started=await lobby(room.code,0,"start",{expectedVersion:rejoined.version});
 const target=started.participants.find(p=>p.userId===actors[1]);
 const kick={commandId:randomUUID(),expectedVersion:started.version,targetUserId:actors[1]};
 const converted=await kickMatch(pool,actors[0],sessions[0],room.code,kick);
 assert.equal(converted.status,"playing");assert.equal(converted.state.players[target.seat].kind,"normal");
 assert.deepEqual(wire(await kickMatch(pool,actors[0],sessions[0],room.code,kick)),wire(converted));
 const frames=(await getRoomSync(pool,actors[0],room.code,started.version)).frames;
 assert.deepEqual(frames[0].action,{type:"replace",seat:target.seat});
 assert.deepEqual(frames[0].state.players[target.seat].cards,started.state.players[target.seat].cards);
 assert.equal(frames[0].state.players[target.seat].total,started.state.players[target.seat].total);
 await assert.rejects(commandMatch(pool,actors[1],sessions[1],room.code,{commandId:randomUUID(),expectedVersion:converted.version,action:{type:"draw"}}),{code:"PARTICIPATION_ENDED"});
 assert.equal((await getMatch(pool,actors[1],room.code)).status,"playing");
 const gone=await commandMatch(pool,actors[0],sessions[0],room.code,{commandId:randomUUID(),expectedVersion:converted.version},true);
 assert.equal(gone.match.hostId,actors[2]);assert.equal(gone.match.status,"playing");
 const last=await commandMatch(pool,actors[2],sessions[2],room.code,{commandId:randomUUID(),expectedVersion:gone.match.version},true);
 assert.equal(last.match.status,"abandoned");assert.ok(last.match.state.players.every(p=>p.kind==="normal"));
 await assert.rejects(getMatch(pool,actors[2],room.code),{code:"NOT_FOUND"});
});

test("Socket.IO: duas APIs propagam commits, recuperam reconexão, deduplicam comandos e revogam sessão",async t=>{
 const {pool,actors,sessions,tokens,cleanup}=await environment(t);
 const config={APP_ENV:"test",WEB_ORIGIN:"http://localhost:3000",DEV_WEB_ORIGINS:"http://192.168.1.2:3000",CSRF_SECRET:"test-secret-multiplayer-32-characters"};
 const apps=[createApp(async()=>{}),createApp(async()=>{})],origins=[],sockets=[];
 cleanup.push(async()=>{for(const socket of sockets)socket.disconnect();await Promise.all(apps.map(app=>app.close()));});
 for(const app of apps){await app.register(authRoutes,{pool,config});origins.push(await app.listen({host:"127.0.0.1",port:0}));}
 const wait=async(check)=>{const end=Date.now()+5000;while(Date.now()<end){const value=check();if(value)return value;await delay(10);}throw Error("Socket.IO event timeout");};
 const connect=async(index,server=0,overrides={})=>{
  const nonce=newToken();
  const socket=io(origins[server],{path:"/api/v1/realtime",addTrailingSlash:false,transports:["websocket"],reconnection:false,autoConnect:false,
   extraHeaders:{origin:server===1?config.DEV_WEB_ORIGINS:config.WEB_ORIGIN,cookie:`croebet-session=${tokens[index]}; croebet-csrf=${nonce}`},
   auth:{csrf:csrfToken(config.CSRF_SECRET,nonce,tokens[index])},...overrides});
  sockets.push(socket);socket.rooms=[];socket.closed=[];socket.directories=[];
  socket.on("lobbies",value=>socket.directories.push(value));socket.on("room",value=>socket.rooms.push(value));socket.on("closed",value=>socket.closed.push(value));
  await new Promise((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",error=>reject(new Error(`connect actor=${index} server=${server} overrides=${Object.keys(overrides)}: ${error.message}`,{cause:error})));socket.connect();});
  assert.equal(socket.io.engine.transport.name,"websocket");return socket;
 };
 const request=async(socket,value)=>{const reply=await socket.timeout(5000).emitWithAck("request",value);assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data;};
 const watch=async(socket,code,afterVersion=0)=>{const reply=await socket.timeout(5000).emitWithAck("watch",{code,afterVersion});assert.equal(reply.ok,true,JSON.stringify(reply));};
 await assert.rejects(connect(0,0,{auth:{csrf:"invalid"}}));
 await assert.rejects(connect(0,0,{extraHeaders:{origin:"https://another-origin.invalid"}}));
 const host=await connect(0),peer=await connect(1,1),outsider=await connect(2,1);
 // Count reads across both API instances, including newly opened pool clients.
 const reads=[];const instrumented=new WeakSet();
 const instrument=client=>{
  if(instrumented.has(client))return;instrumented.add(client);
  const query=client.query;
  client.query=function(...args){
   const sql=(typeof args[0]==="string"?args[0]:args[0]?.text ?? "").trimStart();
   if(sql.startsWith("select"))reads.push({sql,values:args[1]});
   return query.apply(this,args);
  };
 };
 pool.on("acquire",instrument);
 const room=await request(host,{type:"create",input:{requestId:randomUUID(),game:"flip7",capacity:6,options:{mode:"vengeance",brutal:true}}});
 await watch(host,room.code);
 const joined=await request(peer,{type:"join",code:room.code,input:{commandId:randomUUID()}});
 await watch(peer,room.code);
 const waiting=await request(peer,{type:"create",input:{requestId:randomUUID(),game:"flip7",capacity:6,options:{mode:"classic",brutal:false}}});
 await watch(peer,waiting.code);
 assert.equal((await pool.query("select count(*)::int total from match_presence where user_id=$1 and match_id=any($2::uuid[])",[actors[1],[room.id,waiting.id]])).rows[0].total,2);
 await wait(()=>host.rooms.find(value=>value.room.version===joined.version && value.room.onlineUserIds.includes(actors[1])));
 const started=await request(host,{type:"start",code:room.code,input:{commandId:randomUUID(),expectedVersion:joined.version}});
 await wait(()=>peer.directories.some(directory=>directory.active?.code===room.code));
 await assert.rejects(getMatch(pool,actors[1],waiting.code),{code:"NOT_FOUND"});
 await watch(peer,room.code,joined.version);
 for(const socket of [host,peer]){
  const sync=await wait(()=>socket.rooms.find(value=>value.room.version===started.version));
  assert.equal(sync.room.status,"playing");assert.ok(sync.frames.some(frame=>frame.action.type==="start"));
  assert.equal(JSON.stringify(sync).includes('"deck":'),false);assert.equal(JSON.stringify(sync).includes('"seed":'),false);
 }
 const visitor=await connect(0,0,{extraHeaders:{origin:config.WEB_ORIGIN},auth:{}});
 await watch(visitor,room.code);
 assert.equal((await wait(()=>visitor.rooms[0])).room.status,"playing");
 assert.equal((await pool.query("select count(*)::int count from match_presence where match_id=$1",[room.id])).rows[0].count,2);
 const blocked=await visitor.timeout(5000).emitWithAck("request",{type:"join",code:room.code,input:{commandId:randomUUID()}});
 assert.equal(blocked.ok,false);assert.equal(blocked.error.code,"UNAUTHENTICATED");
 const viewed=await outsider.timeout(5000).emitWithAck("watch",{code:room.code,afterVersion:0});assert.equal(viewed.ok,true);
 const denied=await outsider.timeout(5000).emitWithAck("request",{type:"command",code:room.code,input:{commandId:randomUUID(),expectedVersion:started.version,action:{type:"draw"}}});assert.equal(denied.ok,false);
 // An unchanged room notification still needs a read for its watchers,
 // but must not query another table, the directory or invitation inboxes.
 const unrelated=await createMatch(pool,actors[3],sessions[3],{requestId:randomUUID(),game:"flip7",capacity:2,options:{mode:"classic",brutal:false}});
 await watch(outsider,unrelated.code);
 await delay(150);reads.length=0;
 await pool.query("select pg_notify('croebet_matches',$1)",[JSON.stringify({kind:"room",code:room.code,directory:false,matches:false})]);
 await wait(()=>reads.some(r=>r.sql==="select * from game_matches where code=$1" && r.values?.[0]===room.code));
 await delay(100);
 assert.equal(reads.some(r=>r.sql==="select * from game_matches where code=$1" && r.values?.[0]===unrelated.code),false);
 assert.equal(reads.some(r=>r.sql.includes("m.status='lobby' and g.enabled=true")),false);
 assert.equal(reads.some(r=>r.sql.includes("from game_match_invitations i")),false);
 assert.equal(reads.some(r=>r.sql.includes("array(select p.controller_id")),false);
 const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
 const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
 const actor=actors.indexOf(started.participants.find(p=>p.seat===seat).userId),sender=[host,peer][actor],receiver=[peer,host][actor];
 receiver.disconnect();
 const input={commandId:randomUUID(),expectedVersion:started.version,action:botAction(state)};
 const result=await request(sender,{type:"command",code:room.code,input});
 assert.deepEqual(await request(sender,{type:"command",code:room.code,input}),result);
 const rejected=await sender.timeout(5000).emitWithAck("request",{type:"command",code:room.code,input:{...input,commandId:randomUUID()}});
 assert.equal(rejected.ok,false);assert.equal(rejected.error.code,"VERSION_CONFLICT");
 const resumed=await connect(actor===0?1:0,1);
 await watch(resumed,room.code,started.version);
 const recovered=await wait(()=>resumed.rooms.find(value=>value.room.version===result.match.version));
 assert.equal(recovered.reset,false);assert.deepEqual(recovered.frames,result.frames);
 await pool.query("delete from sessions where token_hash=$1",[sessions[actor]]);
 assert.equal((await wait(()=>sender.closed[0])).code,"UNAUTHENTICATED");
 await wait(()=>!sender.connected);
});

test("PostgreSQL: convites autorizados, presença, repetição e reserva de vaga, recusa e entrada",async t=>{
  const {refreshPresence,listLobbyPlayers,inviteLobbyPlayer}=await import("../../dist/modules/matches/service.js");
  const {pool,actors,sessions,create,lobby}=await environment(t),room=await create(2);
  let players=await listLobbyPlayers(pool,actors[0],room.code,"");
  assert.equal(players.items.some(p=>p.userId===actors[0]),false);
  assert.equal(players.items.find(p=>p.userId===actors[1]).online,false);
  await refreshPresence(pool,actors[1],sessions[1]);
  players=await listLobbyPlayers(pool,actors[0],room.code,"");
  assert.equal(players.items.find(p=>p.userId===actors[1]).online,true);
  await pool.query("update user_presence set expires_at=now()-interval '1 second' where user_id=$1",[actors[1]]);
  assert.equal((await listLobbyPlayers(pool,actors[0],room.code,"")).items.find(p=>p.userId===actors[1]).online,false);
  await assert.rejects(inviteLobbyPlayer(pool,actors[1],sessions[1],room.code,actors[2]),{code:"HOST_ONLY"});
  await assert.rejects(listLobbyPlayers(pool,actors[1],room.code,""),{code:"HOST_ONLY"});
  await assert.rejects(inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[0]),{code:"ALREADY_JOINED"});
  await assert.rejects(inviteLobbyPlayer(pool,actors[0],"invalid",room.code,actors[1]),{code:"UNAUTHENTICATED"});
  await Promise.all([1,2].map(()=>inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[1])));
  assert.equal((await pool.query("select count(*)::int total from game_match_invitations where match_id=$1",[room.id])).rows[0].total,1);
  assert.equal((await getMatch(pool,actors[0],room.code)).participants.length,1);
  assert.equal((await refreshPresence(pool,actors[1],sessions[1])).items[0].code,room.code);
  assert.equal((await refreshPresence(pool,actors[2],sessions[2])).items.length,0);
  assert.equal((await listLobbyPlayers(pool,actors[0],room.code,"")).items.find(p=>p.userId===actors[1]).invited,true);
  assert.equal((await listLobbyPlayers(pool,actors[0],room.code,"%" )).items.length,0);
  assert.equal((await getMatch(pool,actors[0],room.code)).pendingInvitations[0].userId,actors[1]);
  await assert.rejects(lobby(room.code,2,"join"),{code:"LOBBY_FULL"});
  const {declineInvitation}=await import("../../dist/modules/matches/service.js");
  await declineInvitation(pool,actors[1],sessions[1],room.code);
  assert.equal((await getMatch(pool,actors[0],room.code)).pendingInvitations.length,0);
  await inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[1]);
  await lobby(room.code,1,"join");
  assert.equal((await refreshPresence(pool,actors[1],sessions[1])).items.length,0);
  await assert.rejects(inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[2]),{code:"LOBBY_FULL"});
  await lobby(room.code,0,"start",{expectedVersion:(await getMatch(pool,actors[0],room.code)).version});
  await assert.rejects(inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[2]),{code:"LOBBY_CLOSED"});
});

test("PostgreSQL: início exige presença na sala de todos, incluindo convidados pendentes",async t=>{
  const {pool,actors,sessions,create,lobby}=await environment(t),room=await create(4);
  const {inviteLobbyPlayer}=await import("../../dist/modules/matches/service.js");
  await lobby(room.code,1,"join");
  await inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[2]);
  let current=await getMatch(pool,actors[0],room.code);
  await assert.rejects(lobby(room.code,0,"start",{expectedVersion:current.version}),{code:"INVITATIONS_PENDING"});
  await kickMatch(pool,actors[0],sessions[0],room.code,{commandId:randomUUID(),expectedVersion:current.version,targetUserId:actors[2]});
  await pool.query("update match_presence set expires_at=now()-interval '1 second' where user_id=$1",[actors[1]]);
  current=await getMatch(pool,actors[0],room.code);
  assert.equal(current.onlineUserIds.includes(actors[1]),false);
  await assert.rejects(lobby(room.code,0,"start",{expectedVersion:current.version}),{code:"PLAYERS_OFFLINE"});
  await pool.query("update match_presence set expires_at=now()+interval '1 minute' where user_id=$1",[actors[1]]);
  assert.equal((await lobby(room.code,0,"start",{expectedVersion:current.version})).status,"playing");
});

test("PostgreSQL: arquivo transacional, replay completo, idempotência e preservação após exclusão",async t=>{
 const {readGameHistory,readMatchReplay,readOwnMatchReplay}=await import("../../dist/modules/admin/match-history.js");
 const {pool,actors,sessions,create,lobby,cleanup}=await environment(t);
 const room=await create();
 cleanup.push(async()=>{await pool.query("delete from game_match_archive_frames where match_id=$1",[room.id]);await pool.query("delete from game_match_archives where id=$1",[room.id]);});
 assert.equal((await pool.query("select 1 from game_match_archives where id=$1",[room.id])).rowCount,0);
 const joined=await lobby(room.code,1,"join");
 let match=await lobby(room.code,0,"start",{expectedVersion:joined.version});
 const rollbackClient=await pool.connect();
 try {
   await rollbackClient.query("begin");
   await rollbackClient.query("update game_matches set status='abandoned' where id=$1",[room.id]);
   assert.equal((await rollbackClient.query("select status from game_match_archives where id=$1",[room.id])).rows[0].status,"abandoned");
   await rollbackClient.query("rollback");
 } finally {rollbackClient.release();}
 assert.equal((await pool.query("select status from game_match_archives where id=$1",[room.id])).rows[0].status,"playing");
 for(let step=0;match.status==="playing"&&step<1500;step++){
   const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
   const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
   const actor=actors.indexOf(match.participants.find(p=>p.seat===seat).userId);
   const command={commandId:randomUUID(),expectedVersion:match.version,action:botAction(state)};
   const result=await commandMatch(pool,actors[actor],sessions[actor],room.code,command);
   if(step===0)assert.deepEqual(wire(await commandMatch(pool,actors[actor],sessions[actor],room.code,command)),wire(result));
   match=result.match;
 }
 assert.equal(match.status,"finished");
 const timing=(await pool.query("select floor(greatest(0,extract(epoch from (ended_at-started_at))))::int as seconds from game_match_archives where id=$1",[room.id])).rows[0];
 assert.equal(match.durationSeconds,timing.seconds);
 assert.equal((await getMatch(pool,actors[0],room.code)).durationSeconds,timing.seconds);
 const gameId=(await pool.query("select game_id from game_matches where id=$1",[room.id])).rows[0].game_id;
 const avatarKey=`${actors[0]}.webp`;
 await pool.query("update users set avatar_key=$1 where id=$2",[avatarKey,actors[0]]);
 const replay=await readMatchReplay(pool,gameId,room.id,0,100);
 assert.equal(replay.match.players.find(p=>p.userId===actors[0]).avatarUrl,`/api/v1/avatars/${avatarKey}`);
 assert.ok(replay.match.players.some(p=>p.winner));
 assert.deepEqual(await readOwnMatchReplay(pool,actors[0],room.code,0,100),replay);
 await assert.rejects(readOwnMatchReplay(pool,actors[2],room.code,0,100),{code:"NOT_FOUND"});
 assert.equal(replay.frames[0].action.type,"start");
 const archive=(await pool.query("select event from game_match_archive_frames where match_id=$1 order by version",[room.id])).rows;
 const events=(await pool.query("select event from game_match_events where match_id=$1 order by version",[room.id])).rows;
 assert.deepEqual(archive,events);assert.equal(replay.match.frameCount,events.length);
 assert.deepEqual(archive.at(-1).event.state,wire(match.state));
 assert.equal(JSON.stringify(archive).includes('"deck"'),false);
 const filtered=await readGameHistory(pool,gameId,{offset:0,limit:20,q:room.code,status:"finished"});
 assert.equal(filtered.items[0].id,room.id);
 assert.equal(filtered.items[0].players.find(p=>p.userId===actors[0]).avatarUrl,`/api/v1/avatars/${avatarKey}`);
 const client=await pool.connect();
 try{await client.query("begin");await client.query("delete from game_matches where id=$1",[room.id]);await client.query("rollback");}finally{client.release();}
 assert.equal((await readMatchReplay(pool,gameId,room.id,0,100)).match.status,"finished");
 await pool.query("delete from game_matches where id=$1",[room.id]);
 assert.equal((await readOwnMatchReplay(pool,actors[1],room.code,0,100)).match.id,room.id);
 await pool.query("delete from users where id=$1",[actors[0]]);
 assert.deepEqual((await readMatchReplay(pool,gameId,room.id,0,100)).match,{...replay.match,players:replay.match.players.map(p=>p.userId===actors[0]?{...p,avatarUrl:null}:p)});
});

async function paidEnvironment(t, entry=5) {
 const env=await environment(t),{pool,actors,sessions}=env;
 const {transferCroins}=await import("../../dist/modules/wallet/service.js");
 for(const userId of actors){
   const account=(await pool.query("insert into wallet_accounts(user_id,kind) values($1,'user') returning id",[userId])).rows[0].id;
   await transferCroins(pool,{scope:"match-test-grant",idempotencyKey:randomUUID(),from:"00000000-0000-4000-8000-000000000001",to:account,actorAccountId:account,amount:30,reason:"Test grant",reference:userId});
 }
 env.cleanup.push(async()=>{
   const {refundAccountMatches}=await import("../../dist/modules/matches/economy.js");
   const client=await pool.connect();
   try{await client.query("begin");await client.query("select pg_advisory_xact_lock(47851234)");for(const actor of actors)await refundAccountMatches(client,actor);await client.query("commit");}catch(error){await client.query("rollback");throw error;}finally{client.release();}
 });
 const room=await createMatch(pool,actors[0],sessions[0],{requestId:randomUUID(),game:"flip7",capacity:4,options:{mode:"classic",brutal:false},entryAmount:entry});
 await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actors[0]]);
 await env.lobby(room.code,1,"join");
 const balances=async()=> (await pool.query("select user_id,balance from wallet_accounts where user_id=any($1::uuid[]) order by user_id",[actors])).rows;
 const confirm=async(index)=>{
   const current=await getMatch(pool,actors[index],room.code);
   return env.lobby(room.code,index,"confirm-entry",{expectedVersion:current.version,entryAmount:current.entryAmount});
 };
 return {...env,room,balances,confirm};
}

test("PostgreSQL: entrada confirmada, alterações invalidam aceite, saldo insuficiente e rollback sem cobrança parcial",async t=>{
 const {pool,actors,sessions,lobby,room,balances,confirm}=await paidEnvironment(t);
 const original=await balances();
 let current=await getMatch(pool,null,room.code);
 assert.deepEqual(room.confirmedUserIds,[actors[0]]);
 assert.deepEqual(current.confirmedUserIds,[actors[0]]);
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:current.version}),{code:"ENTRY_NOT_CONFIRMED"});
 current=await confirm(1);
 current=await lobby(room.code,0,"update",{expectedVersion:current.version,capacity:4,options:current.options,entryAmount:31});
 assert.deepEqual(current.confirmedUserIds,[actors[0]]);
 await assert.rejects(lobby(room.code,1,"confirm-entry",{expectedVersion:current.version,entryAmount:5}),{code:"VERSION_CONFLICT"});
 current=await confirm(1);
 await assert.rejects(lobby(room.code,0,"start",{expectedVersion:current.version}),{code:"INSUFFICIENT_FUNDS"});
 assert.deepEqual(await balances(),original);
 assert.equal((await pool.query("select 1 from game_match_stakes where match_id=$1",[room.id])).rowCount,0);
 current=await lobby(room.code,0,"update",{expectedVersion:current.version,capacity:4,options:current.options,entryAmount:5});
 current=await confirm(1);
 const input={commandId:randomUUID(),expectedVersion:current.version};
 const failingPool={connect:async()=>{const client=await pool.connect();return {query:(sql,args)=>sql.startsWith("insert into game_match_events")?Promise.reject(Error("event failure")):client.query(sql,args),release:()=>client.release()};}};
 await assert.rejects(lobbyAction(failingPool,actors[0],sessions[0],room.code,"start",input),/event failure/);
 assert.deepEqual(await balances(),original);
 const [started,retry]=await Promise.all([1,2].map(()=>lobbyAction(pool,actors[0],sessions[0],room.code,"start",input)));
 assert.deepEqual(wire(started),wire(retry));assert.equal(started.potTotal,10);assert.equal(started.settlement,"pending");
 assert.equal((await pool.query("select count(*)::int n from wallet_operations where scope='match-entry' and reference=$1",[room.code])).rows[0].n,2);
 assert.ok((await balances()).filter(a=>actors.slice(0,2).includes(a.user_id)).every(a=>a.balance==='25'));
 // Cleanup is an explicit administrative cancellation: refund before removal.
 const {refundAccountMatches}=await import("../../dist/modules/matches/economy.js");
 const client=await pool.connect();
 try{await client.query("begin");await client.query("select pg_advisory_xact_lock(47851234)");await refundAccountMatches(client,actors[0]);await refundAccountMatches(client,actors[0]);await client.query("commit");}finally{client.release();}
 assert.deepEqual(await balances(),original);
 assert.equal((await getMatch(pool,null,room.code)).settlement,"refunded");
});

test("PostgreSQL: prêmio autoritativo, pote vazio, retry e arquivo financeiro preservado",async t=>{
 const {pool,actors,sessions,lobby,room,confirm}=await paidEnvironment(t);
 let current=await confirm(1);
 let match=await lobby(room.code,0,"start",{expectedVersion:current.version});
 let lastInput,lastActor,lastResult;
 for(let step=0;match.status==='playing' && step<2000;step++){
   const state=(await pool.query("select state from game_matches where id=$1",[room.id])).rows[0].state;
   const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
   lastActor=actors.indexOf(match.participants.find(p=>p.seat===seat).userId);
   lastInput={commandId:randomUUID(),expectedVersion:match.version,action:botAction(state)};
   lastResult=await commandMatch(pool,actors[lastActor],sessions[lastActor],room.code,lastInput);match=lastResult.match;
 }
 assert.equal(match.status,'finished');assert.equal(match.settlement,'paid');
 assert.equal(match.payouts.reduce((sum,p)=>sum+p.amount,0),10);
 assert.ok(match.payouts.every(p=>match.state.players[p.seat].total===Math.max(...match.state.players.map(p=>p.total)) && !p.house));
 assert.deepEqual(wire(await commandMatch(pool,actors[lastActor],sessions[lastActor],room.code,lastInput)),wire(lastResult));
 assert.equal((await pool.query("select balance from wallet_accounts where id=(select pot_account_id from game_match_stakes where match_id=$1)",[room.id])).rows[0].balance,'0');
 const {readGameHistory}=await import("../../dist/modules/admin/match-history.js");
 const gameId=(await pool.query("select game_id from game_matches where id=$1",[room.id])).rows[0].game_id;
 await pool.query("delete from game_matches where id=$1",[room.id]);
 const archived=(await readGameHistory(pool,gameId,{offset:0,limit:20,q:room.code,status:'finished'})).items[0];
 assert.equal(archived.entryAmount,5);assert.deepEqual(archived.payouts,match.payouts);
});

test("PostgreSQL: empates com bot vão à casa; todos abandonam sem reembolso e liquidam pote",async t=>{
 const {pool,actors,sessions,lobby,room,confirm}=await paidEnvironment(t);
 const ready=await confirm(1);
 const started=await lobby(room.code,0,"start",{expectedVersion:ready.version});
 const first=await commandMatch(pool,actors[0],sessions[0],room.code,{commandId:randomUUID(),expectedVersion:started.version},true);
 const last=await commandMatch(pool,actors[1],sessions[1],room.code,{commandId:randomUUID(),expectedVersion:first.match.version},true);
 assert.equal(last.match.status,'abandoned');assert.equal(last.match.settlement,'paid');
 assert.equal(last.match.payouts.reduce((sum,p)=>sum+p.amount,0),10);assert.ok(last.match.payouts.every(p=>p.house));
 assert.equal((await pool.query("select balance from wallet_accounts where id=(select pot_account_id from game_match_stakes where match_id=$1)",[room.id])).rows[0].balance,'0');
 // Exercise tied seats directly in a rolled-back domain transaction, using real ledger constraints.
 const {settleMatch}=await import("../../dist/modules/matches/economy.js");
 const {fundMatch}=await import("../../dist/modules/matches/economy.js");
 const client=await pool.connect(),id=randomUUID();
 try{
   await client.query("begin");
   await fundMatch(client,id,room.code,5,started.participants);
   const state=structuredClone(started.state);state.phase='over';state.players.forEach((p,i)=>{p.total=200;p.kind=i===0?'normal':'human';});
   await settleMatch(client,id,room.code,'finished',state);await settleMatch(client,id,room.code,'finished',state);
   const result=(await client.query("select payouts from game_match_stakes where match_id=$1",[id])).rows[0].payouts;
   assert.deepEqual(result,[{seat:0,amount:5,house:true},{seat:1,amount:5,house:false}]);
 }finally{await client.query("rollback");client.release();}
});


test("PostgreSQL: inícios concorrentes em salas com Croins cobram somente a partida escolhida",async t=>{
 const {pool,actors,sessions,room,lobby,confirm,balances}=await paidEnvironment(t);
 const other=await createMatch(pool,actors[2],sessions[2],{requestId:randomUUID(),game:"flip7",capacity:4,options:{mode:"classic",brutal:false},entryAmount:5});
 await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),other.id,actors[2]]);
 await lobby(other.code,0,"join");
 const firstReady=await confirm(1);
 let secondReady=await getMatch(pool,null,other.code);
 secondReady=await lobby(other.code,0,"confirm-entry",{expectedVersion:secondReady.version,entryAmount:5});
 assert.ok(secondReady.confirmedUserIds.includes(actors[2]));
 const results=await Promise.allSettled([lobby(room.code,0,"start",{expectedVersion:firstReady.version}),lobby(other.code,2,"start",{expectedVersion:secondReady.version})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await balances()).find(a=>a.user_id===actors[0]).balance,'25');
 assert.equal((await pool.query("select count(*)::int n from game_match_stakes where match_id=any($1::uuid[])",[[room.id,other.id]])).rows[0].n,1);
});

test("PostgreSQL: novo host fica confirmado e antigo host volta a precisar aceitar a entrada",async t=>{
 const {actors,lobby,room}=await paidEnvironment(t);
 await lobby(room.code,2,"join");
 let current=await lobby(room.code,0,"leave");
 assert.equal(current.hostId,actors[1]);
 assert.deepEqual(current.confirmedUserIds,[actors[1]]);
 current=await lobby(room.code,0,"join");
 assert.deepEqual(current.confirmedUserIds,[actors[1]]);
 current=await lobby(room.code,1,"update",{expectedVersion:current.version,capacity:4,options:current.options,entryAmount:10});
 assert.deepEqual(current.confirmedUserIds,[actors[1]]);
 await assert.rejects(lobby(room.code,1,"start",{expectedVersion:current.version}),{code:"ENTRY_NOT_CONFIRMED"});
});

test("PostgreSQL: testes restritos a admin/convite, sem economia nem histórico oficial",async t=>{
 const {pool,actors,sessions}=await environment(t);
 const {inviteLobbyPlayer,stepTest}=await import('../../dist/modules/matches/service.js');
 const input={requestId:randomUUID(),game:'flip7',capacity:3,options:{mode:'classic',brutal:false},development:true,bots:1,onlyBots:false,entryAmount:0};
 await assert.rejects(createMatch(pool,actors[0],sessions[0],input),{code:'ADMIN_ONLY'});
 await pool.query("update users set role='admin' where id=$1",[actors[0]]);
 await assert.rejects(createMatch(pool,actors[0],sessions[0],{...input,entryAmount:5}),{code:'TEST_ECONOMY'});
 const room=await createMatch(pool,actors[0],sessions[0],input);
 assert.equal((await listLobbies(pool,null)).items.some(r=>r.id===room.id),false);
 await assert.rejects(getMatch(pool,actors[1],room.code),{code:'NOT_FOUND'});
 await assert.rejects(lobbyAction(pool,actors[1],sessions[1],room.code,'join',{commandId:randomUUID()}),{code:'NOT_FOUND'});
 await inviteLobbyPlayer(pool,actors[0],sessions[0],room.code,actors[1]);
 const joined=await lobbyAction(pool,actors[1],sessions[1],room.code,'join',{commandId:randomUUID()});
 assert.equal(joined.participants.length,2);
 await assert.rejects(lobbyAction(pool,actors[1],sessions[1],room.code,'start',{commandId:randomUUID(),expectedVersion:joined.version}),{code:'ADMIN_ONLY'});
 for(const actor of actors.slice(0,2))await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actor]);
 const started=await lobbyAction(pool,actors[0],sessions[0],room.code,'start',{commandId:randomUUID(),expectedVersion:joined.version});
 assert.equal(started.state.players.length,3);assert.equal(started.development,true);
 assert.equal((await listMatches(pool,null)).items.some(r=>r.id===room.id),false);
 assert.equal((await pool.query('select 1 from game_match_archives where id=$1',[room.id])).rowCount,0);
 assert.equal((await pool.query('select 1 from game_match_stakes where match_id=$1',[room.id])).rowCount,0);
 await assert.rejects(pool.query('update game_matches set development=false where id=$1',[room.id]));
 await assert.rejects(pool.query('update game_matches set entry_amount=5 where id=$1',[room.id]));
 await pool.query("update game_matches set status='abandoned' where id=$1",[room.id]);
 for(const game of ['flip7','love-letter']){
 const testRoom=await createMatch(pool,actors[0],sessions[0],{...input,game,requestId:randomUUID(),capacity:2,bots:2,onlyBots:true});
 const response=await lobbyAction(pool,actors[0],sessions[0],testRoom.code,'start',{commandId:randomUUID(),expectedVersion:testRoom.version});
 assert.ok(response);const state=await getMatch(pool,actors[0],testRoom.code);assert.equal(state.status,'playing');assert.ok(state.state.players.every(p=>p.kind==='normal'));
 const command={commandId:randomUUID(),expectedVersion:state.version};await stepTest(pool,actors[0],sessions[0],testRoom.code,command);await stepTest(pool,actors[0],sessions[0],testRoom.code,command);
 assert.equal((await getMatch(pool,actors[0],testRoom.code)).version,state.version+1);
 await pool.query("update game_matches set status='abandoned' where id=$1",[testRoom.id]);
 }
});


test("PostgreSQL: administrador mantém múltiplos lobbies e testes iniciados",async t=>{
 const {pool,actors,sessions}=await environment(t);
 await pool.query("update users set role='admin' where id=$1",[actors[0]]);
 const rooms=[];
 for(let i=0;i<3;i++)rooms.push(await createMatch(pool,actors[0],sessions[0],{requestId:randomUUID(),game:'flip7',capacity:2,options:{mode:'classic',brutal:false},development:true,bots:1,onlyBots:false,entryAmount:0}));
 assert.equal((await listLobbies(pool,actors[0])).testLobbies.length,3);
 for(const room of rooms){await pool.query("insert into match_presence(id,match_id,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",[randomUUID(),room.id,actors[0]]);const started=await lobbyAction(pool,actors[0],sessions[0],room.code,'start',{commandId:randomUUID(),expectedVersion:room.version});assert.equal(started.status,'playing');}
 const directory=await listLobbies(pool,actors[0]);
 assert.equal(directory.tests.filter(r=>r.status==='playing').length,3);
 assert.equal(directory.testMatches.length,3);
 for(const summary of directory.testMatches){assert.equal('state' in summary,false);assert.equal('deck' in summary,false);assert.equal(summary.options.mode,'classic');assert.equal(summary.participants.length,1);assert.equal(summary.bots,1);}
 const {endTest}=await import('../../dist/modules/matches/service.js');const first=await getMatch(pool,actors[0],rooms[0].code);await endTest(pool,actors[0],sessions[0],first.code,{commandId:randomUUID(),expectedVersion:first.version});
 assert.equal((await listLobbies(pool,actors[0])).tests.length,2);assert.equal((await listMatches(pool,null)).items.some(r=>rooms.some(s=>s.id===r.id)),false);
});
