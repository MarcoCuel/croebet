"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRoom, GameRoomSync } from "@croebet/shared";

/** Public frames are presentation only. Commands always use the confirmed room. */
export function useGamePlayback() {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [animating, setAnimating] = useState(false);
  const confirmed = useRef<GameRoom | null>(null);
  const queue = useRef<GameRoom[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
  }, []);
  const advance = useCallback(function nextFrame() {
    const next = queue.current.shift();
    if (!next || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stop(); setRoom(confirmed.current); setAnimating(false); return;
    }
    setRoom(next);
    const summary = next.status !== "lobby" && next.state.phase === "summary";
    timer.current = setTimeout(nextFrame, summary ? 2400 : 1400);
  }, [stop]);
  const receive = useCallback((sync: GameRoomSync) => {
    const previous = confirmed.current;
    if (previous?.code === sync.room.code && previous.version > sync.room.version) return;
    confirmed.current = sync.room;
    if (previous?.code === sync.room.code && previous.version === sync.room.version) {
      if (sync.reset) { stop(); setAnimating(false); }
      if (!timer.current) setRoom(sync.room);
      return;
    }
    if (sync.reset || !previous || previous.code !== sync.room.code || sync.room.status === "lobby" || !sync.frames.length) {
      stop(); setRoom(sync.room); setAnimating(false); return;
    }
    const finalRoom = sync.room;
    queue.current.push(...sync.frames.filter(frame => frame.version > previous.version).map(frame => ({
      ...finalRoom, version: frame.version, status: "playing" as const, state: frame.state,
    })));
    if (!timer.current && queue.current.length) { setAnimating(true); advance(); }
  }, [advance, stop]);
  const clear = useCallback(() => { stop(); confirmed.current = null; setRoom(null); setAnimating(false); }, [stop]);
  useEffect(() => {
    const skip = () => {
      if (document.hidden) { stop(); setRoom(confirmed.current); setAnimating(false); }
    };
    document.addEventListener("visibilitychange", skip);
    return () => { stop(); document.removeEventListener("visibilitychange", skip); };
  }, [stop]);
  return { room, receive, confirmed, animating, clear };
}
