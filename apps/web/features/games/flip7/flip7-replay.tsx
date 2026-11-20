"use client";

import { useEffect, useState } from "react";
import { matchReplaySchema, type Match } from "@croebet/shared";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Replay = ReturnType<typeof matchReplaySchema.parse>;
export type ResultMetadata = Pick<Match, "participants" | "entryAmount" | "potTotal" | "payouts" | "durationSeconds">;

export function useFlip7Replay(initial: Replay, startPlaying = false) {
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
    if (!active || !playing || loading || !frame || atEnd || error) return;
    const timer = setTimeout(() => { setLastFrame(frame); setIndex(value => value + 1); }, delay);
    return () => clearTimeout(timer);
  }, [active, playing, loading, frame, atEnd, error, delay]);
  function seek(value: number) { if (frame) setLastFrame(frame); setPlaying(false); setError(""); setIndex(Math.max(0, Math.min(initial.match.frameCount - 1, value))); }
  function restart() { setActive(true); setIndex(0); setError(""); setPlaying(true); }
  const participants = initial.match.players.flatMap(player => player.userId ? [{ userId: player.userId, username: player.name, displayName: player.name, avatarUrl: player.avatarUrl, seat: player.seat }] : []);
  const metadata: ResultMetadata = { participants, entryAmount: initial.match.entryAmount, potTotal: initial.match.potTotal, payouts: initial.match.payouts,
    durationSeconds: initial.match.endedAt ? Math.max(0, Math.floor((Date.parse(initial.match.endedAt) - Date.parse(initial.match.startedAt)) / 1000)) : null };
  const displayedState = active ? (frame ?? lastFrame)?.state : initial.finalState ?? initial.frames.at(-1)?.state;
  return { state: displayedState, active, loading, error, index, playing: playing && !atEnd, delay, atEnd, count: initial.match.frameCount, metadata, seek, restart,
    toggle: () => setPlaying(value => !value), setDelay, retry: () => { setError(""); setAttempt(value => value + 1); } };
}

export function Flip7ReplayControls({ playback }: { playback: ReturnType<typeof useFlip7Replay> }) {
  const { index, count, loading, error, atEnd, seek } = playback;
  return <div className="grid min-w-0 flex-1 gap-2" aria-label="Controles de reprodução">
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Início" disabled={index === 0} onClick={() => seek(0)}><SkipBack className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Jogada anterior" disabled={index === 0} onClick={() => seek(index - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
      <Button size="sm" disabled={loading || atEnd || !!error} onClick={playback.toggle}>{playback.playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}{playback.playing ? "Pausar" : "Reproduzir"}</Button>
      <Button variant="ghost" size="icon-sm" aria-label="Próxima jogada" disabled={atEnd} onClick={() => seek(index + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Final" disabled={atEnd} onClick={() => seek(count - 1)}><SkipForward className="size-4" aria-hidden="true" /></Button>
      <Select aria-label="Velocidade da reprodução" value={playback.delay} onChange={event => playback.setDelay(Number(event.target.value))} className="min-h-8 py-1 text-xs"><option value={2000}>0,5×</option><option value={1000}>1×</option><option value={500}>2×</option></Select>
      <span className="px-2 text-xs text-muted tabular-nums">Jogada {index + 1} de {count}</span>
    </div>
    <Input type="range" aria-label="Ir para jogada" min={0} max={Math.max(0, count - 1)} value={index} onChange={event => seek(Number(event.target.value))} className="h-4 min-h-4 border-0 bg-transparent p-0 accent-brand" />
    {loading && !error && <p role="status" className="text-center text-xs text-muted">Carregando jogadas…</p>}
    {error && <div className="flex flex-wrap items-center justify-center gap-2"><p role="alert" className="text-xs text-muted">{error}</p><Button variant="secondary" size="sm" onClick={playback.retry}>Tentar novamente</Button></div>}
  </div>;
}
