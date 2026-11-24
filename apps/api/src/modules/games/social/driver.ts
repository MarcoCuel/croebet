import {
  socialActionSchema,
  socialSettings,
  socialViewSchema,
  type SocialAction,
  type GameView,
  type GameEngineAction,
  type SocialView,
} from "@croebet/shared";
import type { MatchDriver } from "../../matches/driver.ts";
import { choose, type Rules, type Base } from "./common.ts";
export function socialDriver<S extends Base>(
  rules: Rules<S>,
): MatchDriver<GameView, GameEngineAction> {
  const parse = (raw: unknown) => rules.schema.parse(raw);
  const valid = (s: S, a: SocialAction) =>
    a.game === rules.id &&
    !!s.players[a.seat]?.active &&
    rules
      .choices(s, a.seat)
      .some((o) => o.key === a.key && Boolean(o.input) === Boolean(a.text));
  function project(s: S, seat: number | null): SocialView {
    const v = rules.screen(s, seat);
    return {
      game: rules.id,
      phase: s.phase,
      round: s.round,
      turn: s.turn,
      winners: s.winners,
      log: s.log,
      heading: v.heading,
      ...(v.table ? { table: v.table } : {}),
      board: v.board ?? [],
      images: v.images ?? [],
      notes: v.privateInfo ?? [],
      hand: v.hand ?? [],
      choices:
        seat !== null && s.players[seat]?.active ? rules.choices(s, seat) : [],
      deadline: v.deadline ?? null,
      players: s.players.map((p, i) => ({
        ...p,
        detail: v.details?.[i] ?? p.score + " pontos",
      })),
    };
  }
  return {
    rulesVersion: 1,
    deferredAutomaticMs: 1200,
    snapshotOnly: true,
    create: (input) => {
      const limits = socialSettings[rules.id];
      if (input.setup.length < limits.min || input.setup.length > limits.max)
        throw Error("Quantidade de jogadores inválida.");
      return rules.setup(input.setup);
    },
    parse,
    project: (raw) => project(parse(raw), null),
    projectFor: (raw, seat) => project(parse(raw), seat),
    authorize: (raw, seat, action) => {
      const a = socialActionSchema.safeParse(action);
      return a.success && a.data.seat === seat && valid(parse(raw), a.data);
    },
    apply: (raw, action) => {
      const s = parse(raw),
        a = socialActionSchema.parse(action);
      const timer =
        a.game === rules.id &&
        a.key === "timeout" &&
        a.seat === s.turn &&
        rules.expired?.(s);
      if (!timer && !valid(s, a)) throw Error("ILLEGAL_ACTION");
      rules.move(s, a.seat, a.key, a.text ?? "");
      s.step++;
      return s;
    },
    automatic: (raw) => {
      const s = parse(raw);
      if (s.phase === "over") return null;
      const seat = s.turn;
      const a = { type: "social-choice" as const, game: rules.id, seat };
      if (rules.expired?.(s)) return { ...a, key: "timeout" };
      if (s.players[seat].kind === "human") return null;
      const opts = rules.choices(s, seat);
      if (!opts.length) return null;
      const o = rules.bot?.(opts, s, seat) ?? choose(opts);
      return {
        ...a,
        key: o.key,
        ...("text" in o && o.text ? { text: o.text } : {}),
      };
    },
    finished: (raw) => parse(raw).phase === "over",
    decision: (raw) => {
      const s = parse(raw);
      return s.phase !== "over" && s.players[s.turn].kind === "human"
        ? { seat: s.turn, key: s.round + ":" + s.step }
        : null;
    },
    human: (raw, i) => parse(raw).players[i]?.kind === "human",
    replace: (raw, i) => {
      const s = parse(raw);
      if (!s.players[i]) throw Error("ILLEGAL_ACTION");
      s.players[i].kind = "normal";
      return s;
    },
    eventAction: () => ({ type: "step" }),
    outcome: (raw) => {
      const s = parse(raw);
      return {
        winners: s.winners,
        humanSeats: s.players.flatMap((p, i) =>
          p.kind === "human" ? [i] : [],
        ),
      };
    },
    summarize: (raw) => {
      const s = socialViewSchema.parse(raw);
      return s.players.map((p, i) => ({
        name: p.name,
        score: p.score,
        bot: p.kind !== "human",
        winner: s.winners.includes(i),
      }));
    },
  };
}
