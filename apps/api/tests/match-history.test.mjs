import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { historyItem, readGameHistory, readMatchReplay, readOwnMatchReplay } from "../dist/modules/admin/match-history.js";
import { flip7Driver } from "../dist/modules/games/flip7/driver.js";
import { managementRoutes } from "../dist/modules/admin/routes.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
const gameId=randomUUID(),id=randomUUID();
function row(status="finished") {
 const state=flip7Driver.project(flip7Driver.create({setup:[{name:"Um",kind:"human"},{name:"Dois",kind:"human"}],options:{mode:"classic",brutal:false}},"Um"));
 state.phase="over";state.players.forEach(p=>p.total=210);
 return {id,game_id:gameId,code:"ABCDEF123456",rules_version:1,status,options:{mode:"classic",brutal:false},participants:[{seat:0,userId:randomUUID(),name:"Nome original"},{seat:1,userId:null,name:"Dois"}],state,started_at:new Date(),ended_at:new Date(),frame_count:3};
}
test("histórico mantém identidade, empates e resultado sem conceder vitória a abandonos",()=>{
 const saved=row();saved.state.players[1].kind="normal";
 const result=historyItem(saved);
 assert.equal(result.players[0].name,"Nome original");assert.deepEqual(result.players.map(p=>p.winner),[true,true]);
 assert.equal(result.players[1].bot,true);assert.equal(result.players[1].userId,null);
 assert.deepEqual(historyItem({...saved,status:"abandoned"}).players.map(p=>p.winner),[false,false]);
 assert.equal("state" in result,false);
});
test("replay restringe jogo/partida e reverte consulta em caso de ausência",async()=>{
 const calls=[];
 const pool={connect:async()=>({query:async(sql,params)=>{calls.push([sql,params]);return {rows:[]};},release:()=>calls.push(["release"])})};
 await assert.rejects(readMatchReplay(pool,gameId,id,0,100),{code:"NOT_FOUND"});
 assert.deepEqual(calls[1][1],[gameId,id]);assert.equal(calls.at(-2)[0],"rollback");assert.equal(calls.at(-1)[0],"release");
});
test("visitantes e usuários comuns não acessam histórico administrativo",async()=>{
 for(const actor of [null,{id:randomUUID(),role:"user"}]) {
  const app=Fastify();await app.register(cookie);
  await app.register(managementRoutes,{pool:{query:()=>{throw Error("Não deve consultar histórico");}},sessionName:"session",current:async()=>actor,limit:async()=>true});
  for(const url of [`/api/v1/admin/games/${gameId}/matches`,`/api/v1/admin/games/${gameId}/matches/${id}`])assert.equal((await app.inject({url})).statusCode,404);
  await app.close();
 }
});

test("histórico resolve avatares em lote e preserva identidade sem conta ou imagem", async () => {
 const first=row(), extra=row();
 const calls=[];
 const avatarKey=`${first.participants[0].userId}.webp`;
 const pool={query:async(sql,params)=>{
   calls.push([sql,params]);
   return {rows:sql.startsWith("select id,avatar_key")?[{id:first.participants[0].userId,avatar_key:avatarKey}]:[first,extra]};
 }};
 const result=await readGameHistory(pool,gameId,{offset:0,limit:1,q:"",status:"all"});
 assert.equal(result.hasMore,true);assert.equal(result.items.length,1);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1][1],[[first.participants[0].userId]]);
 assert.equal(result.items[0].players[0].avatarUrl,`/api/v1/avatars/${avatarKey}`);
 assert.equal(result.items[0].players[0].name,"Nome original");
 assert.equal(result.items[0].players[1].avatarUrl,null);
 assert.equal(historyItem(first).players[0].avatarUrl,null);
});

test("replay pessoal usa o arquivo, inclui projeção pública e pagina frames após autorizar", async () => {
 const saved=row();const actor=saved.participants[0].userId;
 const calls=[];
 const pool={connect:async()=>({query:async(sql,params)=>{
   calls.push([sql,params]);
   if(sql.startsWith("select a.*")){
     assert.ok(sql.includes("p->>'userId'=$1::text"));assert.deepEqual(params,[actor,saved.code]);
     assert.ok(sql.includes("a.code=$2"));
     return {rows:[saved]};
   }
   if(sql.startsWith("select event")){assert.deepEqual(params,[id,101,100]);return {rows:[]};}
   return {rows:[]};
 },release(){}})};
 const result=await readOwnMatchReplay(pool,actor,saved.code,100,100);
 assert.equal(result.match.id,id);assert.equal(result.offset,100);
 assert.deepEqual(result.finalState,saved.state);
 assert.equal(result.match.players[0].name,"Nome original");
 assert.equal(JSON.stringify(result).includes('"deck"'),false);
 assert.equal(calls.at(-1)[0],"commit");
});

test("interna prioriza nome de exibição, depois username, sem alterar arquivo ou frames", async () => {
 const saved=row();
 const before=structuredClone(saved);
 const userId=saved.participants[0].userId;
 let displayName="Nome da pessoa";
 const pool={connect:async()=>({query:async sql=>{
   if(sql.startsWith("select a.*"))return {rows:[saved]};
   if(sql.startsWith("select id,avatar_key"))return {rows:[{id:userId,display_name:displayName,username:"login",avatar_key:null}]};
   return {rows:[]};
 },release(){}})};
 assert.equal((await readMatchReplay(pool,gameId,id,0,100)).match.players[0].name,"Nome da pessoa");
 displayName="   ";
 const replay=await readMatchReplay(pool,gameId,id,0,100);
 assert.equal(replay.match.players[0].name,"login");
 assert.equal(replay.match.players[1].name,"Dois");
 assert.deepEqual(replay.finalState,saved.state);
 assert.deepEqual(saved,before);
 assert.equal(historyItem(saved).players[0].name,"Nome original");
});
