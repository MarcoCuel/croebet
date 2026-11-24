"use client";
import { useEffect, useRef } from "react";
import { useGameAudio } from "./use-game-audio";

type Cue = Parameters<ReturnType<typeof useGameAudio>["play"]>[0];
export function useTableCue(
  matchId: string,
  version: number,
  cue: Cue,
  live: boolean,
  balances?: string,
) {
  const audio = useGameAudio();
  const previous = useRef({ matchId, version, balances });
  const { play } = audio;
  useEffect(() => {
    const before = previous.current;
    previous.current = { matchId, version, balances };
    if (live && before.matchId === matchId && version === before.version + 1) {
      const coinsMoved =
        balances !== undefined &&
        before.balances !== undefined &&
        balances !== before.balances;
      play(cue === "slide" && coinsMoved ? "entry" : cue);
    }
  }, [matchId, version, cue, live, balances, play]);
  return audio;
}
