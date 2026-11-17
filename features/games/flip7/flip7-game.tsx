"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { BookOpen, ChartNoAxesColumn, Layers, Heart, Snowflake, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card as Surface } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDemoSession } from "@/features/auth/session-context";
import { botAction, cardLabel, createGame, numbers, score, targets, transition } from "./engine";
import type { Action, Card, Game, PlayerKind, Setup } from "./engine";
import { GOAL } from "./engine";

const kinds: { value: PlayerKind; label: string }[] = [
  { value: "human", label: "Pessoa" }, { value: "easy", label: "Bot fácil" },
  { value: "normal", label: "Bot médio" }, { value: "hard", label: "Bot difícil" },
];
function Rules({ compact = false }: { compact?: boolean }) {
  return <Dialog><DialogTrigger asChild><Button variant={compact ? "ghost" : "secondary"} size={compact ? "icon" : "default"} className={compact ? undefined : "w-full"} aria-label="Regras" title="Regras"><BookOpen className="size-4" aria-hidden="true" />{!compact && "Regras"}</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="w-[min(34rem,calc(100%-2rem))]">
      <DialogTitle>Como jogar Flip7</DialogTitle>
      <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
        <li>Em cada turno, compre uma carta ou pare para garantir seus pontos. É preciso ter pelo menos uma carta numérica para parar.</li>
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
const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze"];
const numberColors = ["neutral", "slate", "lime", "pink", "cyan", "green", "purple", "amber", "lime", "orange", "red", "blue", "slate"];
function PlayingCard({ card, flipped = false }: { card: Card; flipped?: boolean }) {
  const special = card.type === "freeze" || card.type === "chance" || card.type === "three";
  const Icon = card.type === "freeze" ? Snowflake : card.type === "chance" ? Heart : Layers;
  const color = card.type === "number" ? numberColors[card.value] : card.type === "freeze" ? "cyan" : card.type === "three" ? "amber" : "orange";
  const label = card.type === "number" ? numberNames[card.value] : cardLabel(card);
  return (
    <div role="img" aria-label={flipped ? "Carta de costas" : cardLabel(card)} title={flipped ? undefined : cardLabel(card)}
      data-card-back={flipped || undefined}
      className="h-32 w-20 shrink-0 [perspective:50rem] sm:h-36 sm:w-24">
      <div className={cn("relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none", flipped && "[transform:rotateY(180deg)]")}>
        <div aria-hidden={flipped} style={{ "--card-color": `var(--color-flip-${color})` } as CSSProperties}
          className={cn("absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-field-border/30 bg-control-hover shadow-sm [backface-visibility:hidden]",
            card.type === "number" ? "text-(--card-color)" : "border-white/10 bg-(--card-color) text-flip-ink",
            card.type === "chance" && "bg-brand text-white",
          )}>
          {card.type === "number" && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-(--card-color)" aria-hidden="true" />}
          {special ? <Icon className="size-7" fill={card.type === "chance" ? "currentColor" : "none"} aria-hidden="true" /> : <span className="text-4xl font-medium tabular-nums sm:text-5xl">{cardLabel(card)}</span>}
          <span className={cn("absolute inset-x-1 bottom-3 text-center text-xs leading-tight", card.type === "number" && "text-foreground")}>{label}</span>
        </div>
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center rounded-xl border-2 border-field-border/30 bg-control-hover [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="grid h-16 w-10 place-items-center rounded-lg border border-brand/40 text-xl font-black text-brand">7</span>
        </div>
      </div>
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (setup: Setup[]) => void }) {
  const { username, openLogin } = useDemoSession();
  const [opponents, setOpponents] = useState<Setup[]>([{ name: "Jogador 2", kind: "easy" }]);
  const players: Setup[] = [{ name: username ?? "Sua conta", kind: "human" }, ...opponents];
  const updateKind = (index: number, kind: PlayerKind) => setOpponents(previous =>
    previous.map((player, i) => i === index ? { ...player, kind } : player),
  );
  const changeCount = (count: number) => setOpponents(previous => Array.from(
    { length: count - 1 },
    (_, i) => previous[i] ?? { name: `Jogador ${i + 2}`, kind: "human" },
  ));

  return (
    <div className="mx-auto flex min-h-96 w-full max-w-sm flex-col justify-center py-6 sm:py-12">
      <Surface className="space-y-3 bg-transparent">
        <h2 className="mb-5 text-center text-base font-semibold">Configuração</h2>
        <Field className="grid-cols-[1fr_auto] items-center gap-4">
          Jogadores
          <Select aria-label="Número de jogadores" value={players.length} onChange={event => changeCount(Number(event.target.value))}>
            {[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count}</option>)}
          </Select>
        </Field>
        {players.map((player, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
            <span className="truncate text-sm font-medium" title={player.name}>{player.name}</span>
            {i > 0 && (
              <Select aria-label={`Tipo do participante ${i + 1}`} value={player.kind} onChange={event => updateKind(i - 1, event.target.value as PlayerKind)}>
                {kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </Select>
            )}
          </div>
        ))}
      </Surface>
      <div className="mt-5 grid gap-2">
        <Button onClick={() => username ? onStart(players) : openLogin()}>{username ? "Começar partida" : "Entrar para jogar"}</Button>
        <Rules />
      </div>
    </div>
  );
}

function LeaveGame({ onLeave }: { onLeave: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Nova partida" title="Nova partida"><X className="size-4" aria-hidden="true" /></Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Encerrar esta partida?</DialogTitle>
        <p className="mt-4 text-sm text-muted">O placar atual será perdido.</p>
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild><Button variant="secondary">Continuar jogando</Button></DialogClose>
          <DialogClose asChild><Button onClick={onLeave}>Encerrar</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Scoreboard({ game }: { game: Game }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Placar" title="Placar"><ChartNoAxesColumn className="size-4" aria-hidden="true" /></Button></DialogTrigger>
      <DialogContent aria-describedby={undefined} className="w-[min(40rem,calc(100%-2rem))]">
        <DialogTitle>Placar</DialogTitle>
        <div className="mt-5 overflow-x-auto" data-lenis-prevent>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Pontuação de cada rodada e total</caption>
            <thead><tr><th className="pb-3 pr-4 font-medium text-muted">Rodada</th>{game.players.map((player, i) => <th key={i} className="max-w-32 truncate px-2 pb-3 font-medium">{player.name}</th>)}</tr></thead>
            <tbody>
              {game.history.map((row, i) => <tr key={i} className="border-t border-border"><th className="py-2 font-normal text-muted">{i + 1}</th>{row.map((points, j) => <td key={j} className="px-2 py-2 tabular-nums">+{points}</td>)}</tr>)}
              <tr className="border-t border-border"><th className="py-3">Total</th>{game.players.map((player, i) => <td key={i} className="px-2 py-3 font-bold tabular-nums">{player.total}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <details className="mt-5 text-sm text-muted">
          <summary className="cursor-pointer">Últimas jogadas</summary>
          <ol className="mt-3 space-y-2">{game.log.map((line, i) => <li key={i}>{line}</li>)}</ol>
        </details>
      </DialogContent>
    </Dialog>
  );
}

export default function Flip7Game() {
  const [game, setGame] = useState<Game | null>(null);
  const gameRef = useRef<Game | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const [flight, setFlight] = useState<{ card: Card; target: number } | null>(null);
  const [landed, setLanded] = useState(false);
  const send = useCallback((action: Action) => {
    const current = gameRef.current;
    if (!current || locked.current) return;
    const next = transition(current, action);
    if (next === current) return;
    if ((action.type === "draw" || action.type === "step") && next.lastDraw) {
      locked.current = true;
      setLanded(false);
      setFlight({ card: next.lastDraw, target: action.type === "step" ? current.forced!.target : current.turn });
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
    const destination = board?.querySelector<HTMLElement>(`[data-flight-card="${flight.card.id}"]`);
    if (!ghost || !board || !deck || !destination) return;
    const origin = deck.getBoundingClientRect();
    const bounds = board.getBoundingClientRect();
    const target = destination.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ onComplete: () => {
      locked.current = false;
      setFlight(null);
    } });
    gsap.set(ghost, { x: origin.left - bounds.left, y: origin.top - bounds.top, rotation: -6, scale: 0.94, zIndex: 0 });
    timeline.to(ghost, { x: origin.left - bounds.left + origin.width + 12, rotation: 0, scale: 1, duration: reduced ? 0 : 0.24, ease: "power2.out" })
      .set(ghost, { zIndex: 30 })
      .to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, duration: reduced ? 0 : 0.65, ease: "power2.inOut" }, reduced ? ">" : ">0.1")
      .call(() => setLanded(true))
      .to({}, { duration: reduced ? 0 : 0.75 });
    return () => { timeline.kill(); };
  }, [flight]);

  useEffect(() => {
    if (!game || flight || game.phase !== "playing") return;
    const actor = game.pending ? game.players[game.pending.source] : game.players[game.turn];
    if (!game.forced && actor.kind === "human") return;
    const timer = setTimeout(() => {
      const action: Action = game.forced ? { type: "step" } : botAction(game);
      send(action);
    }, 900);
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
  const playable = !flight && game.phase === "playing" && !game.pending && !game.forced && human;
  const validTargets = targets(game);
  const maxScore = Math.max(...game.players.map(player => player.total));
  const winners = game.players.filter(player => player.total === maxScore);
  const actionLabel = game.pending?.give ? "Segunda chance" : game.pending?.card.type === "freeze" ? "Congelar" : "Compre 3";
  const status = game.phase === "over" ? `${winners.map(player => player.name).join(" e ")} ${winners.length > 1 ? "venceram" : "venceu"}!`
    : game.phase === "summary" ? (game.flip7 !== null ? `${game.players[game.flip7].name} fez Flip7!` : "Rodada encerrada")
    : game.forced ? `${game.players[game.forced.target].name}: mais ${game.forced.remaining} carta(s)`
    : game.pending ? `${actor.name} · ${actionLabel}: escolha alguém` : `Vez de ${current.name}${human ? " · Faça uma ação" : ""}`;
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
        <div className="ml-auto flex items-center gap-1"><Scoreboard game={game} /><Rules compact /><LeaveGame onLeave={leave} /></div>
      </div>
      <div className="grid items-start gap-6 @[60rem]:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex shrink-0 gap-2" aria-label="Baralho e última carta">
              <div ref={deckRef} className="relative z-10 flex h-32 w-20 flex-col items-center justify-center rounded-xl border-2 border-field-border/30 bg-control-hover sm:h-36 sm:w-24" aria-label={`${game.deck.length} cartas no baralho`}>
                <span className="text-4xl font-medium tabular-nums sm:text-5xl">{game.deck.length}</span>
                <span className="absolute bottom-3 text-xs">Cartas</span>
              </div>

            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 @[44rem]:grid-cols-3" aria-label="Usuários da partida">
              {game.players.map((player, i) => <div key={i} className="flex min-w-0 items-center gap-3">
                <Avatar className="size-11" aria-hidden="true">
                  <AvatarFallback className={cn("text-sm", game.phase === "playing" && activeSeat === i && "bg-selected text-accent")}>
                    {Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <p className={cn("truncate text-sm font-medium", game.phase === "playing" && activeSeat === i && "text-accent")}>{player.name}</p>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="tabular-nums"><span className="font-medium text-foreground">{player.total}</span> pts</span>
                    <span>{player.status === "busted" ? "Estourou" : player.status === "stayed" ? "Parou" : "Ativo"}</span>
                  </p>
                </div>
              </div>)}
            </div>
          </div>
          <div className={cn("grid items-start gap-4", game.players.length === 2 ? "@[40rem]:grid-cols-2" : "@[44rem]:grid-cols-3")}>
            {game.players.map((player, i) => {
              const inTransit = flight?.target === i && !player.cards.some(card => card.id === flight.card.id) ? [flight.card] : [];
              const cards = [...player.cards, ...inTransit];
              const modifiers = cards.filter(card => card.type !== "number");
              const numeric = cards.filter(card => card.type === "number");
              const flipped = player.status === "busted" && (!flight || flight.target !== i || landed);
              const renderCard = (card: Card) => <div key={card.id} data-flight-card={card.id} className={flight?.card.id === card.id && !landed ? "invisible" : undefined}><PlayingCard card={card} flipped={flipped} /></div>;
              return <section key={i} aria-label={`Mesa de ${player.name}`} className={cn(
                "relative min-h-48 min-w-0 rounded-panel border border-field-border/60 p-3",
                game.phase === "playing" && activeSeat === i && "border-brand",
                player.status !== "playing" && "opacity-50",
              )}>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <h3 className="min-w-0 truncate font-medium">{player.name}</h3>
                  {player.status !== "playing" && <span className="text-xs text-muted">{player.status === "busted" ? "Estourou" : "Parou"}</span>}
                  <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs text-white" title="Pontos nesta rodada">{score(player)} pts</span>
                </div>
                {modifiers.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{modifiers.map(renderCard)}</div>}
                <div className="flex flex-wrap gap-2">{numeric.map(renderCard)}</div>
                {!flight && game.phase === "playing" && game.pending && human && validTargets.includes(i) && <Button variant="ghost" aria-label={`Escolher ${player.name}`} title={`Escolher ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-accent hover:bg-brand/10" onClick={() => send({ type: "target", target: i })}><span className="sr-only">Escolher {player.name}</span></Button>}
              </section>;
            })}
          </div>
        </div>
        <aside className="min-w-0 border-t border-border pt-4 @[60rem]:border-t-0 @[60rem]:border-l @[60rem]:pl-5 @[60rem]:pt-0" aria-label="Histórico da partida">
          <h3 className="text-xs font-medium text-muted">Histórico</h3>
          <ol className="mt-3 max-h-96 space-y-3 overflow-y-auto text-xs leading-relaxed text-muted" data-lenis-prevent>{game.log.map((line, i) => <li key={i} className="border-b border-border pb-3 last:border-0">{line}</li>)}</ol>
        </aside>
      </div>
      {flight && <div ref={flyingRef} aria-hidden="true" data-flying-card className={cn("pointer-events-none absolute top-0 left-0 z-30", landed && "invisible")}><PlayingCard card={flight.card} /></div>}
    </Surface>
  );
}
