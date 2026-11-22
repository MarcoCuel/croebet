"use client";

import type { ComponentProps } from "react";
import { GameResult } from "../game-result";
import type { Game } from "./presentation";
import { flip7Result } from "./result-summary";

export function Flip7Result({ game, ...props }: Omit<ComponentProps<typeof GameResult>, "result"> & { game: Game }) {
  return <GameResult result={flip7Result(game)} {...props} />;
}
