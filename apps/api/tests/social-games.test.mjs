import { test } from "node:test";
import assert from "node:assert/strict";
import { gameDriver } from "../dist/modules/games/registry.js";
import { socialIds, socialSettings, gameDefinitions } from "@croebet/shared";
function setup(id, n = socialSettings[id].min) {
  return gameDriver(id).create(
    {
      setup: Array.from({ length: n }, (_, i) => ({
        name: "Pessoa " + i,
        kind: "human",
      })),
      options: gameDefinitions[id].defaults,
    },
    "Pessoa 0",
  );
}
test("a mesa pública mostra influências viradas e trilhas aprovadas", () => {
  const court = setup("coup");
  court.shown[0].push(court.hands[0].pop());
  assert.deepEqual(gameDriver("coup").project(court).table, {
    kind: "court",
    seats: court.players.map((_, seat) => ({
      coins: court.coins[seat], hidden: seat === 0 ? 1 : 2, revealed: court.shown[seat],
    })),
  });
  assert.deepEqual(gameDriver("secret-hitler").project(setup("secret-hitler")).table, {
    kind: "parliament", liberal: 0, fascist: 0, failed: 0,
  });
});
function act(s, id, key, seat = s.turn, text) {
  const d = gameDriver(id),
    a = {
      type: "social-choice",
      game: id,
      seat,
      key,
      ...(text ? { text } : {}),
    };
  assert.ok(d.authorize(s, seat, a), key);
  return d.apply(s, a);
}
for (const id of socialIds)
  test(
    id +
      " preserva sigilo e recusa comandos cruzados em toda a faixa de jogadores",
    () => {
      const d = gameDriver(id);
      for (let n = socialSettings[id].min; n <= socialSettings[id].max; n++) {
        const s = setup(id, n),
          v = d.project(s);
        assert.deepEqual(v.notes, []);
        assert.deepEqual(v.hand, []);
        assert.deepEqual(v.choices, []);
        const a = d.projectFor(s, s.turn).choices[0];
        assert.ok(a);
        for (const other of socialIds.filter((i) => i !== id))
          assert.equal(
            d.authorize(s, s.turn, {
              type: "social-choice",
              game: other,
              seat: s.turn,
              key: a.key,
            }),
            false,
          );
        assert.deepEqual(d.eventAction(a), { type: "step" });
      }
    },
  );
test("Coup: o custo do assassinato e duas perdas no desafio incorreto", () => {
  let s = setup("coup");
  s.hands = [
    ["Assassino", "Duque"],
    ["Capitão", "Condessa"],
  ];
  s.coins[0] = 3;
  s = act(s, "coup", "kill:1");
  s = act(s, "coup", "challenge");
  s = act(s, "coup", "card:1");
  s = act(s, "coup", "pass");
  s = act(s, "coup", "card:0");
  assert.deepEqual(s.winners, [0]);
  assert.equal(s.coins[0], 0);
  const x = setup("coup");
  x.coins[0] = 10;
  assert.deepEqual(
    gameDriver("coup")
      .projectFor(x, 0)
      .choices.map((o) => o.key),
    ["coup:1"],
  );
});
test("Dixit: três jogadores enviam cinco imagens, voto na própria imagem é recusado e a pontuação é conferível", () => {
  let s = setup("dixit");
  for (let j = 0; j < 5; j++) {
    const a = gameDriver("dixit").projectFor(s, s.turn).choices[0];
    s = act(s, "dixit", a.key, s.turn, j === 0 ? "Maré de papel" : undefined);
  }
  assert.equal(s.entries.length, 5);
  assert.equal(s.phase, "vote");
  const story = s.entries.findIndex((e) => e.seat === 0),
    two = s.entries.findIndex((e) => e.seat === 1);
  let own = s.entries.findIndex((e) => e.seat === s.turn);
  assert.equal(
    gameDriver("dixit").authorize(s, s.turn, {
      type: "social-choice",
      game: "dixit",
      seat: s.turn,
      key: "vote:" + own,
    }),
    false,
  );
  s = act(s, "dixit", "vote:" + story);
  s = act(s, "dixit", "vote:" + two);
  assert.deepEqual(
    s.players.map((p) => p.score),
    [3, 4, 0],
  );
});
test("Secret Hitler: eleição especial volta à sucessão original, caos ignora o poder e terceiro ato habilita vitória eleitoral", () => {
  const id = "secret-hitler",
    d = gameDriver(id);
  let s = setup(id, 7);
  s.phase = "special";
  s.pres = s.turn = 0;
  s = act(s, id, "seat:3");
  s = act(s, id, "seat:2");
  while (s.phase === "vote") s = act(s, id, "no");
  assert.equal(s.pres, 1);
  s.failed = 2;
  s.fas = 2;
  s.deck[s.deck.length - 1] = "Fascista";
  s = act(s, id, d.projectFor(s, s.turn).choices[0].key);
  while (s.phase === "vote") s = act(s, id, "no");
  assert.equal(s.fas, 3);
  assert.equal(s.phase, "nominate");
  assert.equal(s.failed, 0);
  s.roles = [
    "Liberal",
    "Liberal",
    "Hitler",
    "Fascista",
    "Fascista",
    "Liberal",
    "Liberal",
  ];
  s.pres = s.turn = 0;
  s = act(s, id, "seat:2");
  while (s.phase === "vote") s = act(s, id, "yes");
  assert.deepEqual(s.winners, [2, 3, 4]);
});
test("Spyfall: votação interrompe o relógio, espião não recebe local, servidor encerra perguntas atrasadas", () => {
  const id = "spyfall",
    d = gameDriver(id);
  let s = setup(id, 4);
  s.spy = 3;
  s.place = 0;
  assert.deepEqual(d.projectFor(s, 3).notes, [
    "Você é o espião. Descubra o local.",
  ]);
  assert.match(d.projectFor(s, 0).notes[0], /Buteco/);
  s = act(s, id, "ask:1", 0, "Como está o movimento?");
  s = act(s, id, "accuse:2", 0);
  assert.equal(d.project(s).deadline, null);
  while (s.phase === "vote") s = act(s, id, "no");
  assert.equal(s.phase, "answer");
  s = act(s, id, "answer", 1, "Está tranquilo.");
  assert.ok(!d.projectFor(s, 1).choices.some((o) => o.key === "ask:0"));
  s.until = Date.now() - 1;
  assert.deepEqual(d.projectFor(s, 1).choices, []);
  s = d.apply(s, d.automatic(s));
  assert.equal(s.phase, "final");
});
