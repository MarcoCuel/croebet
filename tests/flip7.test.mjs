import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticAction, botAction, createDeck, createGame, numbers, score, targets, transition } from "../features/games/flip7/engine.ts";
const setup = [{ name: "Marco", kind: "human" }, { name: "Bot", kind: "normal" }];
const game = () => createGame(setup, 42);
const card = (type, value = 0) => ({ id: 999 + value, type, value });
function stack(g, cards) { g.deck = [...cards].reverse(); return g; }
function totalCards(g) { return [...g.deck, ...g.discard, ...g.players.flatMap(p => p.cards), ...g.queue.map(p => p.card), ...(g.pending ? [g.pending.card] : [])]; }

test("baralho tem 94 cartas e embaralhamento é determinístico sem mutações", () => {
  const deck = createDeck();
  assert.equal(deck.length, 94);
  assert.equal(new Set(deck.map(c => c.id)).size, 94);
  for (let n = 0; n <= 12; n++) assert.equal(deck.filter(c => c.type === "number" && c.value === n).length, Math.max(1, n));
  assert.deepEqual(game(), game());
  const g = game(); const before = structuredClone(g); transition(g, { type: "draw" }); assert.deepEqual(g, before);
});
test("pontuação dobra só números, soma bônus e Flip7, e estourar zera", () => {
  const p = game().players[0];
  p.cards = [card("number", 10), card("number", 12), card("double"), card("bonus", 8)];
  assert.equal(score(p), 52);
  p.cards = Array.from({ length: 7 }, (_, i) => card("number", i));
  assert.equal(score(p), 36);
  p.status = "busted"; assert.equal(score(p), 0);
});
test("não permite parar sem número e passa a vez depois de comprar", () => {
  const g = stack(game(), [card("number", 12)]);
  assert.equal(transition(g, { type: "stay" }), g);
  const next = transition(g, { type: "draw" });
  assert.equal(next.turn, 1); assert.equal(score(next.players[0]), 12);
});
test("número repetido estoura; segunda chance conserva cartas nos descartes", () => {
  const g = stack(game(), [card("number", 12)]);
  g.players[0].cards = [{ ...card("number", 12), id: 100 }, card("chance")];
  const saved = transition(g, { type: "draw" });
  assert.equal(saved.players[0].status, "playing"); assert.equal(saved.discard.length, 2);
  assert.equal(numbers(saved.players[0]).length, 1);
  g.players[0].cards.pop();
  const busted = transition(g, { type: "draw" }); assert.equal(busted.players[0].status, "busted");
});
test("Congelar aceita alvo ativo, rejeita alvo inválido e encerra quando todos pararam", () => {
  let g = stack(game(), [card("freeze")]);
  g.players[1].status = "stayed";
  g = transition(g, { type: "draw" });
  assert.deepEqual(targets(g), [0]);
  assert.equal(transition(g, { type: "target", target: 1 }), g);
  g = transition(g, { type: "target", target: 0 });
  assert.equal(g.phase, "summary"); assert.equal(g.history.length, 1);
});
test("Compre 3 enfileira ação, completa compras e só então escolhe alvo", () => {
  let g = stack(game(), [card("three"), card("number", 1), card("freeze"), card("number", 2)].map((c, i) => ({ ...c, id: 2000 + i })));
  g = transition(g, { type: "draw" }); g = transition(g, { type: "target", target: 1 });
  assert.equal(transition(g, { type: "draw" }), g);
  g = transition(g, { type: "step" }); g = transition(g, { type: "step" });
  assert.equal(g.pending, null); assert.equal(g.queue.length, 1);
  const waitingCard = g.queue[0].card;
  assert.equal(waitingCard.type, "freeze");
  assert.ok(!g.discard.some(c => c.id === waitingCard.id));
  g = transition(g, { type: "step" });
  assert.equal(g.pending.card.type, "freeze"); assert.equal(g.forced, null);
  assert.equal(score(g.players[1]), 3);
  assert.equal(g.pending.card.id, waitingCard.id);
  assert.ok(!g.discard.some(c => c.id === waitingCard.id));
  g = transition(g, { type: "target", target: 0 });
  assert.equal(g.pending, null);
  assert.ok(g.discard.some(c => c.id === waitingCard.id));
});
test("estouro no Compre 3 cancela compras e descarta ações pendentes", () => {
  let g = stack(game(), [card("three"), card("freeze"), card("number", 1), card("number", 1)]);
  g = transition(g, { type: "draw" }); g = transition(g, { type: "target", target: 1 });
  for (let i = 0; i < 3; i++) g = transition(g, { type: "step" });
  assert.equal(g.players[1].status, "busted"); assert.equal(g.pending, null);
  assert.equal(g.queue.length, 0); assert.equal(g.turn, 0);
});
test("segunda chance extra é dada só a outro participante elegível", () => {
  let g = stack(game(), [card("chance")]); g.players[0].cards = [{ ...card("chance"), id: 100 }];
  g = transition(g, { type: "draw" }); assert.deepEqual(targets(g), [1]);
  g = transition(g, { type: "target", target: 1 }); assert.equal(g.players[1].cards[0].type, "chance");
});
test("Flip7 termina imediatamente, contabiliza uma vez e declara vitória ao atingir 200", () => {
  let g = stack(game(), [card("number", 6)]);
  g.players[0].cards = Array.from({ length: 6 }, (_, i) => card("number", i));
  g.players[0].total = 190;
  g = transition(g, { type: "draw" });
  assert.equal(g.phase, "over"); assert.equal(g.players[0].total, 226);
  assert.equal(g.flip7, 0); assert.equal(g.history.length, 1);
  assert.equal(transition(g, { type: "draw" }), g);
  assert.equal(transition(g, { type: "next" }), g);
});
test("nova rodada preserva placar, descarta mãos e alterna quem começa", () => {
  let g = game(); g.players.forEach((p, i) => { p.cards = [g.deck.pop()]; p.status = "stayed"; if (i === 0) p.status = "playing"; });
  g.players[0].cards = [g.deck.find(c => c.type === "number")]; // isolated score fixture
  g = transition(g, { type: "stay" }); const total = g.players[0].total;
  g = transition(g, { type: "next" });
  assert.equal(g.phase, "playing"); assert.equal(g.round, 2); assert.equal(g.turn, 1);
  assert.equal(g.players[0].total, total); assert.equal(g.players[0].cards.length, 0);
});
test("partidas completas mantêm as 94 cartas e terminam sem travar em múltiplas sementes", () => {
  for (let seed = 1; seed <= 80; seed++) {
    let g = createGame([...setup, { name: "Terceiro", kind: "hard" }, { name: "Quarto", kind: "easy" }], seed);
    let steps = 0;
    while (g.phase !== "over" && steps++ < 12000) {
      const all = totalCards(g);
      assert.equal(all.length, 94, `quantidade, seed ${seed}`);
      assert.equal(new Set(all.map(c => c.id)).size, 94, `duplicação, seed ${seed}`);
      const action = g.phase === "summary" ? { type: "next" } : g.forced ? { type: "step" } : botAction(g);
      const next = transition(g, action);
      assert.notEqual(next, g, `travou, seed ${seed}`); g = next;
    }
    assert.equal(g.phase, "over", `não terminou, seed ${seed}`);
  }
});

test("primeira compra é automática e cartas de escolha pausam a distribuição", () => {
  let g = stack(createGame([{ name: "A", kind: "human" }, { name: "B", kind: "human" }], 1), [card("freeze"), card("number", 4)]);
  assert.deepEqual(automaticAction(g), { type: "draw" });
  g = transition(g, automaticAction(g));
  assert.equal(g.players[0].hasDrawn, true);
  assert.equal(automaticAction(g), null);
  g = transition(g, { type: "target", target: 1 });
  assert.equal(g.turn, 0);
  assert.equal(automaticAction(g), null); // empty hand after an action must not trigger a second automatic deal
  g = stack(g, [card("number", 5)]);
  g = transition(g, { type: "draw" });
  g = transition(g, { type: "stay" });
  g = transition(g, { type: "next" });
  assert.ok(g.players.every(p => !p.hasDrawn));
  assert.deepEqual(automaticAction(g), { type: "draw" });
});
