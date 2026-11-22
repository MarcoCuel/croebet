"use client";

import { useCallback, useEffect, useState } from "react";
import { matchReplaySchema } from "@croebet/shared";
import type { ResultMetadata } from "../game-result";
import { ReplayControls } from "../replay-controls";
import { Button } from "@/components/ui/button";

type Replay = ReturnType<typeof matchReplaySchema.parse>;
export type { ResultMetadata } from "../game-result";

export function useFlip7Replay(initial: Replay, startPlaying = false) {
  const [epoch, setEpoch] = useState(0);
  const [presentedIndex, setPresentedIndex] = useState(0);
  const [animationPaused, setAnimationPaused] = useState(false);
  const onPresented = useCallback((value: number) => setPresentedIndex(value), []);
  const [page, setPage] = useState(initial);
  const [index, setIndex] = useState(0);
  const [lastFrame, setLastFrame] = useState(initial.frames[0]);
  const [playing, setPlaying] = useState(startPlaying);
  const [active, setActive] = useState(startPlaying);
  const [delay, setDelay] = useState(1000);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const offset = Math.floor(index / 100) * 100;
  const visiblePage = offset === initial.offset ? initial : page;
  const loading = offset !== visiblePage.offset;
  const frame = loading ? undefined : visiblePage.frames[index - visiblePage.offset];
  const atEnd = index >= initial.match.frameCount - 1;
  const presenting = presentedIndex !== index;
  useEffect(() => {
    if (offset === initial.offset) return;
    const controller = new AbortController();
    void fetch(`/api/v1/me/matches/${initial.match.code}?offset=${offset}&limit=100`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Entre novamente para rever a partida." : response.status === 404 ? "Partida não encontrada." : "Não foi possível carregar as jogadas.");
        return matchReplaySchema.parse(await response.json());
      }).then(value => { if (!controller.signal.aborted) { setPage(value); setError(""); } })
      .catch(reason => { if (!controller.signal.aborted) { setPlaying(false); setError(reason instanceof Error ? reason.message : "Não foi possível carregar as jogadas."); } });
    return () => controller.abort();
  }, [initial, offset, attempt]);
  useEffect(() => {
    if (!active || !playing || loading || !frame || atEnd || error || presenting) return;
    const timer = setTimeout(() => { setLastFrame(frame); setIndex(value => value + 1); }, delay);
    return () => clearTimeout(timer);
  }, [active, playing, loading, frame, atEnd, error, delay, presenting]);
  function seek(value: number, animate = false) {
    const target = Math.max(0, Math.min(initial.match.frameCount - 1, value));
    if (frame) setLastFrame(frame);
    setPlaying(false); setAnimationPaused(false); setError("");
    // Scrubbing always restores a snapshot, including a one-frame movement.
    if (!animate || target !== index + 1 || presenting) setEpoch(value => value + 1);
    setIndex(target);
  }
  function restart() { setEpoch(value => value + 1); setActive(true); setIndex(0); setError(""); setAnimationPaused(false); setPlaying(true); }
  const participants = initial.match.players.flatMap(player => player.userId ? [{ userId: player.userId, username: player.name, displayName: player.name, avatarUrl: player.avatarUrl, seat: player.seat }] : []);
  const metadata: ResultMetadata = { participants, entryAmount: initial.match.entryAmount, potTotal: initial.match.potTotal, payouts: initial.match.payouts,
    activeDurationSeconds: initial.match.activeDurationSeconds,
    durationSeconds: initial.match.durationSeconds ?? (!initial.match.development && initial.match.endedAt ? Math.max(0, Math.floor((Date.parse(initial.match.endedAt) - Date.parse(initial.match.startedAt)) / 1000)) : null) };
  const displayedState = active ? (frame ?? lastFrame)?.state : initial.finalState ?? initial.frames.at(-1)?.state;
  return { state: displayedState, frame, epoch, onPresented, animationPaused, presenting, active, loading, error, index, playing: playing && (!atEnd || presenting), delay, atEnd, count: initial.match.frameCount, metadata, seek, step: () => seek(index + 1, true), restart,
    toggle: () => { setPlaying(value => !value); setAnimationPaused(playing); }, setDelay, retry: () => { setError(""); setAttempt(value => value + 1); } };
}

export function Flip7ReplayControls({ playback }: { playback: ReturnType<typeof useFlip7Replay> }) {
  const { loading, error } = playback;
  return <div className="grid min-w-0 flex-1 gap-2">
    <ReplayControls {...playback} />
    {loading && !error && <p role="status" className="text-center text-xs text-muted">Carregando jogadas…</p>}
    {error && <div className="flex flex-wrap items-center justify-center gap-2"><p role="alert" className="text-xs text-muted">{error}</p><Button variant="secondary" size="sm" onClick={playback.retry}>Tentar novamente</Button></div>}
  </div>;
}
