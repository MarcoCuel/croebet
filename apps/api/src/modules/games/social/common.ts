import { randomInt } from "node:crypto";
import { z } from "zod";
import type { Choice, SocialId, SocialView } from "@croebet/shared";
export const person = z.object({
  name: z.string(),
  kind: z.enum(["human", "normal"]),
  active: z.boolean(),
  score: z.number().int(),
});
export const base = z.object({
  players: z.array(person),
  round: z.number().int().positive(),
  turn: z.number().int().nonnegative(),
  phase: z.string(),
  log: z.array(z.string()),
  winners: z.array(z.number().int()),
  step: z.number().int(),
});
export type Base = z.infer<typeof base>;
export type Seats = { name: string; kind: "human" | "normal" }[];
export function initial(people: Seats): Base {
  return {
    players: people.map((p) => ({ ...p, active: true, score: 0 })),
    round: 1,
    turn: 0,
    phase: "start",
    winners: [],
    log: [],
    step: 0,
  };
}
export function shuffled<T>(cards: T[]): T[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function next(s: Base, from: number) {
  for (let n = 1; n <= s.players.length; n++) {
    const i = (from + n) % s.players.length;
    if (s.players[i].active) return i;
  }
  throw Error("Partida sem participantes ativos.");
}
export function others(s: Base, from: number) {
  return s.players
    .map((_, i) => (from + 1 + i) % s.players.length)
    .filter((i) => i !== from && s.players[i].active);
}
export const opt = (
  key: string,
  label: string,
  extra: Partial<Choice> = {},
): Choice => ({ key, label, ...extra });
export function log(s: Base, msg: string) {
  s.log = [...s.log.slice(-79), msg];
}
export function finish(s: Base, winners: number[], why: string) {
  s.winners = winners;
  s.phase = "over";
  log(s, why);
}
export function high(s: Base) {
  const best = Math.max(...s.players.map((p) => p.score));
  return s.players.flatMap((p, i) => (p.score === best ? [i] : []));
}
export type Screen = {
  table?: SocialView["table"];
  heading: string;
  board?: string[];
  images?: number[];
  privateInfo?: string[];
  hand?: number[];
  deadline?: number | null;
  details?: string[];
};
export interface Rules<S extends Base> {
  id: SocialId;
  schema: z.ZodType<S>;
  setup: (p: Seats) => S;
  screen: (s: S, viewer: number | null) => Screen;
  choices: (s: S, seat: number) => Choice[];
  move: (s: S, seat: number, key: string, text: string) => void;
  bot?: (
    choices: Choice[],
    s: S,
    seat: number,
  ) => { key: string; text?: string };
  expired?: (s: S) => boolean;
}
export function choose(choices: Choice[]) {
  return choices[randomInt(choices.length)];
}
