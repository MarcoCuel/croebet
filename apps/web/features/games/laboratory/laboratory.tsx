"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { RotateCcw, Save, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { tableSettingsKey, tableSettingsEvent } from "@/three/table/use-visual-settings";
import { loveArtwork } from "../love-letter/artwork";
import { TableSceneBoundary } from "@/three/table/scene-boundary";
import { TableSeatBadge } from "@/three/table/seat-badge";
import { resolveTableLayout, adaptiveHandWindow } from "@/three/table/adaptive-layout";
import type { TableMenuTarget } from "@/three/table/interaction";
import { presentedHands, initialState, laboratoryReducer, defaultSettings, parseSettings, type LaboratorySettings } from "./model";

const Scene = dynamic(() => import("@/three/table/laboratory-scene"), {
  ssr: false, loading: () => <p role="status" className="p-6 text-sm text-muted">Carregando mesa 3D…</p>,
});
function NumberControl({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return <Field>{label}<Input type="number" min={min} max={max} step={step} value={value} onChange={event => {
    const next = event.currentTarget.valueAsNumber;
    if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, step === 1 ? Math.round(next) : next)));
  }} /></Field>;
}
function RangeControl({ label, value, min, max, step, disabled, suffix = "", onChange }: {
  label: string; value: number; min: number; max: number; step: number; disabled?: boolean; suffix?: string; onChange: (value: number) => void;
}) {
  return <Field><span className="flex items-center justify-between gap-3">{label}<span className="text-xs tabular-nums text-muted">{value.toFixed(2)}{suffix}</span></span>
    <Input type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event => onChange(event.currentTarget.valueAsNumber)} className="h-5 min-h-5 cursor-pointer border-0 bg-transparent p-0 accent-brand" />
  </Field>;
}
const storageKey = tableSettingsKey;
export function GameLaboratory() {
  const [settings, setSettings] = useState<LaboratorySettings>(defaultSettings);
  const [state, dispatch] = useReducer(laboratoryReducer, defaultSettings, initialState);
  const [artworkMode, setArtworkMode] = useState<"neutral" | "classic" | "modern">("neutral");
  const [focus, setFocus] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [menu, setMenu] = useState<{ target: TableMenuTarget; x: number; y: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 640 });
  const [message, setMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  const displayHands = presentedHands(state, settings.viewer);
  const countKey = displayHands.slice(0, settings.players).map(hand => hand.length).join(":");
  const exposedKey = state.exposed?.map(hand => hand.length).join(":") ?? "";
  const counts = useMemo(() => countKey.split(":").map(Number), [countKey]);
  const layout = useMemo(() => resolveTableLayout({ players: settings.players, viewer: settings.viewer, counts, exposedCounts: exposedKey.split(":").map(Number),
    width: viewport.width, height: viewport.height, angle: settings.angle, localCardScale: settings.localCardScale, opponentCardScale: settings.opponentCardScale, localHandCurve: settings.localHandCurve, deck: [settings.deckX, 0.035, settings.deckZ], deckRotation: settings.deckRotation, deckScale: settings.deckScale, discard: { x: settings.discardX, z: settings.discardZ, rotation: settings.discardRotation, scale: settings.discardScale } }),
    [settings.players, settings.viewer, counts, exposedKey, viewport.width, viewport.height, settings.angle, settings.localCardScale, settings.opponentCardScale, settings.localHandCurve, settings.deckX, settings.deckZ, settings.deckRotation, settings.deckScale, settings.discardX, settings.discardZ, settings.discardRotation, settings.discardScale]);
  const update = <K extends keyof LaboratorySettings>(key: K, value: LaboratorySettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const reset = (next: LaboratorySettings) => {
    const normalized = { ...next, viewer: 0 };
    setSettings(normalized); dispatch({ type: "reset", settings: normalized }); setMenu(null); setFocus(0); setMessage("");
  };
  const count = displayHands[settings.viewer].length;
  const window = adaptiveHandWindow(count, layout.hands[0], focus);
  const canDraw = state.deck.length > 0 && count < 1000;
  const canCollect = state.discard.length > 0 || state.hands.slice(0, settings.players).some(hand => hand.length > 0);
  const draw = () => {
    if (!canDraw) return;
    dispatch({ type: "draw", seat: settings.viewer }); setFocus(count);
    setMessage("Carta comprada.");
  };
  const discard = (id: string) => {
    if (state.choice) { dispatch({ type: "choose", active: false }); setMessage("Carta escolhida. Mãos restauradas."); return; }
    if (!state.hands[settings.viewer].some(card => card.id === id)) return;
    dispatch({ type: "discard", seat: settings.viewer, id }); setMenu(null);
    setFocus(Math.min(focus, Math.max(0, count - 2))); setMessage("Carta descartada.");
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...settings, deckX: layout.deckPosition[0], deckZ: layout.deckPosition[2], discardX: layout.discardTransform.x, discardZ: layout.discardTransform.z, discardRotation: layout.discardTransform.rotation, discardScale: layout.discardTransform.scale, counts: state.hands.map(hand => hand.length) }));
      globalThis.window.dispatchEvent(new Event(tableSettingsEvent));
      setMessage("Configuração salva neste navegador.");
    } catch { setMessage("Não foi possível salvar a configuração neste navegador."); }
  };
  const restore = () => {
    try {
      const stored = localStorage.getItem(storageKey); const parsed = parseSettings(stored ? JSON.parse(stored) : null);
      if (!parsed) { setMessage("Nenhuma configuração válida salva."); return; }
      reset(parsed); setMessage("Configuração restaurada.");
    } catch { setMessage("Não foi possível restaurar a configuração."); }
  };
  const controls = (fields: [keyof LaboratorySettings, string, number, number, number?][]) => fields.map(([key, label, min, max, step]) =>
    <NumberControl key={key} label={label} value={settings[key] as number} min={min} max={max} step={step} onChange={value => update(key, value)} />);
  const shuffle = () => {
    const order = state.deck.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    dispatch({ type: "shuffle", order }); setMessage("Deck embaralhado.");
  };
  const openMenu = (target: TableMenuTarget, point: { x: number; y: number }) => {
    const bounds = sceneRef.current?.getBoundingClientRect(); if (!bounds) return;
    setMenu({ target, x: point.x - bounds.left, y: point.y - bounds.top });
  };
  const menuCard = menu?.target.kind === "card" ? menu.target.id : null;
  return <div className="grid min-w-0 gap-4">
    <h1 className="sr-only">Laboratório de jogos</h1>
    <div ref={sceneRef} tabIndex={-1} className="relative h-[calc(100dvh-var(--header-height)-2rem)] min-h-[32rem] w-full overflow-hidden rounded-panel border border-contrast/6 bg-background" data-lenis-prevent data-testid="laboratory-scene" data-choice={!!state.choice} data-exposed-count={state.exposed?.slice(0, settings.players).reduce((total, hand) => total + hand.length, 0) ?? 0} aria-label={`Mesa 3D de teste · Deck: ${state.deck.length} · Descarte: ${state.discard.length}`}>
      <TableSceneBoundary><Scene settings={settings} layout={layout} state={state} selected={menuCard} focus={focus} reducedMotion={reducedMotion}
        artwork={artworkMode === "neutral" ? undefined : loveArtwork[artworkMode]} canDraw={canDraw} onDeckChange={point => setSettings(current => ({ ...current, deckX: point.x, deckZ: point.z, deckRotation: point.rotation, deckScale: point.scale }))}
        onDiscardChange={point => setSettings(current => ({ ...current, discardX: point.x, discardZ: point.z, discardRotation: point.rotation, discardScale: point.scale }))} onDraw={draw} onSelect={discard} onMenu={openMenu} onTurn={seat => update("turn", seat)} /></TableSceneBoundary>
      <div className="absolute bottom-4 left-4 z-10" data-testid="local-seat"><TableSeatBadge name="Jogador 1" active={settings.turn === settings.viewer} local compact={false} onActivate={() => update("turn", settings.viewer)} /></div>
      <div className="absolute right-3 top-3 z-20"><Button size="icon" variant="secondary" aria-label="Configuração da mesa" aria-expanded={configOpen} aria-controls="laboratory-settings" onClick={() => setConfigOpen(!configOpen)}>{configOpen ? <X className="size-4" /> : <Settings2 className="size-4" />}</Button></div>
      {configOpen && <aside id="laboratory-settings" aria-label="Configuração da mesa" className="absolute inset-y-16 right-3 z-20 grid w-72 max-w-[calc(100%-1.5rem)] content-start gap-5 overflow-y-auto rounded-panel border border-contrast/6 bg-background/95 p-4 shadow-lg backdrop-blur-md">
        <h2 className="font-semibold">Configuração</h2>
        <div role="group" aria-label="Arte das cartas" className="flex flex-wrap gap-2">{(["neutral", "classic", "modern"] as const).map(mode => <Button key={mode} size="sm" variant="secondary" aria-pressed={artworkMode === mode} onClick={() => setArtworkMode(mode)}>{mode === "neutral" ? "Neutras" : mode === "classic" ? "Love Letter clássico" : "Love Letter moderno"}</Button>)}</div>
        <NumberControl label="Jogadores" value={settings.players} min={2} max={12} onChange={players => { setSettings(current => ({ ...current, players, turn: Math.min(current.turn, players - 1) })); setFocus(0); setMenu(null); }} />
        <p className="text-xs text-muted">Layout automático conforme cartas, jogadores e espaço disponível.</p>
        <details><summary className="cursor-pointer text-sm font-semibold">Cartas</summary><div className="mt-4 grid gap-4">
          <Field>Cor das cartas numéricas<Input type="color" value={settings.numberCardColor} onChange={event => update("numberCardColor", event.currentTarget.value)} /></Field>
          <RangeControl label="Suas cartas" value={settings.localCardScale} min={0.5} max={1.5} step={0.05} suffix="×" onChange={value => update("localCardScale", value)} />
          <RangeControl label="Cartas dos oponentes" value={settings.opponentCardScale} min={0.5} max={1.5} step={0.05} suffix="×" onChange={value => update("opponentCardScale", value)} />
          <RangeControl label="Curvatura da sua mão" value={settings.localHandCurve} min={0} max={2} step={0.05} suffix="×" onChange={value => update("localHandCurve", value)} />
          <p className="text-xs text-muted">1× mantém o ajuste automático. Curvatura em 0× deixa o leque reto.</p>
          <Button variant="ghost" onClick={() => setSettings(current => ({ ...current, localCardScale: 1, opponentCardScale: 1, localHandCurve: 1 }))}>Restaurar ajustes das cartas</Button>
        </div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Câmera</summary><div className="mt-4 grid gap-4">{controls([["angle", "Ângulo da câmera", 25, 65]])}</div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Iluminação</summary><div className="mt-4 grid gap-4">
          <RangeControl label="Luz superior" value={settings.light} min={0} max={2.5} step={0.05} onChange={value => update("light", value)} />
          <RangeControl label="Luz ambiente" value={settings.ambient} min={0} max={2} step={0.05} onChange={value => update("ambient", value)} />
          <RangeControl label="Luz do deck" value={settings.pointLight} min={0} max={8} step={0.1} onChange={value => update("pointLight", value)} />
          <RangeControl label="Altura da luz do deck" value={settings.pointHeight} min={1} max={5} step={0.1} onChange={value => update("pointHeight", value)} />
          <RangeControl label="Exposição" value={settings.exposure} min={0.5} max={1.2} step={0.05} onChange={value => update("exposure", value)} />
          <Button variant="ghost" onClick={() => setSettings(current => ({ ...current, light: defaultSettings.light, ambient: defaultSettings.ambient, pointLight: defaultSettings.pointLight, pointHeight: defaultSettings.pointHeight, exposure: defaultSettings.exposure, shadowSoftness: defaultSettings.shadowSoftness, shadowOpacity: defaultSettings.shadowOpacity, shadows: true }))}>Restaurar iluminação</Button>
        </div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Sombras</summary><div className="mt-4 grid gap-4">
          <Button variant="secondary" aria-pressed={settings.shadows} onClick={() => update("shadows", !settings.shadows)}>Sombras: {settings.shadows ? "ativadas" : "desativadas"}</Button>
          <RangeControl label="Suavidade da sombra" value={settings.shadowSoftness} min={1} max={12} step={0.5} disabled={!settings.shadows} onChange={value => update("shadowSoftness", value)} />
          <RangeControl label="Intensidade da sombra" value={settings.shadowOpacity} min={0} max={0.8} step={0.05} disabled={!settings.shadows} onChange={value => update("shadowOpacity", value)} />
        </div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Animações</summary><div className="mt-4 grid gap-4">{controls([["duration", "Duração do movimento", 0.15, 2, 0.05], ["arc", "Altura da trajetória", 0, 2, 0.1], ["dealCount", "Cartas por distribuição", 1, 10], ["pileHeight", "Altura por carta na pilha", 0.004, 0.008, 0.001]])}</div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Cenários de teste</summary><div className="mt-4 grid gap-3">
          <Button variant="secondary" onClick={() => dispatch({ type: "scenario", mixed: true, settings })}>Mãos ocultas e cartas expostas</Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "scenario", mixed: false, settings })}>Todas as cartas abertas</Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "choose", active: !state.choice, players: settings.players })}>{state.choice ? "Encerrar escolha" : "Escolher cartas de outras mãos"}</Button>
          <div className="flex flex-wrap gap-2">{[1, 7, 20, 50].map(amount => <Button key={amount} size="sm" variant="secondary" onClick={() => reset({ ...settings, counts: Array.from({ length: 12 }, () => amount) })}>{amount} cartas</Button>)}</div>
          <Button variant="secondary" aria-pressed={settings.reveal} onClick={() => update("reveal", !settings.reveal)}>Revelar adversários: {settings.reveal ? "sim" : "não"}</Button>
        </div></details>
        <div className="grid gap-2 border-t border-contrast/6 pt-4"><Button variant="secondary" onClick={save}><Save className="size-4" />Salvar configuração</Button><Button variant="ghost" onClick={restore}>Restaurar configuração</Button><Button variant="ghost" onClick={() => reset(defaultSettings)}><RotateCcw className="size-4" />Reiniciar</Button><Button asChild variant="ghost"><Link href="/admin/jogos/laboratorio/love-letter">Cartas do Love Letter</Link></Button></div>
      </aside>}
      {count > window.length && <div className="absolute inset-x-3 bottom-10 flex items-center justify-center gap-2"><Button size="sm" variant="secondary" disabled={window.start === 0} onClick={() => setFocus(Math.max(0, window.start - window.length / 2))}>Anteriores</Button><span className="rounded-lg bg-background/90 px-2 py-1 text-xs text-muted" data-testid="hand-window">{window.start + 1}–{window.start + window.length} de {count}</span><Button size="sm" variant="secondary" disabled={window.start + window.length >= count} onClick={() => setFocus(window.start + window.length * 1.5)}>Próximas</Button></div>}
      <p role="status" className="sr-only">{message}</p>
      <DropdownMenu modal={false} open={menu !== null} onOpenChange={open => { if (!open) setMenu(null); }}>
        <DropdownMenuTrigger asChild><Button aria-label="Ações na mesa" aria-hidden="true" tabIndex={-1} variant="ghost" className="pointer-events-none absolute size-px min-h-0 p-0 opacity-0" style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }} /></DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0} onCloseAutoFocus={event => { event.preventDefault(); sceneRef.current?.focus(); }}>
          {menuCard ? <>
            <DropdownMenuItem onSelect={() => discard(menuCard)}>Descartar carta</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { dispatch({ type: "expose", seat: settings.viewer, id: menuCard }); setMenu(null); setMessage("Carta exposta junto ao jogador."); }}>Expor junto ao jogador</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { dispatch({ type: "flip", seat: settings.viewer, id: menuCard }); setMessage("Carta virada."); }}>Virar carta</DropdownMenuItem>
            <DropdownMenuSub><DropdownMenuSubTrigger>Trocar com</DropdownMenuSubTrigger><DropdownMenuSubContent>{Array.from({ length: settings.players }, (_, seat) => seat !== settings.viewer && <DropdownMenuItem key={seat} disabled={state.hands[seat].length >= 1000} onSelect={() => { dispatch({ type: "swap", seat: settings.viewer, target: seat, id: menuCard }); setMessage("Cartas trocadas."); }}>Jogador {seat + 1}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
          </> : <>
            <DropdownMenuItem disabled={!canDraw} onSelect={draw}>Comprar carta</DropdownMenuItem>
            <DropdownMenuItem disabled={!canDraw} onSelect={() => { dispatch({ type: "draw", seat: settings.viewer, reveal: true }); setFocus(count); setMessage("Carta revelada antes da entrega."); }}>Comprar com revelação no centro</DropdownMenuItem>
            <DropdownMenuItem disabled={state.deck.length < 2} onSelect={shuffle}>Embaralhar deck</DropdownMenuItem>
            <DropdownMenuItem disabled={!state.deck.length || state.hands.slice(0, settings.players).every(hand => hand.length >= 1000)} onSelect={() => { dispatch({ type: "deal", players: settings.players, count: settings.dealCount, startSeat: settings.turn }); setMessage("Cartas distribuídas."); }}>Distribuir cartas</DropdownMenuItem>
            <DropdownMenuItem disabled={!canCollect} onSelect={() => { dispatch({ type: "collect", players: settings.players }); setFocus(0); setMessage("Cartas recolhidas."); }}>Recolher cartas</DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => update("turn", (settings.turn + 1) % settings.players)}>Passar a vez</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>;
}
