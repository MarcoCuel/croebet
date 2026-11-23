"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRoom, GameRoomSync } from "@croebet/shared";
import { lovePlaybackView } from "./love-letter/playback-view";

/** Public frames are presentation only. Commands always use the confirmed room. */
export function useGamePlayback(viewerId?: string, initialRoom: GameRoom | null = null) {
  const [room, setRoom] = useState<GameRoom | null>(initialRoom);
  const [animating, setAnimating] = useState(false);
  const confirmed = useRef<GameRoom | null>(initialRoom);
  const queue = useRef<GameRoom[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentationBusy = useRef(false);
  const waiting = useRef(false);
  const resume = useRef<() => void>(() => {});
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
    waiting.current = false;
  }, []);
  const advance = useCallback(function nextFrame() {
    if (presentationBusy.current && !document.hidden) { waiting.current = true; return; }
    waiting.current = false;
    const next = queue.current.shift();
    if (!next || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stop(); setRoom(confirmed.current); setAnimating(false); return;
    }
    setRoom(next);
    const summary = next.status !== "lobby" && next.state.phase === "summary";
    timer.current = setTimeout(nextFrame, summary ? 2400 : 1400);
  }, [stop]);
  useEffect(() => { resume.current = advance; }, [advance]);
  const setPresentationBusy = useCallback((busy: boolean) => {
    presentationBusy.current = busy;
    if (!busy && waiting.current) {
      waiting.current = false;
      timer.current = setTimeout(() => resume.current(), 0);
    }
  }, []);
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
    const viewer = finalRoom.participants.find(participant => participant.userId === viewerId)?.seat;
    queue.current.push(...sync.frames.filter(frame => frame.version > previous.version).map(frame => ({
      ...finalRoom, version: frame.version, status: "playing" as const,
      state: "privateInfo" in frame.state && "privateInfo" in finalRoom.state
        ? lovePlaybackView(frame.state, frame.state.round === finalRoom.state.round || previous.status === "lobby" || !("privateInfo" in previous.state) ? finalRoom.state : previous.state, viewer)
        : frame.state,
    })));
    if (!timer.current && queue.current.length) { setAnimating(true); advance(); }
  }, [advance, stop, viewerId]);
  const clear = useCallback(() => { stop(); confirmed.current = null; setRoom(null); setAnimating(false); }, [stop]);
  useEffect(() => {
    const skip = () => {
      if (document.hidden) { stop(); setRoom(confirmed.current); setAnimating(false); }
    };
    document.addEventListener("visibilitychange", skip);
    return () => { stop(); document.removeEventListener("visibilitychange", skip); };
  }, [stop]);
  return { room, receive, confirmed, animating, clear, setPresentationBusy };
}
