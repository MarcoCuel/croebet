import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame, transition } from "../../api/src/modules/games/flip7/engine.ts";
import { drawTiming, forcedActionPresentation, scenePresentationDuration } from "../features/games/flip7/action-presentation.ts";
import { validateState } from "../../api/src/modules/games/flip7/state.ts";

function scenario(type, draws) {
  const game = createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42, { mode: "vengeance", brutal: false });
  const take = (type, value = 0) => game.deck.splice(game.deck.findIndex(card => card.type === type && card.value === value), 1)[0];
  game.players.forEach((player, index) => { player.cards = [take("number", 8 + index)]; player.hasDrawn = true; });
  const card = take(type);
  game.pending = { source: 0, card };
  game.deck.push(...draws.map(([type, value]) => take(type, value)).reverse());
  return { game: transition(game, { type: "target", target: 1 }), card };
}

test("Compre 4 identifica a carta durante todas as compras e restaura sua apresentação após reload", () => {
  let { game, card } = scenario("four", [["number", 1], ["number", 2], ["number", 3], ["number", 4]]);
  for (let remaining = 4; remaining > 0; remaining--) {
    assert.equal(game.forced.remaining, remaining);
    const before = JSON.stringify(game);
    assert.deepEqual(forcedActionPresentation(game), { card, target: 1 });
    assert.equal(JSON.stringify(game), before);
    const restored = validateState(JSON.parse(JSON.stringify(game)));
    assert.ok(restored);
    assert.deepEqual(forcedActionPresentation(restored), { card, target: 1 });
    game = transition(game, { type: "step" });
  }
  assert.equal(forcedActionPresentation(game), null);
  assert.equal(game.players[1].cards.filter(card => card.type === "number").length, 5);
});

test("Só mais uma mantém a ação identificada até a compra e a parada do destinatário", () => {
  const { game, card } = scenario("one", [["number", 1]]);
  assert.deepEqual(forcedActionPresentation(game), { card, target: 1 });
  const next = transition(game, { type: "step" });
  assert.equal(next.players[1].status, "stayed");
  assert.equal(next.players[1].cards.length, 2);
  assert.equal(forcedActionPresentation(next), null);
});

test("estouro encerra a ação e ações compradas na sequência não substituem a carta original", () => {
  let { game, card } = scenario("four", [["four"], ["number", 9]]);
  game = transition(game, { type: "step" });
  assert.equal(game.queue.length, 1);
  assert.deepEqual(forcedActionPresentation(game), { card, target: 1 });
  game = transition(game, { type: "step" });
  assert.equal(game.players[1].status, "busted");
  assert.equal(forcedActionPresentation(game), null);
});

test("partidas sem compra forçada e o modo Clássico não ganham cartas visuais extras", () => {
  assert.equal(forcedActionPresentation(null), null);
  assert.equal(forcedActionPresentation(createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42)), null);
});


test("3D mantém a cadência da compra inicial, revelação normal e ações sem movimento", () => {
  const before = createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42);
  const first = transition(before, { type: "draw" });
  assert.equal(scenePresentationDuration(before, first), drawTiming.extraction + drawTiming.reveal + (drawTiming.initialReading + drawTiming.delivery));
  const drawn = { ...before, players: before.players.map(player => ({ ...player, hasDrawn: true })) };
  assert.equal(scenePresentationDuration(drawn, first), drawTiming.extraction + drawTiming.reveal + (drawTiming.reading + drawTiming.delivery));
  assert.ok(scenePresentationDuration(first, { ...first, turn: 1 }) > 0, "passar o turno também exige tempo de leitura");
  const special = { id: 999, type: "freeze", value: 0 };
  const pending = { ...first, lastDraw: special, pending: { source: 0, card: special } };
  assert.equal(scenePresentationDuration(before, pending), drawTiming.extraction + drawTiming.reveal + drawTiming.initialReading);
});
