"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { createHands, defaultSettings, parseSettings, type LabCard, type LaboratorySettings } from "./model";

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
  const [hands, setHands] = useState(() => createHands(defaultSettings.counts));
  const [deck, setDeck] = useState(52);
  const [discard, setDiscard] = useState<LabCard[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const nextId = useRef(0);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const update = <K extends keyof LaboratorySettings>(key: K, value: LaboratorySettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const reset = (next: LaboratorySettings) => {
    setSettings(next); setHands(createHands(next.counts)); setDeck(52); setDiscard([]); setSelected(null); setOffset(0);
  };
  const count = hands[settings.viewer].length;
  const chooseViewer = (viewer: number) => { update("viewer", viewer); setOffset(0); setSelected(null); };
  const changeCount = (value: number) => {
    const counts = settings.counts.map((count, index) => index === settings.viewer ? value : count);
    update("counts", counts);
    setHands(current => current.map((hand, index) => index === settings.viewer ? createHands(counts)[index] : hand));
    setOffset(0); setSelected(null);
  };
  const draw = () => {
    if (!deck || count >= 1000) return;
    const card = { id: `draw:${nextId.current++}`, value: Math.floor(Math.random() * 10) };
    setHands(current => current.map((hand, seat) => seat === settings.viewer ? [...hand, card] : hand));
    setDeck(current => current - 1); setOffset(Math.max(0, count + 1 - 20)); setSelected(card.id);
    setMessage(`Jogador ${settings.viewer + 1} comprou uma carta.`);
  };
  const discardSelected = () => {
    const card = hands[settings.viewer].find(card => card.id === selected);
    if (!card) return;
    setHands(current => current.map((hand, seat) => seat === settings.viewer ? hand.filter(item => item.id !== selected) : hand));
    setDiscard(current => [...current, card]); setSelected(null); setOffset(Math.max(0, Math.min(offset, count - 2)));
    setMessage(`Carta ${card.value} descartada.`);
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...settings, counts: hands.map(hand => hand.length) }));
      setMessage("Configuração salva neste navegador.");
    } catch { setMessage("Não foi possível salvar a configuração neste navegador."); }
  };
  const restore = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = parseSettings(stored ? JSON.parse(stored) : null);
      if (!parsed) { setMessage("Nenhuma configuração válida salva."); return; }
      reset(parsed); setMessage("Configuração restaurada.");
    } catch { setMessage("Não foi possível restaurar a configuração."); }
  };
  return <div className="grid min-w-0 gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button asChild size="icon" variant="ghost"><Link href="/admin/jogos" aria-label="Voltar aos jogos"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-xl font-semibold">Laboratório de jogos</h1><p className="text-sm text-muted">Mesa 3D · Simulação visual</p></div></div>
      <Button variant="secondary" onClick={() => reset(defaultSettings)}><RotateCcw className="size-4" aria-hidden />Reiniciar</Button>
    </div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid min-w-0 gap-4">
        <div className="relative h-[32rem] overflow-hidden rounded-panel border border-contrast/6 bg-surface sm:h-[40rem]" data-lenis-prevent data-testid="laboratory-scene" aria-label="Mesa 3D de teste">
          <SceneBoundary><Scene settings={settings} hands={hands} selected={selected} offset={offset} deck={deck} discard={discard} reducedMotion={reducedMotion} onSelect={setSelected} /></SceneBoundary>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap justify-center gap-2">{Array.from({ length: settings.players }, (_, seat) => <span key={seat} className={`rounded-lg bg-background/90 px-2 py-1 text-xs ${seat === settings.viewer ? "text-brand" : "text-muted"}`}>Jogador {seat + 1} · {hands[seat].length} cartas</span>)}</div>
          <p className="pointer-events-none absolute inset-x-3 bottom-3 text-center text-xs text-muted">Deck: {deck} · Descarte: {discard.length} · Você observa o jogador {settings.viewer + 1}</p>
        </div>
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Mão do jogador {settings.viewer + 1} <span className="text-muted">({count})</span></h2><div className="flex flex-wrap gap-2"><Button onClick={draw} disabled={!deck || count >= 1000}>Comprar carta</Button><Button variant="secondary" disabled={!selected} onClick={discardSelected}>Descartar selecionada</Button></div></div>
          <div role="group" aria-label="Selecionar carta da mão" className="flex flex-wrap gap-2">{hands[settings.viewer].slice(offset, offset + 20).map(card => <Button key={card.id} size="sm" variant={selected === card.id ? "default" : "secondary"} aria-label={`Selecionar carta ${card.value}`} aria-pressed={selected === card.id} onClick={() => setSelected(card.id)}>{card.value}</Button>)}</div>
          {count > 20 && <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Anteriores</Button><span className="text-sm text-muted">{offset + 1}–{Math.min(offset + 20, count)} de {count}</span><Button variant="ghost" disabled={offset + 20 >= count} onClick={() => setOffset(Math.min(count - 1, offset + 20))}>Próximas</Button></div>}
          <p role="status" className="min-h-5 text-sm text-muted">{message || "Selecione uma carta na mesa ou pelos botões acima."}</p>
        </Card>
      </div>
      <Card className="grid gap-5">
        <h2 className="font-semibold">Configuração</h2>
        <div className="flex flex-wrap gap-2" aria-label="Cenários prontos">{[1, 7, 20, 50].map(amount => <Button key={amount} size="sm" variant="secondary" onClick={() => reset({ ...settings, counts: Array.from({ length: 12 }, () => amount) })}>{amount} cartas</Button>)}</div>
        <NumberControl label="Jogadores" value={settings.players} min={2} max={12} onChange={players => { setSettings(current => ({ ...current, players, viewer: Math.min(current.viewer, players - 1) })); setOffset(0); setSelected(null); }} />
        <NumberControl label="Observar jogador" value={settings.viewer + 1} min={1} max={settings.players} onChange={value => chooseViewer(value - 1)} />
        <NumberControl label="Cartas na mão" value={count} min={0} max={1000} onChange={changeCount} />
        <div className="grid gap-2"><span className="text-sm font-semibold">Disposição</span><div className="flex gap-2">{([['fan', 'Leque'], ['line', 'Linha']] as const).map(([value, label]) => <Button key={value} size="sm" variant={settings.layout === value ? "default" : "secondary"} aria-pressed={settings.layout === value} onClick={() => update("layout", value)}>{label}</Button>)}</div></div>
        <NumberControl label="Largura da mão" value={settings.spread} min={2} max={7} step={0.25} onChange={value => update("spread", value)} />
        <NumberControl label="Curvatura" value={settings.curve} min={0} max={3} step={0.1} onChange={value => update("curve", value)} />
        <NumberControl label="Ângulo da câmera" value={settings.angle} min={25} max={75} onChange={value => update("angle", value)} />
        <NumberControl label="Intensidade da luz" value={settings.light} min={0.5} max={5} step={0.5} onChange={value => update("light", value)} />
        <Button variant="secondary" aria-pressed={settings.shadows} onClick={() => update("shadows", !settings.shadows)}>Sombras: {settings.shadows ? "ativadas" : "desativadas"}</Button>
        <Button variant="secondary" aria-pressed={settings.reveal} onClick={() => update("reveal", !settings.reveal)}>Revelar adversários: {settings.reveal ? "sim" : "não"}</Button>
        <div className="grid gap-2 border-t border-contrast/6 pt-4"><Button variant="secondary" onClick={save}><Save className="size-4" aria-hidden />Salvar configuração</Button><Button variant="ghost" onClick={restore}>Restaurar configuração</Button></div>
      </Card>
    </div>
  </div>;
}
