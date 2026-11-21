import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getRoomSync } from "../dist/modules/matches/service.js";
import { flip7Driver } from "../dist/modules/games/flip7/driver.js";
import { loveDriver } from "../dist/modules/games/love-letter/driver.js";
import { createLove } from "../dist/modules/games/love-letter/engine.js";
import { execute } from "../dist/modules/matches/execution.js";

function fixture({ game = "flip7", version = 5, events = [] } = {}) {
  const setup = [{ name: "Ana", kind: "human" }, { name: "Beto", kind: "human" }];
  const state = game === "flip7"
    ? execute(flip7Driver, flip7Driver.create({ setup, options: { mode: "classic", brutal: false } }, "Ana"), 1).state
    : createLove(setup, "classic");
  const id = randomUUID(), actor = randomUUID();
  const row = {
    id, code: "ABCDEF123456", game_slug: game, owner_id: actor, created_by: actor,
    rules_version: 1, version, status: "playing", state, capacity: 2,
    development: game !== "flip7", bots: 0, only_bots: false, entry_amount: "0",
    options: game === "flip7" ? { mode: "classic", brutal: false } : { mode: "classic" },
  };
  const queries = [];
  const client = {
    release() {},
    async query(sql) {
      queries.push(sql);
      if (sql.includes("select * from game_matches")) return { rows: [row] };
      if (sql.includes("select p.match_id")) return { rows: [{ match_id: id, user_id: actor, username: "Ana", display_name: "Ana", avatar_key: null, seat: 0 }] };
      if (sql.includes("select 1 where")) return { rows: [{}] };
      if (sql.includes("select event from game_match_events")) return { rows: events.map(event => ({ event })) };
      return { rows: [] };
    },
  };
  return { pool: { connect: async () => client }, row, actor, queries };
}

test("voltar à página carrega o estado confirmado, sem repetir eventos nem executar jogadas", async () => {
  const { pool, row, actor, queries } = fixture();
  const before = structuredClone(row);
  const first = await getRoomSync(pool, actor, row.code);
  const second = await getRoomSync(pool, actor, row.code);
  assert.equal(first.reset, true);
  assert.deepEqual(first.frames, []);
  assert.equal(first.room.version, row.version);
  assert.deepEqual(first, second);
  assert.deepEqual(row, before);
  assert.equal(queries.some(sql => /\b(insert|update|delete)\b/i.test(sql)), false);
  assert.equal(queries.some(sql => sql.includes("select event")), false);
  assert.equal("deck" in first.room.state, false);
  assert.equal("seed" in first.room.state, false);
});

test("reconexão recupera apenas os eventos posteriores à versão conhecida", async () => {
  const saved = fixture();
  const publicState = flip7Driver.project(saved.row.state);
  const events = [4, 5].map(version => ({ version, action: { type: "draw" }, state: publicState }));
  const { pool, row, actor } = fixture({ events });
  const sync = await getRoomSync(pool, actor, row.code, 3);
  assert.equal(sync.reset, false);
  assert.deepEqual(sync.frames.map(frame => frame.version), [4, 5]);
  assert.equal(sync.room.version, 5);
});

test("lacunas ou eventos fora de ordem recuperam snapshot em vez de uma sequência incompleta", async () => {
  const state = flip7Driver.project(fixture().row.state);
  for (const versions of [[5], [5, 4], [4], []]) {
    const events = versions.map(version => ({ version, action: { type: "draw" }, state }));
    const { pool, row, actor } = fixture({ events });
    const sync = await getRoomSync(pool, actor, row.code, 3);
    assert.equal(sync.reset, true);
    assert.deepEqual(sync.frames, []);
    assert.equal(sync.room.version, 5);
  }
});

test("versão do cliente à frente do servidor é corrigida pelo snapshot confirmado", async () => {
  const { pool, row, actor, queries } = fixture();
  const sync = await getRoomSync(pool, actor, row.code, 99);
  assert.equal(sync.reset, true);
  assert.equal(sync.room.version, 5);
  assert.deepEqual(sync.frames, []);
  assert.equal(queries.some(sql => sql.includes("select event")), false);
});

test("mais de mil eventos pendentes recuperam snapshot sem uma fila ilimitada", async () => {
  const state = flip7Driver.project(fixture().row.state);
  const events = Array.from({ length: 1001 }, (_, i) => ({ version: i + 2, action: { type: "draw" }, state }));
  const { pool, row, actor } = fixture({ version: 1002, events });
  const sync = await getRoomSync(pool, actor, row.code, 1);
  assert.equal(sync.reset, true);
  assert.deepEqual(sync.frames, []);
  assert.equal(sync.room.version, 1002);
});

test("retomada de jogo com cartas privadas continua projetada para o destinatário", async () => {
  const { pool, row, actor } = fixture({ game: "love-letter" });
  const sync = await getRoomSync(pool, actor, row.code, 3);
  assert.equal(sync.reset, true);
  assert.deepEqual(sync.frames, []);
  assert.ok(sync.room.state.players[0].hand);
  assert.equal(sync.room.state.players[1].hand, null);
  assert.equal("deck" in sync.room.state, false);
});

test("executor comum aguarda uma decisão humana e não inventa ações ao ser retomado", () => {
  const driver = {
    parse: value => value,
    project: value => ({ waiting: value.waiting }),
    automatic: () => null,
    finished: () => false,
    apply() { throw new Error("Nenhuma ação deveria ser executada"); },
  };
  const state = { waiting: true };
  const resumed = execute(driver, state, 8);
  assert.equal(resumed.version, 8);
  assert.equal(resumed.status, "playing");
  assert.deepEqual(resumed.frames, []);
  assert.deepEqual(resumed.state, state);
});


test("Love Letter sincroniza frames públicos contínuos e mantém a mão privada só no snapshot do jogador", async () => {
  const sample = fixture({ game: "love-letter" });
  const publicState = loveDriver.project(sample.row.state);
  const events = [4, 5].map(version => ({ version, action: { type: "step" }, state: publicState }));
  const { pool, row, actor } = fixture({ game: "love-letter", events });
  const sync = await getRoomSync(pool, actor, row.code, 3);
  assert.equal(sync.reset, false);
  assert.deepEqual(sync.frames.map(frame => frame.version), [4, 5]);
  for (const frame of sync.frames) {
    assert.ok(frame.state.players.every(player => player.hand === null));
    assert.deepEqual(frame.state.privateInfo, []);
    assert.deepEqual(frame.state.legalActions, []);
    assert.deepEqual(frame.action, { type: "step" });
  }
  assert.ok(sync.room.state.players[0].hand);
  assert.equal(sync.room.state.players[1].hand, null);
});
