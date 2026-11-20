"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, Play, Check, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { defaultCardSound, gameAudioCatalog } from "./game-audio-catalog";
import type { useGameAudio } from "./use-game-audio";

export function GameAudioDevPanel({ audio }: { audio: ReturnType<typeof useGameAudio> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [original, setOriginal] = useState(false);
  const [pending, setPending] = useState("");
  const [lastPlayed, setLastPlayed] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);
  const { setPreviewMode } = audio;
  useEffect(() => () => { request.current++; setPreviewMode(false); }, [setPreviewMode]);
  function stop() { request.current++; audio.stop(); setPending(""); }
  function changeOpen(value: boolean) {
    stop(); setError(""); setOpen(value); audio.setPreviewMode(value);
  }
  async function preview(name: string) {
    const revision = ++request.current;
    setPending(name); setError("");
    try {
      await audio.preview(name, original);
      if (revision === request.current) setLastPlayed(name);
    } catch (reason) {
      if (revision === request.current) setError(reason instanceof Error ? reason.message : "Não foi possível ouvir este áudio.");
    } finally { if (revision === request.current) setPending(""); }
  }
  if (process.env.NODE_ENV !== "development") return null;
  const files = gameAudioCatalog.filter(name => name.includes(query.trim().toLowerCase()));
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button size="icon" variant="ghost" title="Testar sons (dev)" aria-label="Testar sons (dev)"><FlaskConical className="size-4" aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="flex max-h-[85dvh] w-[min(48rem,calc(100%-2rem))] flex-col gap-4">
      <DialogTitle>Áudios · Desenvolvimento</DialogTitle>
      <p className="text-sm text-muted">Som de puxar carta: <span className="text-foreground">{audio.cardSound}</span>. A escolha fica salva neste navegador. Os sons da partida ficam suspensos enquanto este painel estiver aberto.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={audio.toggle}>{audio.muted ? "Ativar som" : "Silenciar som"}</Button>
        <label className="flex items-center gap-2 text-sm">Volume<Input type="range" aria-label="Volume de teste" min={0} max={100} step={5} value={audio.volume} onChange={event => audio.setVolume(Number(event.target.value))} className="w-24 border-0 bg-transparent p-0 accent-brand" /><span className="w-9 text-xs tabular-nums">{audio.volume}%</span></label>
        <Button size="sm" variant="outline" onClick={stop}><Square className="size-4" aria-hidden="true" />Parar</Button>
        <Button size="sm" variant="ghost" onClick={() => { stop(); audio.setCardSound(defaultCardSound); }}>Restaurar padrão</Button>
      </div>
      <label className="flex items-center gap-2 text-sm"><Input type="checkbox" checked={original} onChange={event => { stop(); setOriginal(event.target.checked); }} className="size-4 min-h-4 w-4 accent-brand" />Ouvir arquivo original (com silêncios)</label>
      <SearchInput aria-label="Buscar áudio" placeholder="Buscar áudio…" value={query} onChange={event => setQuery(event.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {lastPlayed && <p role="status" className="text-xs text-muted">Último teste: {lastPlayed}</p>}
      <ul className="min-h-0 overflow-y-auto divide-y divide-contrast/6" aria-label="Arquivos de áudio" data-lenis-prevent>
        {files.map(name => <li key={name} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-0 flex-1 break-all text-sm">{name}</span>
          <Button size="sm" variant="secondary" loading={pending === name} aria-label={`Ouvir ${name}`} onClick={() => void preview(name)}><Play className="size-4" aria-hidden="true" />Ouvir</Button>
          <Button size="sm" variant={audio.cardSound === name ? "default" : "outline"} aria-label={`Usar ${name} ao puxar carta`} aria-pressed={audio.cardSound === name} onClick={() => { stop(); audio.setCardSound(name); }}>{audio.cardSound === name && <Check className="size-4" aria-hidden="true" />}{audio.cardSound === name ? "Selecionado" : "Usar"}</Button>
        </li>)}
        {!files.length && <li className="py-4 text-sm text-muted">Nenhum áudio encontrado.</li>}
      </ul>
    </DialogContent>
  </Dialog>;
}
