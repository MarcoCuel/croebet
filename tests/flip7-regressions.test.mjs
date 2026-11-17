import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticAction, botAction, createDeck, createGame, numbers, score, targets, transition } from "../features/games/flip7/engine.ts";
import { decodeMatch } from "../features/games/flip7/match-storage.ts";

const setup = [{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }];
// Move real cards instead of inventing IDs: every fixture keeps the complete deck.
function fixture(draws = []) {
  const game = createGame(setup, 42);
  const take = (type, value = 0) => {
    const index = game.deck.findIndex(card => card.type === type && card.value === value);
    assert.ok(index >= 0, `carta indisponível: ${type} ${value}`);
    return game.deck.splice(index, 1)[0];
  };
  const ordered = draws.map(([type, value]) => take(type, value));
  game.deck.unshift(...ordered.reverse());
  // Other cards become discards, so the requested draws come first and reshuffle remains testable.
  game.discard.push(...game.deck.splice(ordered.length));
  const give = (seat, type, value = 0) => {
    const index = game.discard.findIndex(card => card.type === type && card.value === value);
    assert.ok(index >= 0);
    game.players[seat].cards.push(...game.discard.splice(index, 1));
    game.players[seat].hasDrawn = true;
  };
  return { game, give };
}
function conserved(game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.cards), ...game.queue.map(p => p.card), ...(game.pending ? [game.pending.card] : [])];
  assert.deepEqual(cards.toSorted((a, b) => a.id - b.id), createDeck());
}

test("configuração aceita 2 a 12 jogadores, exige pessoa e normaliza nomes", () => {
  for (const count of [0, 1, 13]) assert.throws(() => createGame(Array.from({ length: count }, () => setup[0])));
  assert.throws(() => createGame([{ name: "A", kind: "easy" }, { name: "B", kind: "hard" }]));
  const game = createGame(Array.from({ length: 12 }, (_, i) => ({ name: i ? " ".repeat(i) : "  abcdefghijklmnopqrstuvwxyz  ", kind: "human" })), 0);
  assert.equal(game.players.length, 12);
  assert.equal(game.players[0].name, "abcdefghijklmnopqrstuvwx");
  assert.equal(game.players[11].name, "Jogador 12");
  conserved(game);
});

test("zero permite parar e modificadores não contam para os sete números", () => {
  const { game, give } = fixture([["number", 0]]);
  give(0, "double"); give(0, "bonus", 10);
  assert.equal(transition(game, { type: "stay" }), game);
  let next = transition(game, { type: "draw" });
  assert.equal(next.phase, "playing");
  assert.equal(score(next.players[0]), 10);
  next.players[1].status = "stayed"; next.turn = 0;
  next = transition(next, { type: "stay" });
  assert.equal(next.phase, "summary");
  assert.equal(next.players[0].total, 10);
  conserved(next);
});

test("Congelar pode atingir o próprio comprador e pula participantes inativos", () => {
  const { game, give } = fixture([["freeze"]]); give(0, "number", 8);
  let next = transition(game, { type: "draw" });
  for (const target of [-1, 2, 0.5, NaN]) assert.equal(transition(next, { type: "target", target }), next);
  next = transition(next, { type: "target", target: 0 });
  assert.equal(next.players[0].status, "frozen");
  assert.equal(score(next.players[0]), 8); assert.equal(next.turn, 1);
  assert.deepEqual(targets(next), []);
  conserved(next);
});

test("segunda chance extra sem destinatário é descartada e não bloqueia o turno", () => {
  const { game, give } = fixture([["chance"]]);
  give(0, "chance"); give(1, "chance");
  const next = transition(game, { type: "draw" });
  assert.equal(next.pending, null); assert.equal(next.turn, 1);
  assert.equal(next.players[0].cards.filter(c => c.type === "chance").length, 1);
  conserved(next);
});

test("Compre 3 descarta proteção extra, consome proteção no repetido e completa a sequência", () => {
  const { game, give } = fixture([["three"], ["chance"], ["number", 12], ["number", 9]]);
  give(1, "chance"); give(1, "number", 12);
  let next = transition(transition(game, { type: "draw" }), { type: "target", target: 1 });
  for (let i = 0; i < 3; i++) next = transition(next, { type: "step" });
  assert.equal(next.players[1].status, "playing");
  assert.equal(next.players[1].cards.some(c => c.type === "chance"), false);
  assert.deepEqual(numbers(next.players[1]).map(c => c.value), [12, 9]);
  assert.equal(next.forced, null); assert.equal(next.pending, null);
  conserved(next);
});

test("ações encadeadas no Compre 3 respeitam a fila e resolvem só depois das compras", () => {
  const { game } = fixture([["three"], ["three"], ["freeze"], ["number", 2], ["number", 3], ["number", 4], ["number", 5]]);
  let next = transition(transition(game, { type: "draw" }), { type: "target", target: 1 });
  for (let i = 0; i < 3; i++) next = transition(next, { type: "step" });
  assert.equal(next.pending.card.type, "three"); assert.equal(next.queue[0].card.type, "freeze");
  next = transition(next, { type: "target", target: 0 });
  assert.equal(next.pending, null);
  for (let i = 0; i < 3; i++) next = transition(next, { type: "step" });
  assert.equal(next.pending.card.type, "freeze");
  next = transition(next, { type: "target", target: 1 });
  assert.equal(next.players[1].status, "frozen");
  assert.equal(next.turn, 0); assert.equal(next.forced, null);
  conserved(next);
});

test("Flip7 durante Compre 3 encerra imediatamente, limpa fila e soma bônus sem dobrá-los", () => {
  const { game, give } = fixture([["three"], ["freeze"], ["number", 6], ["number", 12]]);
  for (let n = 0; n < 6; n++) give(1, "number", n);
  give(1, "double"); give(1, "bonus", 10); give(1, "bonus", 8);
  let next = transition(transition(game, { type: "draw" }), { type: "target", target: 1 });
  next = transition(transition(next, { type: "step" }), { type: "step" });
  assert.equal(next.phase, "summary"); assert.equal(next.flip7, 1);
  assert.equal(next.players[1].total, 21 * 2 + 18 + 15);
  assert.equal(next.deck.at(-1).value, 12);
  assert.equal(next.pending, null); assert.equal(next.forced, null); assert.deepEqual(next.queue, []);
  assert.equal(transition(next, { type: "step" }), next);
  assert.equal(transition(next, { type: "stay" }), next);
  conserved(next);
});

test("baralho vazio recicla apenas descartes, mantém mãos e embaralha deterministicamente", () => {
  const { game, give } = fixture(); give(0, "number", 0); give(1, "number", 1);
  assert.equal(game.deck.length, 0);
  const next = transition(game, { type: "draw" });
  assert.deepEqual(next, transition(game, { type: "draw" }));
  assert.equal(next.players[0].cards[0].value, 0); assert.equal(next.players[1].cards[0].value, 1);
  assert.ok(next.deck.length > 0);
  conserved(next);
});

test("bots não consultam ordem escondida do baralho", () => {
  for (let seed = 1; seed <= 30; seed++) {
    let game = createGame(setup, seed);
    for (let step = 0; step < 40 && game.phase === "playing"; step++) {
      const reversed = structuredClone(game); reversed.deck.reverse();
      assert.deepEqual(botAction(game), botAction(reversed));
      game = transition(game, automaticAction(game) ?? botAction(game));
    }
  }
});

test("partidas de 2 a 12 jogadores terminam, preservam cartas, placar e retomada a cada ação", () => {
  for (const count of [2, 3, 6, 12]) {
    for (let seed = 1; seed <= 20; seed++) {
      let game = createGame(Array.from({ length: count }, (_, i) => ({ name: `Pessoa ${i}`, kind: i === 0 ? "human" : ["human", "easy", "normal", "hard"][i % 4] })), seed);
      let steps = 0;
      while (game.phase !== "over" && steps++ < 12000) {
        const context = `jogadores=${count}, semente=${seed}, passo=${steps}`;
        conserved(game);
        game.players.forEach((p, i) => assert.equal(p.total, game.history.reduce((sum, row) => sum + row[i], 0), context));
        const saved = decodeMatch(JSON.stringify({ version: 1, code: "ABCDEF123456", game }), "ABCDEF123456");
        assert.ok(saved, context);
        const action = game.phase === "summary" ? { type: "next" } : automaticAction(game) ?? botAction(game);
        const before = structuredClone(game);
        const next = transition(game, action);
        assert.deepEqual(game, before, context);
        assert.notEqual(next, game, context);
        assert.equal(JSON.stringify(transition(saved.game, action)), JSON.stringify(next), context);
        game = next;
      }
      assert.equal(game.phase, "over"); conserved(game);
      assert.ok(Math.max(...game.players.map(p => p.total)) >= 200);
    }
  }
});
