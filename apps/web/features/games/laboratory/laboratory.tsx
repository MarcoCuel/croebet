"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useReducer, useState, type ReactNode } from "react";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { handWindow } from "@/three/table/layout";
import { Card } from "@/components/ui/card";
import { initialState, laboratoryReducer, defaultSettings, parseSettings, type LaboratorySettings } from "./model";

const Scene = dynamic(() => import("@/three/table/laboratory-scene"), {
  ssr: false, loading: () => <p role="status" className="p-6 text-sm text-muted">Carregando mesa 3D…</p>,
});
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="grid gap-3 p-6"><p>Não foi possível abrir a mesa 3D. Verifique se a aceleração gráfica está disponível.</p><Button onClick={() => this.setState({ failed: false })}>Tentar novamente</Button></div> : this.props.children;
  }
}
function NumberControl({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return <Field>{label}<Input type="number" min={min} max={max} step={step} value={value} onChange={event => {
    const next = event.currentTarget.valueAsNumber;
    if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, step === 1 ? Math.round(next) : next)));
  }} /></Field>;
}
const storageKey = "croebet:table-laboratory:v1";
export function GameLaboratory() {
  const [settings, setSettings] = useState<LaboratorySettings>(defaultSettings);
  const [state, dispatch] = useReducer(laboratoryReducer, defaultSettings, initialState);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const [targetSeat, setTargetSeat] = useState(1);
  const [message, setMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const update = <K extends keyof LaboratorySettings>(key: K, value: LaboratorySettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const reset = (next: LaboratorySettings) => {
    setSettings(next); dispatch({ type: "reset", settings: next }); setSelected(null); setFocus(0); setMessage("");
  };
  const hand = state.hands[settings.viewer]; const count = hand.length;
  const window = handWindow(count, settings.spread, settings.scale, focus);
  const chooseViewer = (viewer: number) => { update("viewer", viewer); setFocus(0); setSelected(null); };
  const changeCount = (value: number) => {
    update("counts", settings.counts.map((count, index) => index === settings.viewer ? value : count));
    dispatch({ type: "count", seat: settings.viewer, count: value }); setFocus(0); setSelected(null);
  };
  const draw = () => {
    if (!state.deck.length || count >= 1000) return;
    const card = state.deck.at(-1)!;
    dispatch({ type: "draw", seat: settings.viewer }); setFocus(count); setSelected(card.id);
    setMessage(`Jogador ${settings.viewer + 1} comprou uma carta.`);
  };
  const discardSelected = () => {
    if (!selected) return;
    dispatch({ type: "discard", seat: settings.viewer, id: selected }); setSelected(null); setFocus(Math.min(focus, Math.max(0, count - 2)));
    setMessage("Carta movida para o descarte.");
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...settings, counts: state.hands.map(hand => hand.length) }));
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
  return <div className="grid min-w-0 gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button asChild size="icon" variant="ghost"><Link href="/admin/jogos" aria-label="Voltar aos jogos"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-xl font-semibold">Laboratório de jogos</h1><p className="text-sm text-muted">Mesa 3D · Simulação visual</p></div></div>
      <Button asChild variant="secondary"><Link href="/admin/jogos/laboratorio/love-letter">Cartas do Love Letter</Link></Button>
      <Button variant="secondary" onClick={() => reset(defaultSettings)}><RotateCcw className="size-4" aria-hidden />Reiniciar</Button>
    </div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid min-w-0 gap-4">
        <div className="relative h-[30rem] overflow-hidden rounded-panel border border-contrast/6 bg-background sm:h-[40rem]" data-lenis-prevent data-testid="laboratory-scene" aria-label="Mesa 3D de teste">
          <SceneBoundary><Scene settings={settings} state={state} selected={selected} focus={focus} reducedMotion={reducedMotion} onSelect={setSelected} /></SceneBoundary>
          <p className="pointer-events-none absolute inset-x-3 bottom-3 text-center text-xs text-muted">Deck: {state.deck.length} · Descarte: {state.discard.length} · Você observa o jogador {settings.viewer + 1}</p>
        </div>
        <Card className="grid gap-4">
          <h2 className="font-semibold">Mão do jogador {settings.viewer + 1} <span className="text-muted">({count})</span></h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ações de teste">
            <Button onClick={draw} disabled={!state.deck.length || count >= 1000}>Comprar carta</Button>
            <Button variant="secondary" disabled={!selected} onClick={discardSelected}>Descartar selecionada</Button>
            <Button variant="secondary" disabled={!selected} onClick={() => { if (selected) dispatch({ type: "flip", seat: settings.viewer, id: selected }); }}>Virar carta</Button>
            <Button variant="secondary" disabled={!state.deck.length || state.hands.slice(0, settings.players).every(hand => hand.length >= 1000)} onClick={() => { dispatch({ type: "deal", players: settings.players, count: settings.dealCount }); setMessage("Cartas distribuídas em sequência."); }}>Distribuir cartas</Button>
            <Button variant="secondary" disabled={!state.discard.length && !state.hands.slice(0, settings.players).some(hand => hand.length)} onClick={() => { dispatch({ type: "collect", players: settings.players }); setSelected(null); setFocus(0); setMessage("Cartas recolhidas para o deck."); }}>Recolher cartas</Button>
            <Button variant="secondary" disabled={state.deck.length < 2} onClick={shuffle}>Embaralhar deck</Button>
          </div>
          <div className="flex flex-wrap items-end gap-3"><div className="w-40"><NumberControl label="Trocar com jogador" value={targetSeat + 1} min={1} max={settings.players} onChange={value => setTargetSeat(value - 1)} /></div><Button variant="secondary" disabled={!selected || targetSeat >= settings.players || targetSeat === settings.viewer || state.hands[targetSeat].length >= 1000} onClick={() => { if (selected) dispatch({ type: "swap", seat: settings.viewer, target: targetSeat, id: selected }); setSelected(null); setMessage("Cartas trocadas entre os jogadores."); }}>Trocar cartas</Button></div>
          <div role="group" aria-label="Selecionar carta da mão" className="flex flex-wrap gap-2">{hand.slice(window.start, window.start + window.length).map((card, index) => <Button key={card.id} size="sm" variant={selected === card.id ? "default" : "secondary"} aria-label={`Selecionar carta ${card.value}, posição ${window.start + index + 1}`} aria-pressed={selected === card.id} onClick={() => setSelected(card.id)}>{card.value}</Button>)}</div>
          {count > window.length && <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={window.start === 0} onClick={() => setFocus(Math.max(0, window.start - window.length / 2))}>Anteriores</Button><span className="text-sm text-muted" data-testid="hand-window">{window.start + 1}–{window.start + window.length} de {count}</span><Button variant="ghost" disabled={window.start + window.length >= count} onClick={() => setFocus(window.start + window.length * 1.5)}>Próximas</Button></div>}
          <p role="status" className="min-h-5 text-sm text-muted">{message || "Selecione uma carta na mesa ou pelos botões acima."}</p>
        </Card>
      </div>
      <Card className="grid gap-5">
        <h2 className="font-semibold">Configuração</h2>
        <div className="flex flex-wrap gap-2" aria-label="Cenários prontos">{[1, 7, 20, 50].map(amount => <Button key={amount} size="sm" variant="secondary" onClick={() => reset({ ...settings, counts: Array.from({ length: 12 }, () => amount) })}>{amount} cartas</Button>)}</div>
        <NumberControl label="Jogadores" value={settings.players} min={2} max={12} onChange={players => { setSettings(current => ({ ...current, players, viewer: Math.min(current.viewer, players - 1), turn: Math.min(current.turn, players - 1) })); setFocus(0); setSelected(null); setTargetSeat(Math.min(targetSeat, players - 1)); }} />
        <NumberControl label="Observar jogador" value={settings.viewer + 1} min={1} max={settings.players} onChange={value => chooseViewer(value - 1)} />
        <NumberControl label="Cartas na mão" value={count} min={0} max={1000} onChange={changeCount} />
        <NumberControl label="Vez do jogador" value={settings.turn + 1} min={1} max={settings.players} onChange={value => update("turn", value - 1)} />
        <details open className="grid"><summary className="cursor-pointer text-sm font-semibold">Mãos e cartas</summary><div className="mt-4 grid gap-4">
          <div className="flex gap-2">{([['fan', 'Leque'], ['line', 'Linha']] as const).map(([value, label]) => <Button key={value} size="sm" variant={settings.layout === value ? "default" : "secondary"} aria-pressed={settings.layout === value} onClick={() => update("layout", value)}>{label}</Button>)}</div>
          {controls([["spread", "Largura da mão", 2, 9, 0.25], ["curve", "Curvatura", 0, 3, 0.1], ["spacing", "Espaçamento", 0.2, 1.2, 0.05], ["overlap", "Sobreposição", 0, 0.9, 0.05], ["tilt", "Inclinação das cartas", 0, 45], ["scale", "Escala das cartas", 0.5, 1.8, 0.05], ["orientation", "Orientação da mão", -45, 45]])}
        </div></details>
        <details open><summary className="cursor-pointer text-sm font-semibold">Mesa e câmera</summary><div className="mt-4 grid gap-4">{controls([["radius", "Largura dos assentos", 2.5, 7, 0.25], ["depth", "Profundidade dos assentos", 2, 6, 0.25], ["angle", "Ângulo da câmera", 25, 65]])}</div></details>
        <details><summary className="cursor-pointer text-sm font-semibold">Luz e pilhas</summary><div className="mt-4 grid gap-4">{controls([["light", "Intensidade da luz", 0.5, 5, 0.5], ["ambient", "Luz ambiente", 0.2, 3, 0.1], ["pileHeight", "Altura por carta na pilha", 0.01, 0.06, 0.005]])}
          <Button variant="secondary" aria-pressed={settings.shadows} onClick={() => update("shadows", !settings.shadows)}>Sombras: {settings.shadows ? "ativadas" : "desativadas"}</Button>
        </div></details>
        <details open><summary className="cursor-pointer text-sm font-semibold">Animações</summary><div className="mt-4 grid gap-4">{controls([["duration", "Duração do movimento", 0.15, 2, 0.05], ["arc", "Altura da trajetória", 0, 2, 0.1], ["dealCount", "Cartas por distribuição", 1, 10]])}</div></details>
        <Button variant="secondary" aria-pressed={settings.reveal} onClick={() => update("reveal", !settings.reveal)}>Revelar adversários: {settings.reveal ? "sim" : "não"}</Button>
        <div className="grid gap-2 border-t border-contrast/6 pt-4"><Button variant="secondary" onClick={save}><Save className="size-4" aria-hidden />Salvar configuração</Button><Button variant="ghost" onClick={restore}>Restaurar configuração</Button></div>
      </Card>
    </div>
  </div>;
}
