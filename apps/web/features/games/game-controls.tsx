"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize, Minimize, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameAudioDevPanel } from "./game-audio-dev-panel";
import type { useGameAudio } from "./use-game-audio";

export function GameControls({ audio, children, developmentControls }: { audio: ReturnType<typeof useGameAudio>; children?: ReactNode; developmentControls?:ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    function sync() { setFullscreen(!!document.fullscreenElement); setSupported(!!document.fullscreenEnabled); }
    document.addEventListener("fullscreenchange", sync);
    const timer = window.setTimeout(sync, 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("fullscreenchange", sync); };
  }, []);
  async function toggleFullscreen() {
    try {
      // Keep Radix portals and fixed game controls inside the fullscreen root.
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast.error("Não foi possível alterar a tela cheia neste navegador."); }
  }
  const silent = audio.muted || audio.volume === 0;
  return <div className="ml-auto flex flex-wrap items-center justify-end gap-1" aria-label="Controles da partida">
    {supported && <Button size="icon" variant="ghost" aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"} title={fullscreen ? "Sair da tela cheia" : "Tela cheia"} aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}</Button>}
    <Button size="icon" variant="ghost" aria-label={silent ? "Ativar som" : "Silenciar som"} title={silent ? "Ativar som" : "Silenciar som"} aria-pressed={!silent} onClick={() => { if (audio.volume === 0) audio.setVolume(45); else audio.toggle(); }}>{silent ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}</Button>
    <Button size="icon" variant="ghost" aria-label="Ajustar volume" title="Ajustar volume" aria-expanded={volumeOpen} onClick={() => setVolumeOpen(value => !value)}><SlidersHorizontal className="size-4" aria-hidden="true" /></Button>
    {(developmentControls || process.env.NODE_ENV === "development") && <div className="ml-1 flex items-center gap-1 border-l border-contrast/6 pl-2" role="group" aria-label="Ferramentas de desenvolvimento">{process.env.NODE_ENV === "development" && <GameAudioDevPanel audio={audio}/>} {developmentControls}</div>}
    {children}
    {volumeOpen && <div className="flex items-center gap-2"><Input type="range" aria-label="Volume dos efeitos" min={0} max={100} step={5} value={audio.volume} onChange={event => audio.setVolume(Number(event.target.value))} className="w-24 border-0 bg-transparent p-0 accent-brand" /><span className="w-9 text-xs text-muted tabular-nums">{audio.volume}%</span></div>}
  </div>;
}
