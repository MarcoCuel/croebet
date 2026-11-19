import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMatchSchema, matchCommandSchema, matchSchema } from "@croebet/shared";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { flip7Driver } from "../dist/modules/games/flip7/driver.js";
import { createGame, botAction } from "../dist/modules/games/flip7/engine.js";
import { execute } from "../dist/modules/matches/execution.js";

const setup = [{ name: "Impostor", kind: "human" }, { name: "Bot", kind: "normal" }];
const input = { requestId: randomUUID(), game: "flip7", setup, options: { mode: "classic", brutal: false } };
test("contratos não aceitam estado do cliente, seed, Croins, comandos internos ou cartas duplicadas", () => {
  assert.ok(createMatchSchema.safeParse(input).success);
  for (const extra of [{ seed: 1 }, { stake: 5 }, { state: {} }]) assert.equal(createMatchSchema.safeParse({ ...input, ...extra }).success,false);
  for (const action of [{ type: "step" },{ type: "next" },{ type: "cards", cards: [1,1] },{ type: "draw", card: 10 }]) assert.equal(matchCommandSchema.safeParse({ commandId: randomUUID(), expectedVersion: 1, action }).success,false);
});
test("driver usa nome da conta, RNG seguro e projeção sem seed/baralho em todos os frames", () => {
  const first = flip7Driver.create(input,"Marco");
  assert.equal(first.players[0].name,"Marco");
  assert.notDeepEqual(first.deck,flip7Driver.create(input,"Marco").deck);
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
  await app.register(authRoutes,{ pool: { query: async () => ({ rows:[{ environment:"test" }] }) }, config:{ APP_ENV:"test" } });
  assert.equal((await app.inject("/api/v1/matches")).statusCode,401);
  assert.equal((await app.inject({ method:"POST",url:"/api/v1/matches",payload:input })).statusCode,403);
});
