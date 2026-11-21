"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameAudioDevPanel } from "./game-audio-dev-panel";
import type { useGameAudio } from "./use-game-audio";

export function GameControls({ audio, children, developmentControls }: { audio: ReturnType<typeof useGameAudio>; children?: ReactNode; developmentControls?:ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
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
    <div className="group/volume flex items-center rounded-full text-foreground transition-colors hover:bg-contrast/6 focus-within:bg-contrast/6 motion-reduce:transition-none" role="group" aria-label="Volume">
      <Button size="icon" variant="ghost" className="rounded-full" aria-label={silent ? "Ativar som" : "Silenciar som"} title={silent ? "Ativar som" : "Silenciar som"} aria-pressed={!silent} onClick={() => { if (audio.volume === 0) audio.setVolume(45); else audio.toggle(); }}>{silent ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}</Button>
      <div className="invisible flex h-11 w-0 items-center overflow-hidden opacity-0 transition-[width,opacity,visibility] duration-150 group-hover/volume:visible group-hover/volume:w-24 group-hover/volume:opacity-100 group-focus-within/volume:visible group-focus-within/volume:w-24 group-focus-within/volume:opacity-100 motion-reduce:transition-none">
        <Input type="range" aria-label="Volume dos efeitos" aria-valuetext={`${audio.volume}%`} min={0} max={100} step={5} value={audio.volume} onChange={event => audio.setVolume(Number(event.target.value))} style={{ backgroundImage: `linear-gradient(to right, currentColor ${audio.volume}%, color-mix(in srgb, currentColor 20%, transparent) ${audio.volume}%)` }} className="mr-4 h-1 min-h-1 w-20 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-foreground [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground" />
      </div>
    </div>
    {(developmentControls || process.env.NODE_ENV === "development") && <div className="ml-1 flex items-center gap-1 border-l border-contrast/6 pl-2" role="group" aria-label="Ferramentas de desenvolvimento">{process.env.NODE_ENV === "development" && <GameAudioDevPanel audio={audio}/>} {developmentControls}</div>}
    {children}
  </div>;
}
