"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { BookOpen, PanelRightClose, PanelRightOpen, Layers, Heart, Snowflake, Plus, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as Surface } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDemoSession } from "@/features/auth/session-context";
import { automaticAction, cardLabel, createGame, numbers, score, targets, transition } from "./engine";
import type { Action, Card, Game, Setup } from "./engine";
import { GOAL } from "./engine";

function Rules() {
  return <Dialog><DialogTrigger asChild><Button variant="secondary" className="w-full" aria-label="Regras"><BookOpen className="size-4" aria-hidden="true" />Regras</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="w-[min(34rem,calc(100%-2rem))]">
      <DialogTitle>Como jogar Flip7</DialogTitle>
      <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
        <li>A primeira carta de cada jogador na rodada é automática. Nos próximos turnos, compre uma carta ou pare para garantir seus pontos. É preciso ter pelo menos uma carta numérica para parar.</li>
        <li>Repetiu um número? Você estoura e perde os pontos daquela rodada. Existem doze cartas 12, onze cartas 11 e assim por diante, além de um único 0.</li>
        <li>Sete números diferentes fazem um <strong className="text-foreground">Flip7</strong>: você ganha 15 pontos extras e a rodada acaba imediatamente para todos.</li>
        <li>Os bônus somam +2, +4, +6, +8 ou +10. O ×2 dobra apenas a soma dos números, antes dos bônus.</li>
        <li><strong className="text-foreground">Congelar</strong> faz uma pessoa ativa parar. <strong className="text-foreground">Compre 3</strong> obriga uma pessoa ativa a comprar três cartas. Você também pode escolher a si mesmo.</li>
        <li><strong className="text-foreground">Segunda chance</strong> descarta automaticamente um número repetido junto da proteção. Uma proteção extra pode ser dada a outra pessoa ativa que não tenha uma.</li>
        <li>Ações encontradas durante Compre 3 são resolvidas depois das compras. Se a pessoa estourar, essas ações são descartadas. Uma segunda chance extra nessa sequência é descartada.</li>
        <li>Ao acabar o baralho, os descartes são embaralhados. Vence quem tiver mais pontos ao fim da rodada em que alguém atingir {GOAL}. Empates dividem a vitória.</li>
      </ol>
      <p className="mt-5 text-xs text-muted">Jogo original de Eric Olsen. Modo local: compartilhe o dispositivo. Os pontos desta partida são independentes dos Croins.</p>
    </DialogContent>
  </Dialog>;
}
const playerStatus = { playing: "Ativo", stayed: "Parou", frozen: "Congelado", busted: "Estourou" } as const;
const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze"];
const numberColors = ["neutral", "slate", "lime", "pink", "cyan", "green", "purple", "amber", "lime", "orange", "red", "blue", "slate"];
function PlayingCard({ card, flipped = false, compact = false, fluid = false }: { card: Card; flipped?: boolean; compact?: boolean; fluid?: boolean }) {
  const special = card.type === "freeze" || card.type === "chance" || card.type === "three";
  const Icon = card.type === "freeze" ? Snowflake : card.type === "chance" ? Heart : Layers;
  const color = card.type === "number" ? numberColors[card.value] : card.type === "freeze" ? "cyan" : card.type === "three" ? "amber" : "orange";
  const label = card.type === "number" ? numberNames[card.value] : cardLabel(card);
  return (
    <div role="img" aria-label={flipped ? "Carta de costas" : cardLabel(card)} title={flipped ? undefined : cardLabel(card)}
      data-card-back={flipped || undefined}
      className={cn("shrink-0 font-sans normal-nums [perspective:50rem]", fluid ? "@container aspect-[5/8] w-full sm:aspect-[2/3]" : compact ? "h-14 w-9" : "h-32 w-20 sm:h-36 sm:w-24")}>
      <div className={cn("relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none", flipped && "[transform:rotateY(180deg)]")}>
        <div aria-hidden={flipped} style={{ "--card-color": `var(--color-flip-${color})` } as CSSProperties}
          className={cn("absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-field-border/30 bg-control-hover shadow-sm [backface-visibility:hidden]",
            card.type === "number" ? "text-(--card-color)" : "border-white/10 bg-(--card-color) text-flip-ink",
            card.type === "chance" && "bg-brand text-white",
            compact && "rounded-md border",
            fluid && "rounded-[12cqi] border-[2cqi]",
          )}>
          {card.type === "number" && <span className={cn("absolute top-0 rounded-b-full bg-(--card-color)", fluid ? "h-[4cqi] w-[42cqi]" : compact ? "h-0.5 w-4" : "h-1 w-10")} aria-hidden="true" />}
          {special ? <Icon className={fluid ? "size-[29cqi]" : compact ? "size-4" : "size-7"} fill={card.type === "chance" ? "currentColor" : "none"} aria-hidden="true" /> : <span className={cn("font-medium normal-nums", fluid ? "text-[50cqi]" : compact ? "text-lg" : "text-4xl sm:text-5xl")}>{cardLabel(card)}</span>}
          {!compact && <span className={cn("absolute inset-x-1 bottom-3 text-center text-xs leading-tight", card.type === "number" && "text-foreground", fluid && "inset-x-[4cqi] bottom-[12cqi] text-[12.5cqi]")}>{label}</span>}
        </div>
        <div aria-hidden="true" className={cn("absolute inset-0 rounded-xl border-2 border-field-border/30 bg-control-hover [backface-visibility:hidden] [transform:rotateY(180deg)]", fluid && "rounded-[12cqi] border-[2cqi]")} />
      </div>
    </div>
  );
}

function GameLog({ game }: { game: Game }) {
  return <ol className="space-y-3">{game.log.map((entry, i) => {
    const player = entry.player !== undefined ? game.players[entry.player] : null;
    return <li key={i} className="flex items-center gap-2 border-b border-border pb-3 last:border-0">
      {player && <Avatar className="size-7" aria-hidden="true"><AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>}
      <span className="min-w-0 flex-1 break-words">{entry.message}</span>
      {entry.card && <PlayingCard card={entry.card} compact />}
    </li>;
  })}</ol>;
}

function ParticipantForm({ player, onSave, onRemove }: { player: Setup | null; onSave: (player: Setup) => void; onRemove: () => void }) {
  const [name, setName] = useState(player?.name ?? "");
  const [kind, setKind] = useState<"human" | "normal">(player?.kind === "human" || !player ? "human" : "normal");
  return <form className="mt-5 space-y-4" onSubmit={event => {
    event.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), kind });
  }}>
    <Field>Nome<Input value={name} onChange={event => setName(event.target.value)} maxLength={24} required autoComplete="off" /></Field>
    <Field>Tipo<Select value={kind} onChange={event => setKind(event.target.value as "human" | "normal")}><option value="human">Pessoa</option><option value="normal">Bot</option></Select></Field>
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      {player && <Button variant="ghost" className="mr-auto" onClick={onRemove}>Remover</Button>}
      <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
      <Button type="submit" disabled={!name.trim()}>{player ? "Salvar" : "Adicionar"}</Button>
    </div>
  </form>;
}

function ParticipantSlot({ index, player, onChange }: { index: number; player: Setup | null; onChange: (player: Setup | null) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="flex min-w-0 flex-col items-center gap-2">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("size-16 aspect-square overflow-hidden rounded-full! border border-dashed border-field-border p-0", player && "border-solid")} aria-label={player ? `Editar ${player.name}` : `Adicionar jogador ${index + 1}`}>
          {player ? <Avatar className="size-full" aria-hidden="true"><AvatarFallback className="text-lg">{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar> : <Plus className="size-6" aria-hidden="true" />}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{player ? "Editar jogador" : "Adicionar jogador"}</DialogTitle>
        <ParticipantForm player={player} onSave={value => { onChange(value); setOpen(false); }} onRemove={() => { onChange(null); setOpen(false); }} />
      </DialogContent>
    </Dialog>
    <span className={cn("w-full truncate text-center text-xs font-medium", !player && "text-muted")} title={player?.name}>{player?.name ?? "Disponível"}</span>
  </div>;
}

function SetupScreen({ onStart }: { onStart: (setup: Setup[]) => void }) {
  const { username, openLogin } = useDemoSession();
  const [count, setCount] = useState(2);
  const [opponents, setOpponents] = useState<(Setup | null)[]>(Array(5).fill(null));
  const selected = opponents.slice(0, count - 1);
  const ready = selected.every(player => player !== null);
  return (
    <div className="mx-auto flex min-h-96 w-full max-w-xl flex-col justify-center py-6 sm:py-12">
      <Surface>
        <Field className="grid-cols-[1fr_auto] items-center gap-4 text-base">
          Número de jogadores
          <Select aria-label="Número de jogadores" value={count} onChange={event => setCount(Number(event.target.value))}>
            {[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}</option>)}
          </Select>
        </Field>
        <div className="mt-7 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5" aria-label="Lugares da partida">
          <div className="flex min-w-0 flex-col items-center gap-2">
            <Avatar className="size-16 border border-brand" aria-hidden="true"><AvatarFallback className="text-lg">{username ? Array.from(username)[0]?.toLocaleUpperCase("pt-BR") : <UserRound className="size-6" />}</AvatarFallback></Avatar>
            <span className="w-full truncate text-center text-xs font-medium text-accent" title={username ?? "Sua conta"}>{username ?? "Sua conta"}</span>
          </div>
          {selected.map((player, i) => <ParticipantSlot key={i} index={i + 1} player={player} onChange={value => setOpponents(previous => previous.map((entry, j) => i === j ? value : entry))} />)}
        </div>
      </Surface>
      <div className="mt-5 grid gap-2">
        <Button disabled={!!username && !ready} onClick={() => {
          if (!username) openLogin();
          else if (ready) onStart([{ name: username, kind: "human" }, ...selected.filter((player): player is Setup => player !== null)]);
        }}>{username ? "Começar partida" : "Entrar para jogar"}</Button>
        <Rules />
      </div>
    </div>
  );
}

export default function Flip7Game() {
  const [game, setGame] = useState<Game | null>(null);
  const [historyVisible, setHistoryVisible] = useState(true);
  const gameRef = useRef<Game | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const [flight, setFlight] = useState<{ card: Card; target: number; initial: boolean; parked: boolean; origin?: { left: number; top: number; width: number } } | null>(null);
  const [landed, setLanded] = useState(false);
  const send = useCallback((action: Action) => {
    const current = gameRef.current;
    if (!current || locked.current) return;
    const next = transition(current, action);
    if (next === current) return;
    if ((action.type === "draw" || action.type === "step") && next.lastDraw) {
      locked.current = true;
      setLanded(false);
      const target = action.type === "step" ? current.forced!.target : current.turn;
      const parked = [next.pending, ...next.queue].some(action => action?.card.id === next.lastDraw!.id);
      setFlight({ card: next.lastDraw, target, initial: !current.players[target].hasDrawn, parked });
    }
    if (action.type === "target" && current.pending) {
      const card = current.pending.card;
      const source = boardRef.current?.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`)?.getBoundingClientRect();
      if (source) {
        locked.current = true;
        setLanded(false);
        setFlight({ card, target: action.target, initial: false, parked: false, origin: { left: source.left, top: source.top, width: source.width } });
      }
    }
    gameRef.current = next;
    setGame(next);
  }, []);
  const leave = () => {
    gameRef.current = null;
    locked.current = false;
    setFlight(null);
    setGame(null);
  };

  useLayoutEffect(() => {
    if (!flight) return;
    const ghost = flyingRef.current;
    const board = boardRef.current;
    const deck = deckRef.current;
    const reveal = revealRef.current;
    const destination = board?.querySelector<HTMLElement>(`[data-flight-card="${flight.card.id}"]`);
    if (!ghost || !board || !deck || !reveal || !destination) return;
    const origin = flight.origin ?? deck.getBoundingClientRect();
    const bounds = board.getBoundingClientRect();
    const target = destination.getBoundingClientRect();
    const staging = flight.parked ? target : reveal.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ onComplete: () => {
      locked.current = false;
      setFlight(null);
    } });
    gsap.set(ghost, { x: origin.left - bounds.left, y: origin.top - bounds.top, rotation: flight.origin ? 0 : -6, scale: flight.origin ? origin.width / ghost.offsetWidth : 0.94, zIndex: flight.origin ? 30 : 0, transformOrigin: "top left" });
    if (flight.origin) {
      timeline.to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, scale: target.width / ghost.offsetWidth, duration: reduced ? 0 : 0.28, ease: "power2.inOut" });
    } else {
      timeline.to(ghost, { x: staging.left - bounds.left, y: staging.top - bounds.top, rotation: 0, scale: 1, duration: reduced ? 0 : 0.12, ease: "power2.out" })
        .set(ghost, { zIndex: 30 })
        .to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, scale: target.width / ghost.offsetWidth, duration: reduced || flight.parked ? 0 : 0.2, ease: "power2.inOut" }, reduced ? ">" : flight.initial ? ">0.02" : ">0.65");
    }
    timeline.call(() => setLanded(true));
    return () => { timeline.kill(); };
  }, [flight]);

  useEffect(() => {
    if (!game || flight || game.phase !== "playing") return;
    const action = automaticAction(game);
    if (!action) return;
    const initial = action.type === "draw" && !game.players[game.turn].hasDrawn;
    const timer = setTimeout(() => send(action), initial ? 60 : game.forced ? 100 : 220);
    return () => clearTimeout(timer);
  }, [game, flight, send]);

  if (!game) return <SetupScreen onStart={setup => {
    const next = createGame(setup, Math.floor(Math.random() * 4294967296));
    gameRef.current = next;
    setGame(next);
  }} />;
  const current = game.players[game.turn];
  const actor = game.pending ? game.players[game.pending.source] : current;
  const human = actor.kind === "human";
  const playable = !flight && game.phase === "playing" && !game.pending && !game.forced && human && current.hasDrawn;
  const validTargets = targets(game);
  const maxScore = Math.max(...game.players.map(player => player.total));
  const winners = game.players.filter(player => player.total === maxScore);
  const actionLabel = game.pending?.give ? "Segunda chance" : game.pending?.card.type === "freeze" ? "Congelar" : "Compre 3";
  const status = game.phase === "over" ? `${winners.map(player => player.name).join(" e ")} ${winners.length > 1 ? "venceram" : "venceu"}!`
    : game.phase === "summary" ? (game.flip7 !== null ? `${game.players[game.flip7].name} fez Flip7!` : "Rodada encerrada")
    : game.forced ? `${game.players[game.forced.target].name}: mais ${game.forced.remaining} carta(s)`
    : game.pending ? `${actor.name} · ${actionLabel}: escolha alguém` : `Vez de ${current.name}${!current.hasDrawn ? " · Distribuindo a primeira carta" : human ? " · Faça uma ação" : ""}`;
  const waitingActions = [game.pending, ...game.queue].filter(action => action !== null);
  const activeSeat = game.forced?.target ?? game.pending?.source ?? game.turn;

  return (
    <Surface ref={boardRef} className="relative @container min-h-[34rem] bg-transparent p-0 sm:p-0" role="region" aria-label="Mesa de Flip7">
      <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-medium" aria-live="polite">{flight ? `${game.players[flight.target].name} está recebendo uma carta` : status}</h2>
          {playable && <div className="flex gap-2">
            <Button className="min-w-24" onClick={() => send({ type: "draw" })}>Comprar</Button>
            <Button className="min-w-24" variant="secondary" disabled={!numbers(current).length} onClick={() => send({ type: "stay" })}>Parar</Button>
          </div>}
          {game.phase !== "playing" && <Button onClick={() => game.phase === "summary" ? send({ type: "next" }) : leave()} disabled={!!flight}>{game.phase === "summary" ? "Próxima rodada" : "Jogar novamente"}</Button>}
        </div>
        <Button className="ml-auto" variant="ghost" size="icon" aria-label={historyVisible ? "Esconder histórico" : "Mostrar histórico"} title={historyVisible ? "Esconder histórico" : "Mostrar histórico"} aria-expanded={historyVisible} aria-controls="flip7-history" disabled={!!flight} onClick={() => setHistoryVisible(visible => !visible)}>
          {historyVisible ? <PanelRightClose className="size-4" aria-hidden="true" /> : <PanelRightOpen className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      <div className={cn("grid items-start gap-6", historyVisible && "@[60rem]:grid-cols-[minmax(0,1fr)_14rem]")}>
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex max-w-full flex-wrap gap-2" aria-label="Baralho e ações pendentes">
              <div ref={deckRef} className="relative z-10 flex h-32 w-20 flex-col font-sans items-center justify-center rounded-xl border-2 border-field-border/30 bg-control-hover sm:h-36 sm:w-24" aria-label={`${game.deck.length} cartas no baralho`}>
                <span className="text-4xl font-medium normal-nums sm:text-5xl">{game.deck.length}</span>
                <span className="absolute bottom-3 text-xs">Cartas</span>
              </div>
              {waitingActions.map(action => <div key={action.card.id} data-flight-card={action.card.id} aria-label={`${cardLabel(action.card)} de ${game.players[action.source].name} aguardando ação`} className={flight?.card.id === action.card.id && !landed ? "invisible" : undefined}>
                <PlayingCard card={action.card} />
              </div>)}
              <div ref={revealRef} data-card-reveal aria-hidden="true" className="h-32 w-20 shrink-0 sm:h-36 sm:w-24" />
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-x-6 gap-y-4 @[36rem]:w-auto @[36rem]:flex-1 @[44rem]:grid-cols-3" aria-label="Usuários da partida">
              {game.players.map((player, i) => <div key={i} className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11" aria-hidden="true">
                  <AvatarFallback className={cn("text-sm", game.phase === "playing" && activeSeat === i && "bg-selected text-accent")}>
                    {Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={cn("truncate text-sm font-medium", game.phase === "playing" && activeSeat === i && "text-accent")}>{player.name}</p>
                    <Badge variant={player.status === "playing" ? "default" : "secondary"} className="shrink-0 px-2 py-0.5 font-medium">{playerStatus[player.status]}</Badge>
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="text-xl font-semibold text-foreground tabular-nums" title="Pontos garantidos">{player.total}</span>
                    <span className="tabular-nums" title="Total incluindo a rodada em andamento"><span className="font-medium text-accent">{player.total + (game.phase === "playing" ? score(player) : 0)}</span> ao vivo</span>
                  </p>
                </div>
              </div>)}
            </div>
          </div>
          <div className={cn("grid items-start gap-4", game.players.length === 2 ? "@[40rem]:grid-cols-2" : "@[44rem]:grid-cols-3")}>
            {game.players.map((player, i) => {
              const inTransit = flight?.target === i && !flight.parked && !player.cards.some(card => card.id === flight.card.id) ? [flight.card] : [];
              const cards = [...player.cards, ...inTransit];
              const modifiers = cards.filter(card => card.type !== "number");
              const numeric = cards.filter(card => card.type === "number");
              const flipped = player.status === "busted" && (!flight || flight.target !== i || landed);
              const renderCard = (card: Card) => <div key={card.id} data-flight-card={card.id} className={cn("min-w-0", flight?.card.id === card.id && !landed && "invisible")}><PlayingCard card={card} flipped={flipped} fluid /></div>;
              return <section key={i} aria-label={`Mesa de ${player.name}`} className={cn(
                "relative min-h-48 min-w-0 rounded-panel border border-field-border/60 p-3",
                game.phase === "playing" && activeSeat === i && "border-brand",
                player.status !== "playing" && "opacity-50",
              )}>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <h3 className="min-w-0 truncate font-medium">{player.name}</h3>
                  {player.status !== "playing" && <span className="text-xs text-muted">{playerStatus[player.status]}</span>}
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums" title="Pontos nesta rodada">{score(player)} pts</span>
                </div>
                <div style={{ "--hand-columns": Math.max(numeric.length, modifiers.length, 1) } as CSSProperties} className="space-y-2 [--hand-max:5rem] sm:[--hand-max:6rem]">
                  {modifiers.length > 0 && <div className="grid max-w-[calc(var(--hand-columns)*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))] gap-2">{modifiers.map(renderCard)}</div>}
                  <div className="grid max-w-[calc(var(--hand-columns)*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))] gap-2">{numeric.map(renderCard)}</div>
                </div>
                {!flight && game.phase === "playing" && game.pending && human && validTargets.includes(i) && <Button variant="ghost" aria-label={`Escolher ${player.name}`} title={`Escolher ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-accent hover:bg-brand/10" onClick={() => send({ type: "target", target: i })}><span className="sr-only">Escolher {player.name}</span></Button>}
              </section>;
            })}
          </div>
        </div>
        <aside id="flip7-history" hidden={!historyVisible} className="min-w-0 bg-surface p-4 rounded-panel" aria-label="Histórico da partida">
          <div className="max-h-96 overflow-y-auto text-xs leading-relaxed text-muted" data-lenis-prevent><GameLog game={game} /></div>
        </aside>
      </div>
      {flight && <div ref={flyingRef} aria-hidden="true" data-flying-card className={cn("pointer-events-none absolute top-0 left-0 z-30", landed && "invisible")}><PlayingCard card={flight.card} /></div>}
    </Surface>
  );
}
