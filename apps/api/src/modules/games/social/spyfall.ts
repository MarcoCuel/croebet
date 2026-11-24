import { z } from "zod";
import {
  base,
  initial,
  opt,
  shuffled,
  next,
  log,
  finish,
  high,
  choose,
  type Rules,
} from "./common.ts";
const places = [
  ["Buteco da praça", "garçom", "cliente", "cozinheira"],
  ["Rádio comunitária", "locutora", "operador", "convidado"],
  ["Brechó", "costureira", "cliente", "caixa"],
  ["Rodoviária", "motorista", "viajante", "fiscal"],
  ["Cinema de rua", "projecionista", "bilheteira", "espectador"],
  ["Feira livre", "feirante", "freguês", "carregador"],
  ["Biblioteca", "bibliotecária", "leitor", "estudante"],
  ["Aquário", "bióloga", "mergulhador", "visitante"],
  ["Circo", "acrobata", "músico", "bilheteiro"],
  ["Museu", "curadora", "guia", "visitante"],
  ["Hotel", "recepcionista", "camareira", "hóspede"],
  ["Observatório", "astrônoma", "técnico", "visitante"],
  ["Estádio", "árbitro", "torcedora", "repórter"],
  ["Teatro", "atriz", "figurinista", "contrarregra"],
  ["Padaria", "padeiro", "atendente", "entregadora"],
  ["Escola de samba", "passista", "mestre de bateria", "costureira"],
  ["Estaleiro", "carpinteira", "soldador", "engenheira"],
  ["Parque de diversões", "operador", "visitante", "monitora"],
  ["Aeroporto", "piloto", "comissária", "passageiro"],
  ["Praia", "salva-vidas", "surfista", "ambulante"],
  ["Balsa", "marinheira", "capitão", "passageira"],
  ["Oficina de bicicletas", "mecânica", "ciclista", "atendente"],
  ["Sebo", "livreira", "colecionador", "ilustradora"],
  ["Salão de beleza", "cabeleireira", "cliente", "manicure"],
  ["Planetário", "guia", "professora", "aluna"],
  ["Estúdio de dança", "coreógrafo", "dançarina", "pianista"],
  ["Mercado de flores", "florista", "jardineiro", "entregador"],
  ["Ateliê de cerâmica", "oleira", "aprendiz", "modelo"],
  ["Mirante", "fotógrafa", "guia", "turista"],
  ["Estação de trem", "maquinista", "fiscal", "passageiro"],
];
const schema = base.extend({
  place: z.number(),
  spy: z.number(),
  roles: z.array(z.string()),
  asker: z.number(),
  previous: z.number(),
  asked: z.number(),
  dealer: z.number(),
  until: z.number(),
  remaining: z.number(),
  accuser: z.number(),
  accused: z.number(),
  called: z.array(z.number()),
  finalCalls: z.array(z.number()),
  votes: z.array(z.number()),
  returnPhase: z.string(),
  question: z.string(),
});
type S = z.infer<typeof schema>;
function round(s: S) {
  s.spy = shuffled(s.players.map((_, i) => i))[0];
  s.place = shuffled(places.map((_, i) => i))[0];
  s.roles = shuffled(s.players.map((_, i) => places[s.place][1 + (i % 3)]));
  s.phase = "ask";
  s.turn = s.asker = s.dealer;
  s.previous = s.asked = -1;
  s.called = [];
  s.finalCalls = [];
  s.question = "";
  s.until = Date.now() + 480000;
}
function result(
  s: S,
  why: string,
  points: number,
  spyWins: boolean,
  bonus = -1,
) {
  s.players.forEach(
    (p, i) =>
      (p.score +=
        i === s.spy
          ? spyWins
            ? points
            : 0
          : spyWins
            ? 0
            : 1 + (i === bonus ? 1 : 0)),
  );
  log(
    s,
    why +
      " Espião: " +
      s.players[s.spy].name +
      ". Local: " +
      places[s.place][0] +
      ".",
  );
  if (s.round >= 5) {
    finish(s, high(s), "Fim das cinco investigações.");
    return;
  }
  s.phase = "reveal";
  s.turn = s.dealer;
}
function final(s: S) {
  s.phase = "final";
  const pending = s.players
    .map((_, i) => (s.dealer + i) % s.players.length)
    .find((i) => !s.finalCalls.includes(i));
  if (pending === undefined) return result(s, "O espião escapou.", 2, true);
  s.turn = pending;
}
function accuse(s: S, i: number, t: number) {
  s.returnPhase = s.phase;
  s.remaining = Math.max(0, s.until - Date.now());
  s.accuser = i;
  s.accused = t;
  (s.phase === "final" ? s.finalCalls : s.called).push(i);
  s.votes = s.players.map((_, j) => (j === i ? 1 : j === t ? -2 : -1));
  s.phase = "vote";
  s.turn = s.votes.indexOf(-1);
  log(s, s.players[i].name + " acusa " + s.players[t].name + ".");
}
export const spyfall: Rules<S> = {
  id: "spyfall",
  schema,
  setup: (p) => {
    const s: S = {
      ...initial(p),
      place: 0,
      spy: 0,
      roles: [],
      asker: 0,
      previous: -1,
      asked: -1,
      dealer: 0,
      until: 0,
      remaining: 0,
      accuser: -1,
      accused: -1,
      called: [],
      finalCalls: [],
      votes: [],
      returnPhase: "ask",
      question: "",
    };
    round(s);
    return s;
  },
  expired: (s) => ["ask", "answer"].includes(s.phase) && Date.now() >= s.until,
  screen: (s, i) => ({
    heading: (
      {
        ask: "Quem vai responder?",
        answer: "Responda à pergunta",
        vote: "A mesa concorda com a acusação?",
        final: "Última oportunidade de acusar",
        reveal: "Caso encerrado",
        over: "Resultado das investigações",
      } as Record<string, string>
    )[s.phase],
    board: [
      "Rodada " + s.round + " de 5",
      ...(s.phase === "answer" ? [s.question] : []),
      ...(s.phase === "vote" ? ["Acusado: " + s.players[s.accused].name] : []),
      "Locais possíveis: " + places.map((p) => p[0]).join(" · "),
    ],
    privateInfo:
      i === null
        ? []
        : [
            i === s.spy
              ? "Você é o espião. Descubra o local."
              : places[s.place][0] + " · " + s.roles[i],
          ],
    deadline: ["ask", "answer"].includes(s.phase) ? s.until : null,
  }),
  choices: (s, i) => {
    if (s.phase === "over") return [];
    const target = (prefix: string, label: string) =>
      s.players.flatMap((p, j) =>
        j === i ? [] : [opt(prefix + ":" + j, label + p.name)],
      );
    if (s.phase === "vote")
      return i === s.turn
        ? [opt("yes", "Concordo"), opt("no", "Discordo")]
        : [];
    if (s.phase === "reveal")
      return i === s.turn ? [opt("next", "Próxima investigação")] : [];
    if (s.phase === "final")
      return i === s.turn
        ? [...target("accuse", "Acusar "), opt("pass", "Passar")]
        : [];
    if (Date.now() >= s.until) return [];
    const actions =
      i === s.turn
        ? s.phase === "ask"
          ? s.players.flatMap((p, j) =>
              j === i || j === s.previous
                ? []
                : [
                    opt("ask:" + j, "Perguntar a " + p.name, {
                      input: "Pergunta",
                    }),
                  ],
            )
          : [opt("answer", "Responder", { input: "Resposta" })]
        : [];
    if (!s.called.includes(i)) actions.push(...target("accuse", "Acusar "));
    if (i === s.spy)
      actions.push(
        ...places.map((p, j) => opt("guess:" + j, "Palpite · " + p[0])),
      );
    return actions;
  },
  move: (s, i, key, text) => {
    const [k, arg] = key.split(":"),
      t = Number(arg);
    if (k === "timeout") {
      log(s, "Tempo encerrado. Começa a acusação final.");
      return final(s);
    }
    if (k === "next") {
      s.round++;
      s.dealer = next(s, s.dealer);
      return round(s);
    }
    if (k === "guess")
      return result(
        s,
        t === s.place
          ? "O espião acertou o local."
          : "O palpite do espião estava errado.",
        4,
        t === s.place,
      );
    if (k === "ask") {
      s.asked = t;
      s.asker = i;
      s.question = text;
      s.phase = "answer";
      s.turn = t;
      log(s, s.players[i].name + " → " + s.players[t].name + ": " + text);
      return;
    }
    if (k === "answer") {
      log(s, s.players[i].name + ": " + text);
      s.previous = s.asker;
      s.turn = s.asker = i;
      s.phase = "ask";
      return;
    }
    if (k === "accuse") return accuse(s, i, t);
    if (k === "pass") {
      s.finalCalls.push(i);
      return final(s);
    }
    s.votes[i] = k === "yes" ? 1 : 0;
    const pending = s.votes.indexOf(-1);
    if (pending >= 0) {
      s.turn = pending;
      return;
    }
    if (!s.votes.includes(0))
      return result(
        s,
        s.accused === s.spy
          ? "Espião identificado."
          : "A acusação atingiu um inocente.",
        4,
        s.accused !== s.spy,
        s.accuser,
      );
    log(s, "A acusação não foi unânime.");
    if (s.returnPhase === "final") return final(s);
    s.phase = s.returnPhase;
    s.turn = s.phase === "ask" ? s.asker : s.asked;
    s.until = Date.now() + s.remaining;
  },
  bot: (opts) => {
    const guesses = opts.filter((o) => o.key.startsWith("guess:"));
    const o = choose(guesses.length ? guesses : opts);
    return {
      key: o.key,
      ...(o.input
        ? {
            text:
              o.key === "answer"
                ? "Depende do dia e de quem está por perto."
                : "O que chama sua atenção quando você chega?",
          }
        : {}),
    };
  },
};
