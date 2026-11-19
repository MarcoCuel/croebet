"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { GameRecord } from "@croebet/shared";

const GameLinksContext = createContext<GameRecord[]>([]);
export function GameLinksProvider({ games, children }: { games: GameRecord[]; children: ReactNode }) {
  return <GameLinksContext.Provider value={games}>{children}</GameLinksContext.Provider>;
}
export const useGameLinks = () => useContext(GameLinksContext);
