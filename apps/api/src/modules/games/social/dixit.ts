import { z } from "zod";
import {
  initial,
  base,
  opt,
  shuffled,
  next,
  finish,
  high,
  log,
  choose,
  type Rules,
} from "./common.ts";
const schema = base.extend({
  deck: z.array(z.number()),
  hands: z.array(z.array(z.number())),
  story: z.number(),
  clue: z.string(),
  entries: z.array(z.object({ seat: z.number(), art: z.number() })),
  votes: z.array(z.number()),
  discard: z.array(z.number()),
});
type S = z.infer<typeof schema>;
const handSize = (n: number) => (n === 3 ? 7 : 6);
function submitted(s: S, i: number) {
  return s.entries.filter((e) => e.seat === i).length;
}
function afterSubmit(s: S) {
  const pending = s.players.findIndex(
    (_, i) =>
      i !== s.story && submitted(s, i) < (s.players.length === 3 ? 2 : 1),
  );
  if (pending >= 0) {
    s.turn = pending;
    s.phase = "submit";
    return;
  }
  s.entries = shuffled(s.entries);
  s.phase = "vote";
  s.turn = next(s, s.story);
}
function score(s: S) {
  const answer = s.entries.findIndex((e) => e.seat === s.story),
    hits = s.votes.filter((v) => v === answer).length,
    mixed = hits > 0 && hits < s.players.length - 1;
  s.players.forEach((p, i) => {
    if (i === s.story) {
      p.score += mixed ? 3 : 0;
      return;
    }
    p.score += mixed ? (s.votes[i] === answer ? 3 : 0) : 2;
    p.score += s.votes.filter((v) => v >= 0 && s.entries[v].seat === i).length;
  });
  log(
    s,
    "A imagem " +
      (answer + 1) +
      " era de " +
      s.players[s.story].name +
      ". " +
      hits +
      " acerto(s).",
  );
  if (s.players.some((p) => p.score >= 30) || s.deck.length === 0) {
    finish(s, high(s), "Fim da galeria. Vence a maior pontuação.");
    return;
  }
  s.phase = "reveal";
  s.turn = s.story;
}
export const dixit: Rules<S> = {
  id: "dixit",
  schema,
  setup: (p) => {
    const deck = shuffled(Array.from({ length: 84 }, (_, i) => i));
    return {
      ...initial(p),
      phase: "clue",
      hands: p.map(() => deck.splice(-handSize(p.length))),
      deck,
      discard: [],
      story: 0,
      clue: "",
      entries: [],
      votes: p.map(() => -1),
    };
  },
  screen: (s, i) => ({
    heading: (
      {
        clue: "Uma imagem, uma pista",
        submit: "Escolha uma imagem para a pista",
        vote: "Qual imagem inspirou o conto?",
        reveal: "A autoria foi revelada",
        over: "Resultado da galeria",
      } as Record<string, string>
    )[s.phase],
    board: [
      s.players[s.story].name + " conta a história",
      s.clue ? "Pista: " + s.clue : "O narrador prepara a pista.",
      ...(["over", "reveal"].includes(s.phase)
        ? s.entries.map(
            (e, k) =>
              k +
              1 +
              " · " +
              s.players[e.seat].name +
              " · " +
              s.votes.filter((v) => v === k).length +
              " voto(s)",
          )
        : []),
    ],
    images: ["vote", "reveal", "over"].includes(s.phase)
      ? s.entries.map((e) => e.art)
      : [],
    hand: i === null ? [] : s.hands[i],
    details: s.players.map((p) => p.score + " pontos"),
  }),
  choices: (s, i) => {
    if (s.phase === "over" || s.turn !== i) return [];
    if (s.phase === "reveal") return [opt("next", "Próxima história")];
    if (s.phase === "vote")
      return s.entries.flatMap((e, j) =>
        e.seat === i
          ? []
          : [opt("vote:" + j, "Votar na imagem " + (j + 1), { art: e.art })],
      );
    return s.hands[i].map((art) =>
      opt(
        "card:" + art,
        s.phase === "clue" ? "Contar com esta imagem" : "Enviar esta imagem",
        { art, ...(s.phase === "clue" ? { input: "Sua pista" } : {}) },
      ),
    );
  },
  move: (s, i, key, text) => {
    const n = Number(key.split(":")[1]);
    if (s.phase === "reveal") {
      s.discard.push(...s.entries.map((e) => e.art));
      for (const hand of s.hands) {
        while (hand.length < handSize(s.players.length) && s.deck.length)
          hand.push(s.deck.pop()!);
      }
      if (!s.deck.length) {
        finish(s, high(s), "O monte terminou.");
        return;
      }
      s.story = next(s, s.story);
      s.turn = s.story;
      s.phase = "clue";
      s.clue = "";
      s.entries = [];
      s.votes.fill(-1);
      s.round++;
      return;
    }
    if (s.phase === "vote") {
      s.votes[i] = n;
      const pending = s.players.findIndex(
        (_, j) => j !== s.story && s.votes[j] === -1,
      );
      if (pending < 0) score(s);
      else s.turn = pending;
      return;
    }
    if (s.phase === "clue") {
      s.clue = text;
      log(s, s.players[i].name + " contou: “" + text + "”.");
    }
    s.hands[i].splice(s.hands[i].indexOf(n), 1);
    s.entries.push({ seat: i, art: n });
    afterSubmit(s);
  },
  bot: (opts) => {
    const o = choose(opts);
    return {
      key: o.key,
      ...(o.input
        ? {
            text: choose(
              [
                "À espera do impossível",
                "O tempo esqueceu de voltar",
                "Quase em casa",
                "Entre dois mundos",
              ].map((t) => opt(t, t)),
            ).label,
          }
        : {}),
    };
  },
};
