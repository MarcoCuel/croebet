import { z } from "zod";
import {
  base,
  initial,
  opt,
  shuffled,
  others,
  next,
  finish,
  log,
  choose,
  type Rules,
} from "./common.ts";
const side = z.enum(["Liberal", "Fascista"]),
  role = z.enum(["Liberal", "Fascista", "Hitler"]);
const schema = base.extend({
  roles: z.array(role),
  deck: z.array(side),
  discard: z.array(side),
  hand: z.array(side),
  lib: z.number(),
  fas: z.number(),
  failed: z.number(),
  pres: z.number(),
  ch: z.number(),
  lastPres: z.number(),
  lastCh: z.number(),
  resume: z.number(),
  ballots: z.array(z.number()),
  known: z.array(z.array(z.string())),
  checked: z.array(z.number()),
  veto: z.boolean(),
});
type S = z.infer<typeof schema>;
const party = (r: string) => (r === "Liberal" ? "Liberal" : "Fascista");
function win(s: S, p: string, reason: string) {
  const w = s.roles.flatMap((r, i) => (party(r) === p ? [i] : []));
  w.forEach((i) => (s.players[i].score = 1));
  finish(s, w, reason);
}
function restock(s: S) {
  if (s.deck.length < 3) {
    s.deck = shuffled([...s.deck, ...s.discard]);
    s.discard = [];
  }
}
function nominate(s: S) {
  s.pres = next(s, s.resume >= 0 ? s.resume : s.pres);
  s.resume = -1;
  s.turn = s.pres;
  s.phase = "nominate";
  s.round++;
}
function policy(s: S, v: "Liberal" | "Fascista", chaos = false) {
  log(
    s,
    "Política " +
      v.toLowerCase() +
      " aprovada" +
      (chaos ? " por instabilidade." : "."),
  );
  if (v === "Liberal") s.lib++;
  else s.fas++;
  restock(s);
  if (s.lib === 5) return win(s, "Liberal", "Cinco políticas liberais.");
  if (s.fas === 6) return win(s, "Fascista", "Seis políticas fascistas.");
  let power = "";
  if (v === "Fascista" && !chaos) {
    if (s.fas >= 4) power = "remove";
    else if (s.fas === 3) power = s.players.length < 7 ? "peek" : "special";
    else if (
      (s.fas === 2 && s.players.length >= 7) ||
      (s.fas === 1 && s.players.length >= 9)
    )
      power = "inspect";
  }
  if (!power) return nominate(s);
  s.phase = power;
  s.turn = s.pres;
  if (power === "peek")
    s.known[s.pres].push(
      "Próximas três políticas: " + s.deck.slice(-3).reverse().join(" • "),
    );
}
function fail(s: S) {
  if (++s.failed < 3) return nominate(s);
  s.failed = 0;
  s.lastPres = s.lastCh = -1;
  const forced = s.deck.pop()!;
  policy(s, forced, true);
}
export const government: Rules<S> = {
  id: "secret-hitler",
  schema,
  setup: (p) => {
    const f = Math.floor((p.length - 1) / 2) - 1;
    const roles = shuffled([
      ...Array<"Fascista">(f).fill("Fascista"),
      "Hitler" as const,
      ...Array<"Liberal">(p.length - 1 - f).fill("Liberal"),
    ]);
    const pres = shuffled(p.map((_, i) => i))[0];
    return {
      ...initial(p),
      turn: pres,
      phase: "nominate",
      roles,
      deck: shuffled([
        ...Array<"Liberal">(6).fill("Liberal"),
        ...Array<"Fascista">(11).fill("Fascista"),
      ]),
      discard: [],
      hand: [],
      lib: 0,
      fas: 0,
      failed: 0,
      pres,
      ch: -1,
      lastPres: -1,
      lastCh: -1,
      resume: -1,
      ballots: p.map(() => -1),
      known: p.map(() => []),
      checked: [],
      veto: false,
    };
  },
  screen: (s, i) => ({
    table: { kind: "parliament", liberal: s.lib, fascist: s.fas, failed: s.failed },
    heading: (
      {
        nominate: "Indicar um chanceler",
        vote: "Votação do governo",
        president: "Presidente descarta uma política",
        chancellor: "Chanceler escolhe a política",
        veto: "Presidente decide o veto",
        inspect: "Investigar filiação",
        special: "Indicar presidente extraordinário",
        remove: "Escolher jogador para eliminação",
        peek: "Consultar o topo da pilha",
        over: "Resultado do parlamento",
      } as Record<string, string>
    )[s.phase],
    board: [
      "Liberais " + s.lib + "/5 · Fascistas " + s.fas + "/6",
      "Eleições frustradas " + s.failed + "/3",
      "Presidente: " +
        s.players[s.pres].name +
        (s.phase !== "nominate" && s.ch >= 0
          ? " · Chanceler: " + s.players[s.ch].name
          : ""),
    ],
    privateInfo:
      i === null
        ? []
        : [
            "Seu papel: " + s.roles[i],
            ...(s.roles[i] === "Fascista" ||
            (s.roles[i] === "Hitler" && s.players.length <= 6)
              ? s.roles.flatMap((r, j) =>
                  j !== i && r !== "Liberal"
                    ? [s.players[j].name + " · " + r]
                    : [],
                )
              : []),
            ...s.known[i],
            ...((s.phase === "president" && s.pres === i) ||
            (s.phase === "chancellor" && s.ch === i)
              ? ["Dossiê: " + s.hand.join(" • ")]
              : []),
          ],
    details: s.players.map((p, j) =>
      s.phase === "over" ? s.roles[j] : p.active ? "Em mandato" : "Eliminado",
    ),
  }),
  choices: (s, i) => {
    if (i !== s.turn || s.phase === "over") return [];
    const alive = s.players.filter((p) => p.active).length;
    if (
      s.phase === "nominate" ||
      ["inspect", "remove", "special"].includes(s.phase)
    )
      return others(s, i)
        .filter((t) =>
          s.phase === "nominate"
            ? t !== s.lastCh && (alive <= 5 || t !== s.lastPres)
            : s.phase === "inspect"
              ? !s.checked.includes(t)
              : true,
        )
        .map((t) => opt("seat:" + t, s.players[t].name));
    if (s.phase === "vote" || s.phase === "veto")
      return [opt("yes", "Sim"), opt("no", "Não")];
    if (s.phase === "peek") return [opt("done", "Concluir consulta")];
    return [
      ...s.hand.map((v, j) =>
        opt(
          "policy:" + j,
          (s.phase === "president" ? "Descartar " : "Aprovar ") + v,
        ),
      ),
      ...(s.phase === "chancellor" && s.fas >= 5 && !s.veto
        ? [opt("veto", "Solicitar veto")]
        : []),
    ];
  },
  move: (s, i, key) => {
    const j = Number(key.split(":")[1]);
    switch (s.phase) {
      case "nominate":
        s.ch = j;
        s.phase = "vote";
        s.ballots.fill(-1);
        s.turn = s.players.findIndex((p) => p.active);
        log(s, "Chapa: " + s.players[i].name + " e " + s.players[j].name + ".");
        return;
      case "vote": {
        s.ballots[i] = key === "yes" ? 1 : 0;
        const waiting = s.players.findIndex(
          (p, k) => p.active && s.ballots[k] === -1,
        );
        if (waiting >= 0) {
          s.turn = waiting;
          return;
        }
        log(
          s,
          "Votos: " +
            s.players
              .flatMap((p, k) =>
                p.active ? [p.name + " " + (s.ballots[k] ? "sim" : "não")] : [],
              )
              .join(", ") +
            ".",
        );
        if (
          s.ballots.filter((v) => v === 1).length <=
          s.players.filter((p) => p.active).length / 2
        )
          return fail(s);
        if (s.fas >= 3 && s.roles[s.ch] === "Hitler")
          return win(
            s,
            "Fascista",
            "Hitler eleito chanceler após três políticas fascistas.",
          );
        s.lastPres = s.pres;
        s.lastCh = s.ch;
        restock(s);
        s.hand = s.deck.splice(-3);
        s.turn = s.pres;
        s.phase = "president";
        s.veto = false;
        return;
      }
      case "president":
        s.discard.push(...s.hand.splice(j, 1));
        s.phase = "chancellor";
        s.turn = s.ch;
        return;
      case "chancellor":
        if (key === "veto") {
          s.veto = true;
          s.phase = "veto";
          s.turn = s.pres;
          return;
        }
        {
          const [law] = s.hand.splice(j, 1);
          s.discard.push(...s.hand);
          s.hand = [];
          s.failed = 0;
          policy(s, law);
          return;
        }
      case "veto":
        if (key === "yes") {
          s.discard.push(...s.hand);
          s.hand = [];
          restock(s);
          return fail(s);
        }
        s.phase = "chancellor";
        s.turn = s.ch;
        return;
      case "remove":
        s.players[j].active = false;
        log(s, s.players[j].name + " foi eliminado.");
        if (s.roles[j] === "Hitler")
          return win(s, "Liberal", "Hitler foi eliminado.");
        break;
      case "inspect":
        s.checked.push(j);
        s.known[i].push(
          s.players[j].name + " tem filiação " + party(s.roles[j]) + ".",
        );
        log(s, s.players[i].name + " investigou " + s.players[j].name + ".");
        break;
      case "special":
        s.resume = s.pres;
        s.pres = j;
        s.turn = j;
        s.phase = "nominate";
        s.round++;
        return;
    }
    nominate(s);
  },
  bot: (options) => choose(options),
};
