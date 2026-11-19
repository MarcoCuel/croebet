export type GameMode = "classic" | "vengeance";
export type GameOptions = { mode: GameMode; brutal: boolean };
export type PlayerKind = "human" | "easy" | "normal" | "hard";
export type Setup = { name: string; kind: PlayerKind };
export type Card = {
  id: number;
  type: "number" | "bonus" | "double" | "chance" | "freeze" | "three"
    | "zero" | "unlucky7" | "lucky13" | "minus" | "halve" | "one" | "four" | "steal" | "swap" | "remove";
  value: number;
};
export type Player = Setup & { cards: Card[]; total: number; hasDrawn: boolean; status: "playing" | "stayed" | "frozen" | "busted"; bustedCards?: number[] };
export type Pending = { source: number; card: Card; give?: boolean; resolving?: boolean };
export type LogEntry = { message: string; player?: number; card?: Card };
export type Game = {
  mode: GameMode; brutal: boolean;
  players: Player[]; deck: Card[]; discard: Card[]; turn: number; round: number;
  phase: "playing" | "summary" | "over"; seed: number;
  pending: Pending | null; queue: Pending[];
  forced: { target: number; remaining: number; queueStart?: number; stopAfter?: boolean } | null;
  history: number[][]; log: LogEntry[]; flip7: number | null; lastDraw: Card | null;
  bonusChoice?: number | null; bonusTarget?: number | null;
};
export type Action = { type: "draw" | "stay" | "step" | "next" }
  | { type: "target"; target: number }
  | { type: "cards"; cards: number[] }
  | { type: "bonus"; target: number | null };
