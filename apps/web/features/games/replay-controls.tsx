"use client";

import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Props = {
  index: number; count: number; playing: boolean; delay: number;
  loading: boolean; error: string; presenting?: boolean;
  seek: (index: number) => void; step?: () => void; toggle: () => void; setDelay: (delay: number) => void;
};

export function ReplayControls({ index, count, playing, delay, loading, error, presenting = false, seek, step, toggle, setDelay }: Props) {
  const atEnd = index >= count - 1;
  return <div className="@container/replay grid min-w-0 flex-1 gap-2" aria-label="Controles de reprodução">
    <div className="grid grid-cols-2 items-center gap-x-2 gap-y-2 @min-[32rem]/replay:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="col-start-1 row-start-1 justify-self-start"><Select aria-label="Velocidade da reprodução" value={delay} onChange={event => setDelay(Number(event.target.value))} className="min-h-8 w-fit py-1 text-xs"><option value={2000}>0,5×</option><option value={1000}>1×</option><option value={500}>2×</option></Select></div>
      <div className="col-span-2 row-start-2 flex items-center justify-center gap-1 @min-[32rem]/replay:col-span-1 @min-[32rem]/replay:col-start-2 @min-[32rem]/replay:row-start-1">
        <Button variant="ghost" size="icon-sm" aria-label="Início" disabled={index === 0} onClick={() => seek(0)}><SkipBack className="size-4" aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Jogada anterior" disabled={index === 0} onClick={() => seek(index - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
        <Button size="sm" className="min-w-9 @min-[32rem]/replay:min-w-28" aria-label={playing ? "Pausar" : "Reproduzir"} disabled={loading || (atEnd && !presenting) || !!error} onClick={toggle}>{playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}<span className="hidden @min-[32rem]/replay:inline">{playing ? "Pausar" : "Reproduzir"}</span></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Próxima jogada" disabled={atEnd || presenting || loading} onClick={() => step ? step() : seek(index + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Final" disabled={atEnd} onClick={() => seek(count - 1)}><SkipForward className="size-4" aria-hidden="true" /></Button>
      </div>
      <span className="col-start-2 row-start-1 justify-self-end whitespace-nowrap text-xs text-muted tabular-nums @min-[32rem]/replay:col-start-3">Jogada {index + 1} de {count}</span>
    </div>
    <Input type="range" aria-label="Ir para jogada" min={0} max={Math.max(0, count - 1)} value={index} onChange={event => seek(Number(event.target.value))} className="h-4 min-h-4 cursor-pointer appearance-none border-0 bg-transparent p-0 accent-brand focus-visible:ring-2 focus-visible:ring-brand/50 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-contrast/15 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-brand [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-contrast/15 [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-brand [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand" />
  </div>;
}
