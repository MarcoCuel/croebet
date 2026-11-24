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
const roles = [
  "Duque",
  "Assassino",
  "Capitão",
  "Embaixador",
  "Condessa",
] as const;
const claim: Record<string, string> = {
  tax: "Duque",
  steal: "Capitão",
  kill: "Assassino",
  exchange: "Embaixador",
};
const names: Record<string, string> = {
  income: "Renda",
  aid: "Ajuda externa",
  tax: "Tributo",
  steal: "Extorsão",
  kill: "Assassinato",
  exchange: "Troca",
  coup: "Golpe",
};
const schema = base.extend({
  deck: z.array(z.string()),
  hands: z.array(z.array(z.string())),
  shown: z.array(z.array(z.string())),
  coins: z.array(z.number()),
  actor: z.number(),
  target: z.number(),
  action: z.string(),
  queue: z.array(z.number()),
  blocker: z.number(),
  blockRole: z.string(),
  after: z.enum(["end", "resolve", "blocked", "block", "retry"]),
  keep: z.number(),
});
type S = z.infer<typeof schema>;
function end(s: S) {
  s.actor = next(s, s.actor);
  s.turn = s.actor;
  s.phase = "action";
  s.queue = [];
  s.round++;
}
function wait(s: S, phase: string, queue: number[]) {
  s.phase = phase;
  s.queue = queue;
  s.turn = queue[0];
}
function lose(s: S, seat: number, after: S["after"]) {
  s.phase = "loss";
  s.turn = seat;
  s.after = after;
}
function blocks(s: S) {
  return s.action === "aid"
    ? ["Duque"]
    : s.action === "steal"
      ? ["Capitão", "Embaixador"]
      : s.action === "kill"
        ? ["Condessa"]
        : [];
}
function resolve(s: S) {
  const { actor: a, target: t, action: k } = s;
  if (k === "kill" || k === "coup") {
    if (s.players[t].active) return lose(s, t, "end");
  }
  if (k === "steal" && s.players[t].active) {
    const n = Math.min(2, s.coins[t]);
    s.coins[t] -= n;
    s.coins[a] += n;
  }
  if (k === "tax") s.coins[a] += 3;
  if (k === "income") s.coins[a]++;
  if (k === "aid") s.coins[a] += 2;
  if (k === "exchange") {
    s.keep = s.hands[a].length;
    s.hands[a].push(...s.deck.splice(-2));
    s.phase = "exchange";
    s.turn = a;
    return;
  }
  end(s);
}
function offerBlock(s: S) {
  const eligible =
    s.action === "aid"
      ? others(s, s.actor)
      : s.target >= 0 && s.players[s.target].active
        ? [s.target]
        : [];
  if (blocks(s).length && eligible.length) wait(s, "block", eligible);
  else resolve(s);
}
function proceed(s: S) {
  s.queue.shift();
  if (s.queue.length) {
    s.turn = s.queue[0];
    return;
  }
  if (s.phase === "claim") offerBlock(s);
  else if (s.phase === "block") resolve(s);
  else end(s);
}
function challenge(s: S, seat: number) {
  const counter = s.phase === "challenge-block",
    owner = counter ? s.blocker : s.actor,
    role = counter ? s.blockRole : claim[s.action];
  const at = s.hands[owner].indexOf(role);
  log(s, s.players[seat].name + " desafiou " + s.players[owner].name + ".");
  if (at >= 0) {
    s.deck = shuffled([...s.deck, role]);
    s.hands[owner][at] = s.deck.pop()!;
    log(s, "Reivindicação comprovada: " + role + ".");
    lose(s, seat, counter ? "blocked" : "block");
  } else {
    log(s, "Blefe descoberto.");
    lose(s, owner, counter ? "resolve" : "end");
  }
}
export const coup: Rules<S> = {
  id: "coup",
  schema,
  setup: (people) => {
    const b = initial(people),
      deck = shuffled([...roles, ...roles, ...roles]);
    return {
      ...b,
      phase: "action",
      hands: people.map(() => deck.splice(-2)),
      deck,
      coins: people.map((_, i) => (people.length === 2 && i === 0 ? 1 : 2)),
      shown: people.map(() => []),
      actor: 0,
      target: -1,
      action: "",
      queue: [],
      blocker: -1,
      blockRole: "",
      after: "end",
      keep: 0,
    };
  },
  screen: (s, i) => ({
    heading: (
      {
        action: "Escolha uma ação",
        claim: "Desafiar a influência?",
        block: "Declarar bloqueio?",
        "challenge-block": "Contestar o bloqueio?",
        loss: "Escolha a influência que será revelada",
        exchange: "Devolva duas cartas à corte",
        over: "Última família com influência",
      } as Record<string, string>
    )[s.phase],
    board: [
      "Tesouro da corte · moedas desta mesa",
      s.action && s.phase !== "action"
        ? "Última ação: " + names[s.action]
        : "Reivindique um personagem ou use uma ação de renda.",
    ],
    privateInfo: i === null ? [] : s.hands[i].map((v) => "Influência · " + v),
    details: s.shown.map(
      (r, j) =>
        s.coins[j] +
        " moedas · " +
        s.hands[j].length +
        " ocultas" +
        (r.length ? " · reveladas: " + r.join(", ") : ""),
    ),
  }),
  choices: (s, i) => {
    if (i !== s.turn || s.phase === "over") return [];
    if (s.phase === "action") {
      const ops =
        s.coins[i] >= 10
          ? ["coup"]
          : [
              "income",
              "aid",
              "tax",
              "exchange",
              "steal",
              ...(s.coins[i] >= 3 ? ["kill"] : []),
              ...(s.coins[i] >= 7 ? ["coup"] : []),
            ];
      return ops.flatMap((k) =>
        ["kill", "coup", "steal"].includes(k)
          ? others(s, i)
              .filter((t) => k !== "steal" || s.coins[t] > 0)
              .map((t) =>
                opt(k + ":" + t, names[k] + " · " + s.players[t].name),
              )
          : [opt(k, names[k] + (claim[k] ? " · " + claim[k] : ""))],
      );
    }
    if (s.phase === "loss" || s.phase === "exchange")
      return s.hands[i].map((v, n) => opt("card:" + n, v));
    if (s.phase === "block")
      return [
        opt("pass", "Passar"),
        ...blocks(s).map((r) => opt("block:" + r, "Bloquear como " + r)),
      ];
    return [opt("pass", "Aceitar"), opt("challenge", "Desafiar")];
  },
  move: (s, i, key) => {
    const [k, arg] = key.split(":");
    if (s.phase === "action") {
      s.action = k;
      s.target = arg === undefined ? -1 : Number(arg);
      s.blocker = -1;
      s.coins[i] -= k === "kill" ? 3 : k === "coup" ? 7 : 0;
      log(
        s,
        s.players[i].name +
          " declarou " +
          names[k] +
          (s.target >= 0 ? " contra " + s.players[s.target].name : "") +
          ".",
      );
      if (claim[k]) wait(s, "claim", others(s, i));
      else if (k === "aid") offerBlock(s);
      else resolve(s);
      return;
    }
    if (s.phase === "loss") {
      const [role] = s.hands[i].splice(Number(arg), 1);
      s.shown[i].push(role);
      log(s, s.players[i].name + " revelou " + role + ".");
      if (!s.hands[i].length) {
        s.players[i].active = false;
        s.coins[i] = 0;
      }
      const alive = s.players.flatMap((p, j) => (p.active ? [j] : []));
      if (alive.length === 1) {
        s.players[alive[0]].score = 1;
        finish(s, alive, "Fim da disputa de influência.");
        return;
      }
      if (s.after === "block") offerBlock(s);
      else if (s.after === "resolve") resolve(s);
      else end(s);
      return;
    }
    if (s.phase === "exchange") {
      s.deck.push(...s.hands[i].splice(Number(arg), 1));
      if (s.hands[i].length === s.keep) {
        s.deck = shuffled(s.deck);
        end(s);
      }
      return;
    }
    if (k === "pass") {
      proceed(s);
      return;
    }
    if (k === "challenge") {
      challenge(s, i);
      return;
    }
    s.blocker = i;
    s.blockRole = arg;
    log(s, s.players[i].name + " bloqueou como " + arg + ".");
    wait(s, "challenge-block", others(s, i));
  },
  bot: (options) => {
    const coups = options.filter((o) => o.key.startsWith("coup:"));
    return choose(coups.length ? coups : options);
  },
};
