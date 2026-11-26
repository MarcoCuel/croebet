"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRoom, GameRoomSync } from "@croebet/shared";
import { lovePlaybackView } from "./love-letter/playback-view";
import { standardLogLength } from "./standard-decision";

/** Public frames are presentation only. Commands always use the confirmed room. */
export function useGamePlayback(viewerId?: string, initialRoom: GameRoom | null = null, cue?: () => void) {
  const [room, setRoom] = useState<GameRoom | null>(initialRoom);
  const [animating, setAnimating] = useState(false);
  const confirmed = useRef<GameRoom | null>(initialRoom);
  const queue = useRef<GameRoom[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentationBusy = useRef(false);
  const waiting = useRef(false);
  const resume = useRef<() => void>(() => {});
  const logLength = useRef(standardLogLength(initialRoom?.state));
  const onCue = useRef(cue);
  useEffect(() => { onCue.current = cue; }, [cue]);
  const cueFrame = useCallback((state: unknown) => {
    const length = standardLogLength(state);
    if (length <= logLength.current) return;
    logLength.current = length;
    onCue.current?.();
  }, []);
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
      stop(); setRoom(confirmed.current); setAnimating(false); logLength.current = standardLogLength(confirmed.current?.state); return;
    }
    cueFrame(next);
    setRoom(next);
    const summary = next.status !== "lobby" && next.state.phase === "summary";
    timer.current = setTimeout(nextFrame, summary ? 2400 : 1400);
  }, [stop, cueFrame]);
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
      if (sync.reset) { stop(); setAnimating(false); logLength.current = standardLogLength(sync.room.state); }
      if (!timer.current) setRoom(sync.room);
      return;
    }
    if (sync.reset || !previous || previous.code !== sync.room.code || sync.room.status === "lobby" || !sync.frames.length) {
      stop(); setRoom(sync.room); setAnimating(false); logLength.current = standardLogLength(sync.room.state); return;
    }
    const finalRoom = sync.room;
    const viewer = finalRoom.participants.find(participant => participant.userId === viewerId)?.seat;
    const frames = sync.frames.filter(frame => frame.version > previous.version).map(frame => ({
      ...finalRoom, version: frame.version, status: "playing" as const,
      state: "privateInfo" in frame.state && "privateInfo" in finalRoom.state
        ? lovePlaybackView(frame.state, frame.state.round === finalRoom.state.round || previous.status === "lobby" || !("privateInfo" in previous.state) ? finalRoom.state : previous.state, viewer)
        : frame.state,
    }));
    if (document.hidden) {
      // A hidden tab advances the presentation logically and hears each new
      // action once; returning shows the confirmed state without replaying.
      for (const frame of frames) cueFrame(frame.state);
      stop(); setRoom(finalRoom); setAnimating(false); logLength.current = standardLogLength(finalRoom.state); return;
    }
    queue.current.push(...frames);
    if (!timer.current && queue.current.length) { setAnimating(true); advance(); }
  }, [advance, stop, viewerId, cueFrame]);
  const clear = useCallback(() => { stop(); confirmed.current = null; setRoom(null); setAnimating(false); logLength.current = 0; }, [stop]);
  useEffect(() => {
    const skip = () => {
      if (document.hidden) {
        stop(); setRoom(confirmed.current); setAnimating(false);
        logLength.current = standardLogLength(confirmed.current?.state);
      }
    };
    document.addEventListener("visibilitychange", skip);
    return () => { stop(); document.removeEventListener("visibilitychange", skip); };
  }, [stop]);
  return { room, receive, confirmed, animating, clear, setPresentationBusy };
}
