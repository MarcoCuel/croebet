import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticAction, botAction, canStay, createDeck, createGame, numbers, score, targets, transition } from "../src/modules/games/flip7/engine.ts";
import { cardChoices } from "../src/modules/games/flip7/vengeance.ts";
import { validateState } from "../src/modules/games/flip7/state.ts";
const setup = [{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }, { name: "Bot", kind: "normal" }];
function fixture(brutal = false) {
  const game = createGame(setup, 42, { mode: "vengeance", brutal });
  game.players.forEach(p => { p.hasDrawn = true; });
  const take = (type, value) => {
    const index = game.deck.findIndex(c => c.type === type && (value === undefined || c.value === value));
    assert.ok(index >= 0, `${type} ${value} disponível`);
    return game.deck.splice(index, 1)[0];
  };
  const hand = (target, ...cards) => { const result = cards.map(([type, value]) => take(type, value)); game.players[target].cards.push(...result); return result; };
  const stack = (...cards) => { game.deck.push(...cards.map(([type, value]) => take(type, value)).reverse()); };
  return { game, take, hand, stack };
}
function roundTrip(game) {
  const loaded = validateState(JSON.parse(JSON.stringify(game)));
  assert.ok(loaded, `snapshot: ${JSON.stringify({ pending: game.pending, forced: game.forced, phase: game.phase, turn: game.turn })}`);
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(game)));
}

test("Vingança tem 108 cartas com três números especiais substituindo as cópias corretas", () => {
  const deck = createDeck("vengeance");
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck.map(c => c.id)).size, 108);
  for (let value = 1; value <= 13; value++) assert.equal(deck.filter(c => c.value === value && ["number", "lucky13", "unlucky7"].includes(c.type)).length, value);
  assert.equal(deck.filter(c => c.type === "number").length, 89);
  for (const type of ["one", "four", "steal", "swap", "remove"]) assert.equal(deck.filter(c => c.type === type).length, 2);
  assert.equal(createDeck().length, 94);
});
test("pontuação divide antes de subtrair, limita padrão a zero e permite negativos no Brutal", () => {
  const f = fixture(); f.hand(0, ["number", 13], ["number", 8], ["halve"], ["minus", 4]);
  assert.equal(score(f.game.players[0], f.game), 6);
  f.hand(0, ["minus", 10]);
  assert.equal(score(f.game.players[0], f.game), 0);
  f.game.brutal = true;
  assert.equal(score(f.game.players[0], f.game), -4);
  roundTrip(f.game);
});
test("Zero impede parar e zera a rodada, mas completar Flip7 recupera soma e bônus", () => {
  const f = fixture(); f.hand(0, ["zero"], ["number", 1], ["number", 2], ["number", 3], ["number", 4], ["number", 5]);
  assert.equal(score(f.game.players[0], f.game), 0);
  assert.equal(canStay(f.game.players[0], f.game), false);
  assert.equal(transition(f.game, { type: "stay" }), f.game);
  f.stack(["number", 6]);
  const g = transition(f.game, { type: "draw" });
  assert.equal(g.phase, "summary"); assert.equal(g.history[0][0], 36); roundTrip(g);
});
test("7 de merda limpa números, modificadores e efeitos anteriores da sequência sem estourar", () => {
  const f = fixture(); f.hand(0, ["number", 7], ["minus", 4]); f.stack(["four"], ["minus", 6], ["unlucky7"], ["number", 1], ["number", 2]);
  let g = transition(f.game, { type: "draw" }); g = transition(g, { type: "target", target: 0 });
  for (let i = 0; i < 4; i++) { g = transition(g, { type: "step" }); roundTrip(g); }
  assert.deepEqual(numbers(g.players[0]).map(c => c.value), [7, 1, 2]);
  assert.equal(g.pending, null); assert.equal(g.players[0].status, "playing"); assert.equal(score(g.players[0], g), 10);
});
test("13 da sorte tolera dois 13 em qualquer ordem e o terceiro estoura", () => {
  for (const order of [["number", "lucky13"], ["lucky13", "number"]]) {
    const f = fixture(); f.hand(0, [order[0], 13]); f.stack([order[1], 13], ["number", 13]);
    let g = transition(f.game, { type: "draw" }); assert.equal(g.players[0].status, "playing"); assert.equal(score(g.players[0], g), 26);
    g.turn = 0; g = transition(g, { type: "draw" }); assert.equal(g.players[0].status, "busted"); roundTrip(g);
  }
});
test("parados recebem modificadores; só Brutal inclui estourados e cobra novos modificadores", () => {
  for (const brutal of [false, true]) {
    const f = fixture(brutal); f.hand(1, ["number", 4], ["minus", 8]); f.hand(2, ["number", 3]);
    f.game.players[1].status = "busted"; f.game.players[1].bustedCards = f.game.players[1].cards.map(c => c.id); f.game.players[2].status = "stayed";
    f.stack(["minus", 10]);
    let g = transition(f.game, { type: "draw" });
    assert.deepEqual(targets(g), brutal ? [0, 1, 2] : [0, 2]);
    g = transition(g, { type: "target", target: brutal ? 1 : 2 });
    assert.equal(score(g.players[1], g), brutal ? -10 : 0);
    assert.equal(g.players[2].status, "stayed"); roundTrip(g);
  }
});
test("Trocar permite duas vítimas, causa dois estouros e conserva cartas", () => {
  const f = fixture(); const [a] = f.hand(0, ["number", 10], ["number", 11]); const [, b] = f.hand(1, ["number", 10], ["number", 11]);
  f.stack(["swap"]); let g = transition(f.game, { type: "draw" });
  assert.deepEqual(targets(g), []);
  assert.equal(g.pending.resolving, true);
  assert.equal(g.pending.source, 0);
  roundTrip(g);
  assert.ok(cardChoices(g).some(ids => ids.includes(a.id) && ids.includes(b.id)));
  g = transition(g, { type: "cards", cards: [a.id, b.id] });
  assert.equal(g.players[0].status, "busted"); assert.equal(g.players[1].status, "busted"); roundTrip(g);
});
test("Roubar dá controle ao destinatário e pode forçá-lo a estourar; Descartar remove Zero", () => {
  const f = fixture(); f.hand(0, ["number", 13]); const [victim] = f.hand(1, ["number", 13]);
  f.stack(["steal"]); let g = transition(f.game, { type: "draw" });
  g = transition(g, { type: "target", target: 0 });
  assert.equal(g.pending.source, 0); assert.equal(automaticAction(g), null);
  assert.equal(transition(g, { type: "cards", cards: [999] }), g);
  g = transition(g, { type: "cards", cards: [victim.id] });
  assert.equal(g.players[0].status, "busted"); roundTrip(g);
  const d = fixture(); const [zero] = d.hand(0, ["zero"], ["number", 5]); d.stack(["remove"]);
  g = transition(d.game, { type: "draw" }); g = transition(g, { type: "target", target: 0 }); g = transition(g, { type: "cards", cards: [zero.id] });
  assert.ok(canStay(g.players[0], g)); assert.equal(score(g.players[0], g), 5); roundTrip(g);
});
test("Compre 4 adia modificadores e ações e mantém parado quem já havia parado", () => {
  const f = fixture(); f.hand(1, ["number", 5]); f.game.players[1].status = "stayed";
  f.stack(["four"], ["number", 1], ["minus", 2], ["remove"], ["number", 2]);
  let g = transition(f.game, { type: "draw" }); g = transition(g, { type: "target", target: 1 }); roundTrip(g);
  for (let i = 0; i < 4; i++) { assert.equal(g.pending, null); g = transition(g, { type: "step" }); roundTrip(g); }
  assert.equal(g.pending.card.type, "minus"); assert.equal(g.queue[0].card.type, "remove");
  assert.equal(g.players[1].status, "stayed");
  g = transition(g, { type: "target", target: 0 }); assert.equal(g.pending.card.type, "remove");
});
test("Compre 4 que estoura descarta todos os efeitos comprados na sequência", () => {
  const f = fixture(); f.hand(1, ["number", 5]); f.stack(["four"], ["remove"], ["minus", 4], ["number", 5], ["number", 2]);
  let g = transition(f.game, { type: "draw" }); g = transition(g, { type: "target", target: 1 });
  for (let i = 0; i < 3; i++) g = transition(g, { type: "step" });
  assert.equal(g.forced, null); assert.equal(g.pending, null); assert.equal(g.queue.length, 0); assert.equal(g.players[1].status, "busted"); roundTrip(g);
});
test("ações restantes de um Compre 4 sobrevivem a estouro posterior por Só mais uma", () => {
  const f = fixture(); f.hand(0, ["number", 5]); f.hand(1, ["number", 6]);
  f.stack(["four"], ["one"], ["minus", 2], ["number", 1], ["number", 2], ["number", 5]);
  let g = transition(f.game, { type: "draw" }); g = transition(g, { type: "target", target: 0 });
  for (let i = 0; i < 4; i++) g = transition(g, { type: "step" });
  assert.equal(g.pending.card.type, "one");
  g = transition(g, { type: "target", target: 0 }); g = transition(g, { type: "step" });
  assert.equal(g.players[0].status, "busted"); assert.equal(g.pending.card.type, "minus"); roundTrip(g);
});
test("Só mais uma força parada mesmo com Zero e resolve a ação recebida", () => {
  const f = fixture(); f.hand(1, ["zero"]); f.hand(0, ["number", 3]); f.stack(["one"], ["remove"]);
  let g = transition(f.game, { type: "draw" }); g = transition(g, { type: "target", target: 1 }); g = transition(g, { type: "step" });
  assert.equal(g.players[1].status, "stayed"); assert.equal(g.pending.card.type, "remove"); roundTrip(g);
});
test("Flip7 Brutal pausa para escolher bônus e só contabiliza uma vez após reload", () => {
  for (const target of [null, 1]) {
    const f = fixture(true); f.hand(0, ...[1, 2, 3, 4, 5, 6].map(n => ["number", n])); f.stack(["number", 8]);
    let g = transition(f.game, { type: "draw" });
    assert.equal(g.bonusChoice, 0); assert.equal(g.history.length, 0); roundTrip(g);
    assert.equal(automaticAction(g), null); assert.equal(transition(g, { type: "bonus", target: 0 }), g);
    assert.equal(transition(g, { type: "draw" }), g);
    g = transition(g, { type: "bonus", target });
    assert.equal(g.history[0][0], target === null ? 44 : 29); assert.equal(g.history[0][1], target === null ? 0 : -15);
    assert.equal(g.phase, "summary"); roundTrip(g);
    assert.equal(transition(g, { type: "bonus", target }), g);
  }
});
test("estado exige modalidade explícita; só Brutal aceita placares negativos", () => {
  const classic = createGame(setup, 42); delete classic.mode; delete classic.brutal;
  const loaded = validateState(JSON.parse(JSON.stringify(classic))); assert.equal(loaded, null);
  for (const brutal of [false, true]) {
    const f = fixture(brutal); f.game.players[0].total = -4;
    assert.equal(!!validateState(JSON.parse(JSON.stringify(f.game))), brutal);
  }
});
test("Vingança e Brutal simulam partidas completas, conservam 108 cartas e retomam cada escolha", () => {
  for (const brutal of [false, true]) for (const count of [2, 3, 6, 12]) for (let seed = 1; seed <= 8; seed++) {
    let g = createGame(Array.from({ length: count }, (_, i) => ({ name: `P${i}`, kind: i === 0 ? "human" : "normal" })), seed, { mode: "vengeance", brutal });
    let steps = 0;
    while (g.phase !== "over" && steps++ < 12000) {
      roundTrip(g);
      const action = g.phase === "summary" ? { type: "next" } : automaticAction(g) ?? botAction(g);
      const next = transition(g, action);
      assert.notEqual(next, g, `travou ${brutal} ${count} ${seed} ${JSON.stringify(action)}`); g = next;
    }
    assert.equal(g.phase, "over", `não terminou ${brutal} ${count} ${seed}`); roundTrip(g);
  }
});

test("rejeita snapshots Vingança adulterados que poderiam travar escolhas ou mudar as regras", () => {
  const mutations = [
    g => { g.mode = "outro"; },
    g => { g.brutal = "true"; },
    g => { g.deck[0].type = "chance"; },
    g => { g.bonusChoice = 0; },
    g => { g.bonusTarget = 99; },
    g => { g.players[0].bustedCards = [1000]; },
    g => { const index = g.deck.findIndex(c => c.type === "minus"); g.pending = { source: 0, card: g.deck.splice(index, 1)[0], resolving: true }; },
    g => { g.forced = { target: 1, remaining: 4, queueStart: 99, stopAfter: false }; },
    g => { g.forced = { target: 1, remaining: 2, queueStart: 0, stopAfter: true }; },
  ];
  for (const mutate of mutations) {
    const { game } = fixture(); mutate(game);
    assert.equal(validateState(JSON.parse(JSON.stringify(game))), null, mutate.toString());
  }
});
test("bots Vingança e Brutal usam só informações públicas e transições preservam a entrada", () => {
  for (const brutal of [false, true]) {
    const f = fixture(brutal); f.hand(0, ["number", 4], ["number", 8]); f.hand(1, ["number", 12]);
    const pending = structuredClone(f.game);
    const index = pending.deck.findIndex(c => c.type === "swap");
    pending.deck.push(pending.deck.splice(index, 1)[0]);
    const choice = transition(transition(pending, { type: "draw" }), { type: "target", target: 0 });
    for (const g of [f.game, choice]) {
      const copy = structuredClone(g); copy.deck.reverse();
      assert.deepEqual(botAction(g), botAction(copy));
      const before = structuredClone(g); const action = botAction(g); transition(g, action); assert.deepEqual(g, before);
    }
  }
});

test("Vingança permite parar sem números após a distribuição, inclusive com saldo negativo", () => {
  const f = fixture(true); f.hand(0, ["minus", 8]);
  assert.equal(canStay(f.game.players[0], f.game), true);
  const g = transition(f.game, { type: "stay" });
  assert.equal(g.players[0].status, "stayed"); assert.equal(score(g.players[0], g), -8); roundTrip(g);
  const initial = createGame(setup, 42, { mode: "vengeance", brutal: false });
  assert.equal(transition(initial, { type: "stay" }), initial);
});

test("Roubar escolhe a carta diretamente e entrega ao comprador, sem escolher participante", () => {
  for (const receiver of [0, 1]) {
    const f = fixture();
    const victim = receiver === 0 ? 1 : 0;
    const [stolen] = f.hand(victim, ["number", 8]);
    f.hand(receiver, ["number", 3]);
    f.stack(["steal"]);
    f.game.turn = receiver;
    let g = transition(f.game, { type: "draw" });
    assert.equal(g.pending.resolving, true);
    assert.deepEqual(targets(g), []);
    assert.equal(transition(g, { type: "target", target: victim }), g);
    assert.equal(g.pending.source, receiver);
    assert.equal(g.players[victim].cards[0].id, stolen.id);
    g = transition(g, { type: "cards", cards: [stolen.id] });
    assert.ok(g.players[receiver].cards.some(c => c.id === stolen.id));
    assert.ok(!g.players[victim].cards.some(c => c.id === stolen.id));
    assert.ok(g.log.some(entry => entry.message === `${g.players[receiver].name} roubou 8 de ${g.players[victim].name}.`));
    roundTrip(g);
  }
});

test("Descartar permite remover exatamente o modificador próprio escolhido, preservando as outras cartas", () => {
  const f = fixture();
  const [bad, own] = f.hand(0, ["minus", 10], ["number", 8]);
  const [other] = f.hand(1, ["number", 12]);
  f.stack(["remove"]);
  let g = transition(f.game, { type: "draw" });
  g = transition(g, { type: "target", target: 0 });
  assert.equal(automaticAction(g), null);
  assert.ok(cardChoices(g).some(ids => ids[0] === bad.id));
  g = transition(g, { type: "cards", cards: [bad.id] });
  assert.ok(g.discard.some(c => c.id === bad.id));
  assert.deepEqual(g.players[0].cards.map(c => c.id), [own.id]);
  assert.deepEqual(g.players[1].cards.map(c => c.id), [other.id]);
  assert.equal(score(g.players[0], g), 8);
  roundTrip(g);
});

test("Zero compra automaticamente na própria vez e pausa em escolhas e turnos de outras pessoas", () => {
  const f = fixture(); f.hand(0, ["zero"]); f.hand(1, ["number", 4]); f.hand(2, ["number", 5]);
  f.game.players[2].kind = "human";
  f.stack(["number", 1], ["remove"]);
  assert.deepEqual(automaticAction(f.game), { type: "draw" });
  let g = transition(f.game, automaticAction(f.game));
  assert.equal(g.turn, 1); assert.equal(automaticAction(g), null);
  g = transition(g, { type: "stay" }); g = transition(g, { type: "stay" });
  assert.equal(g.turn, 0); assert.deepEqual(automaticAction(g), { type: "draw" });
  g = transition(g, automaticAction(g));
  assert.equal(g.pending.card.type, "remove"); assert.equal(automaticAction(g), null);
  const zero = g.players[0].cards.find(c => c.type === "zero");
  g = transition(g, { type: "cards", cards: [zero.id] });
  assert.equal(g.turn, 0); assert.equal(automaticAction(g), null); roundTrip(g);
  const classic = createGame(setup, 42); classic.players[0].hasDrawn = true;
  assert.equal(automaticAction(classic), null);
});
