import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { historyItem, readMatchReplay } from "../dist/modules/admin/match-history.js";
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
