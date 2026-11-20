import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMatchSchema, matchCommandSchema, matchSchema, updateLobbySchema, kickMatchSchema } from "@croebet/shared";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { flip7Driver } from "../dist/modules/games/flip7/driver.js";
import { createGame, botAction } from "../dist/modules/games/flip7/engine.js";
import { execute } from "../dist/modules/matches/execution.js";

const setup = [{ name: "Impostor", kind: "human" }, { name: "Bot", kind: "normal" }];
const input = { requestId: randomUUID(), game: "flip7", capacity:6, options: { mode: "classic", brutal: false } };
test("contratos não aceitam estado do cliente, seed, Croins, comandos internos ou cartas duplicadas", () => {
  assert.ok(createMatchSchema.safeParse(input).success);
  for (const capacity of [1,13,2.5]) assert.equal(createMatchSchema.safeParse({...input,capacity}).success,false);
  for (const extra of [{ seed: 1 }, { stake: 5 }, { state: {} }, {setup}]) assert.equal(createMatchSchema.safeParse({ ...input, ...extra }).success,false);
  for (const action of [{ type: "step" },{ type: "next" },{type:"replace",seat:0},{ type: "cards", cards: [1,1] },{ type: "draw", card: 10 }]) assert.equal(matchCommandSchema.safeParse({ commandId: randomUUID(), expectedVersion: 1, action }).success,false);
  assert.equal(updateLobbySchema.safeParse({commandId:randomUUID(),expectedVersion:1,capacity:4,options:{mode:"classic",brutal:true}}).success,false);
  assert.equal(kickMatchSchema.safeParse({commandId:randomUUID(),expectedVersion:1,targetUserId:"another"}).success,false);
});
test("substituição preserva cartas e decisões especiais e automações continuam nos três modos",()=>{
 for(const options of [{mode:"classic",brutal:false},{mode:"vengeance",brutal:false},{mode:"vengeance",brutal:true}]){
  let state=createGame(Array.from({length:3},(_,i)=>({name:`P${i}`,kind:"human"})),42,options);
  let steps=0;
  while(!flip7Driver.finished(state)){
   const automatic=flip7Driver.automatic(state);
   if(automatic){state=flip7Driver.apply(state,automatic);continue;}
   assert.ok(++steps<1000);
   const seat=state.bonusChoice ?? state.pending?.source ?? state.turn;
   const original=structuredClone(state),next=flip7Driver.replace(state,seat);
   assert.deepEqual(state,original);assert.deepEqual(next.players[seat].cards,state.players[seat].cards);
   assert.equal(next.players[seat].total,state.players[seat].total);assert.deepEqual(next.pending,state.pending);assert.deepEqual(next.bonusChoice,state.bonusChoice);
   assert.equal(next.players[seat].kind,"normal");assert.ok(flip7Driver.automatic(next));
   assert.ok(flip7Driver.parse(execute(flip7Driver,next,1).state));
   state=flip7Driver.apply(state,botAction(state));
  }
 }
});
test("driver usa nome da conta, RNG seguro e projeção sem seed/baralho em todos os frames", () => {
  const first = flip7Driver.create({setup,options:input.options},"Marco");
  assert.equal(first.players[0].name,"Marco");
  assert.notDeepEqual(first.deck,flip7Driver.create({setup,options:input.options},"Marco").deck);
  const result = execute(flip7Driver,first,1);
  assert.ok(result.frames.length > 0);
  assert.equal(flip7Driver.automatic(result.state),null);
  for (const state of [result.before, ...result.frames.map(frame => frame.state)]) {
    assert.equal(Object.hasOwn(state,"deck"),false);
    assert.equal(Object.hasOwn(state,"seed"),false);
    assert.ok(Number.isInteger(state.deckCount));
  }
  assert.equal(matchSchema.safeParse({ id: randomUUID(),code:"ABCDEF123456",game:"flip7",rulesVersion:1,version:result.version,status:result.status,state:result.state }).success,false);
});
test("executor resolve bots/compras obrigatórias até uma decisão humana e conserva cartas nos três modos", () => {
  for (const options of [{ mode: "classic", brutal: false },{ mode: "vengeance", brutal: false },{ mode: "vengeance", brutal: true }]) {
    let result = execute(flip7Driver, createGame(setup,42,options),1);
    for (let i = 0; i < 15 && result.status !== "finished"; i++) {
      assert.equal(flip7Driver.automatic(result.state),null);
      result = execute(flip7Driver,result.state,result.version,botAction(result.state));
      assert.ok(flip7Driver.parse(result.state));
    }
    const state = result.state;
    const before = structuredClone(state);
    assert.throws(() => execute(flip7Driver,state,result.version,{ type:"cards", cards:[999] }),/ILLEGAL_ACTION/);
    assert.deepEqual(state,before);
  }
});
test("executor compartilhado aceita um motor sem cartas, rodadas ou pontuação do Flip 7", () => {
  const driver = { create: () => 0, parse: state => state, project: state => ({ remaining: 2-state }), apply: state => state+1, automatic: state => state === 1 ? "advance" : null, finished: state => state === 2 };
  const result = execute(driver,0,7,"advance");
  assert.equal(result.status,"finished"); assert.equal(result.version,9);
  assert.deepEqual(result.frames.map(frame => frame.state.remaining),[1,0]);
});
test("rotas exigem sessão e herdam Origin/CSRF antes de permitir escritas", async t => {
  const app = createApp(async () => {}); t.after(() => app.close());
  const client={query:async()=>({rows:[]}),release:()=>{}};
  await app.register(authRoutes,{ pool: { query: async () => ({ rows:[{ environment:"test" }] }),connect:async()=>client }, config:{ APP_ENV:"test" } });
  for(const url of ["/api/v1/matches","/api/v1/matches/lobbies"]){
    const response=await app.inject(url);
    assert.equal(response.statusCode,200);
    assert.deepEqual(response.json().items,[]);
  }
  assert.equal((await app.inject("/api/v1/matches/ABCDEF123456")).statusCode,404);
  assert.equal((await app.inject("/api/v1/matches/ABCDEF123456/players")).statusCode,401);
  for(const url of ["/api/v1/matches/presence","/api/v1/matches/ABCDEF123456/invite","/api/v1/matches/ABCDEF123456/decline"]){
    assert.equal((await app.inject({method:"POST",url,payload:{}})).statusCode,403);
  }
  assert.equal((await app.inject({ method:"POST",url:"/api/v1/matches",payload:input })).statusCode,403);
});
