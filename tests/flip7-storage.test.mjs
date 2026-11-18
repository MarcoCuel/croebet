import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticAction, botAction, createGame, transition } from "../features/games/flip7/engine.ts";
import { matchStorageKey, decodeMatch, readMatch, readMatches, removeMatch, saveMatch } from "../features/games/flip7/match-storage.ts";

const code = "ABCDEF123456";
const setup = [{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }];
const snapshot = game => ({ version: 1, code, game });
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test("retoma cada código sem substituir outras partidas e migra o formato antigo", () => {
  const storage = memoryStorage();
  const first = snapshot(transition(createGame(setup, 42), { type: "draw" }));
  saveMatch(first, storage);
  assert.deepEqual(readMatch(storage), first);
  const second = { ...snapshot(createGame(setup, 73)), code: "123456ABCDEF" };
  saveMatch(second, storage);
  assert.deepEqual(readMatch(storage), second);
  assert.deepEqual(readMatch(storage, first.code), first);
  assert.deepEqual(readMatches(storage), [first, second]);
  const updated = { ...first, game: transition(first.game, { type: "draw" }) };
  saveMatch(updated, storage);
  assert.deepEqual(readMatch(storage, second.code), second);
  assert.deepEqual(readMatch(storage, first.code), updated);
  removeMatch(first.code, storage);
  assert.deepEqual(readMatches(storage), [second]);
  storage.setItem(matchStorageKey, JSON.stringify(first));
  saveMatch(second, storage);
  assert.deepEqual(readMatches(storage), [first, second]);
  removeMatch(second.code, storage);
  removeMatch(first.code, storage);
  assert.equal(storage.getItem(matchStorageKey), null);
  assert.equal(readMatch(memoryStorage()), null);
});

test("snapshots preservam ações pendentes, compras forçadas, resumo e fim sem alterar a próxima jogada", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    let game = createGame(setup, seed);
    for (let step = 0; step < 2000; step++) {
      const loaded = decodeMatch(JSON.stringify(snapshot(game)), code);
      assert.ok(loaded);
      assert.deepEqual(loaded.game, JSON.parse(JSON.stringify(game)));
      if (game.pending) seen.add("pending");
      if (game.forced) seen.add("forced");
      seen.add(game.phase);
      if (game.phase === "over") break;
      const action = game.phase === "summary" ? { type: "next" } : automaticAction(game) ?? botAction(game);
      const next = transition(game, action);
      assert.equal(JSON.stringify(transition(loaded.game, action)), JSON.stringify(next));
      game = next;
    }
  }
  assert.deepEqual([...seen].sort(), ["forced", "over", "pending", "playing", "summary"]);
});

test("dados inválidos ou incompatíveis são rejeitados sem apagar partidas", () => {
  const valid = snapshot(createGame(setup, 42));
  const broken = ["{", "null", JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, code: "outro" })];
  for (const mutate of [
    game => { game.turn = 99; },
    game => { game.players[0].cards = [{}]; },
    game => { game.deck.pop(); },
    game => { game.deck[0] = game.deck[1]; },
    game => { game.forced = { target: 100, remaining: 3 }; },
    game => { game.log = [{ player: 10, message: "Inválido" }]; },
  ]) {
    const copy = structuredClone(valid);
    mutate(copy.game);
    broken.push(JSON.stringify(copy));
  }
  for (const raw of broken) assert.equal(decodeMatch(raw, code), null);
});

test("falha ao gravar não substitui a referência da partida salva", () => {
  const writes = [];
  assert.throws(() => saveMatch(snapshot(createGame(setup, 42)), {
    getItem() { return null; },
    setItem(key) { writes.push(key); throw new Error("Quota excedida"); },
  }));
  assert.deepEqual(writes, [matchStorageKey]);
});

test("rejeita cartas adulteradas e estados que travariam a retomada", () => {
  const mutations = [
    game => { game.deck[0].value = game.deck[0].value === 12 ? 11 : 12; },
    game => { game.players[0].status = "frozen"; },
    game => { game.forced = { target: 1, remaining: 3 }; game.players[1].status = "busted"; },
    game => {
      const index = game.deck.findIndex(card => card.type === "chance");
      game.pending = { source: 0, card: game.deck.splice(index, 1)[0] };
    },
    game => {
      const index = game.deck.findIndex(card => card.type === "freeze");
      game.pending = { source: 0, card: game.deck.splice(index, 1)[0], give: true };
    },
    game => {
      const index = game.deck.findIndex(card => card.type === "freeze");
      game.pending = { source: 0, card: game.deck.splice(index, 1)[0] };
      game.players.forEach(player => { player.status = "stayed"; });
    },
    game => { game.phase = "summary"; game.forced = { target: 1, remaining: 3 }; },
  ];
  for (const mutate of mutations) {
    const saved = snapshot(createGame(setup, 42));
    mutate(saved.game);
    assert.equal(decodeMatch(JSON.stringify(saved), code), null, mutate.toString());
  }
});

test("histórico conserva todas as jogadas entre rodadas e ao retomar a partida", () => {
  let game = createGame(setup, 42);
  let steps = 0;
  while (game.phase !== "over" && steps++ < 2000) {
    const previous = game.log;
    const action = game.phase === "summary" ? { type: "next" } : automaticAction(game) ?? botAction(game);
    game = transition(game, action);
    assert.ok(game.log.length >= previous.length);
    assert.deepEqual(game.log.slice(game.log.length - previous.length), previous);
  }
  assert.equal(game.phase, "over");
  assert.ok(game.round > 1);
  assert.ok(game.log.length > 6);
  assert.equal(game.log.at(-1).message, "Partida iniciada.");
  const storage = memoryStorage();
  saveMatch(snapshot(game), storage);
  assert.deepEqual(readMatch(storage).game.log, JSON.parse(JSON.stringify(game.log)));
});
