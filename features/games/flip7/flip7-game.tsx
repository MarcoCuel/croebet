"use client";

import { useCallback, useId, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { usePageBack } from "@/components/layout/page-back";
import gsap from "gsap";
import { toast } from "sonner";
import { BookOpen, PanelRightClose, PanelRightOpen, PlayingCardsFan, Heart, Snowflake, Plus, Minus, Divide, ArrowLeftRight, Hand, Trash2, X, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as Surface } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDemoSession } from "@/features/auth/session-context";
import { automaticAction, canStay, cardLabel, createGame, isNumber, modeLabel, score, targets, transition } from "./engine";
import type { Action, Card, Game, GameOptions, Setup } from "./engine";
import { cardChoices } from "./vengeance";
import { GOAL } from "./engine";
import { matchStorageKey, currentMatch, matchUrl, saveMatch, type SavedMatch } from "./match-storage";

function Rules({ options }: { options: GameOptions }) {
  return <Dialog><DialogTrigger asChild><Button variant="secondary" className="w-full" aria-label="Regras"><BookOpen className="size-4" aria-hidden="true" />Regras</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[min(34rem,calc(100%-2rem))] overflow-y-auto" data-lenis-prevent>
      <DialogTitle>Como jogar Flip7 · {modeLabel(options)}</DialogTitle>
      {options.mode === "vengeance" ? <VengeanceRules brutal={options.brutal} /> : <>
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
      </>}
      <p className="mt-5 text-xs text-muted">Jogo de Eric Olsen{options.mode === "vengeance" ? " e Alyssa Swatek" : ""}. Modo local: compartilhe o dispositivo. Os pontos desta partida são independentes dos Croins.</p>
    </DialogContent>
  </Dialog>;
}
function VengeanceRules({ brutal }: { brutal: boolean }) {
  return <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
    <li>Compre ou pare. Repetir um número estoura. Sete cartas numéricas encerram a rodada; o 13 da sorte permite uma exceção aos números diferentes. Vence o maior total ao fim da rodada em que alguém alcançar 200.</li>
    <li>O Zero obriga a continuar comprando e zera a rodada, exceto se completar Flip7. O 7 azarado descarta suas outras cartas; recebê-lo não estoura. O 13 da sorte permite dois 13; um terceiro estoura.</li>
    <li>Some os números, aplique ÷2 arredondando para baixo, subtraia −2, −4, −6, −8 e −10 e, por último, acrescente o bônus de 15 do Flip7. {brutal ? "A pontuação pode ser negativa." : "A pontuação não pode ficar abaixo de zero."}</li>
    <li>Roubar, Descartar e Trocar são resolvidos por quem comprou a ação, selecionando diretamente as cartas. Trocar permite conferir uma prévia e confirmar ou cancelar. Só mais uma! e Compre 4 permitem escolher quem receberá a ação. Roubar pega uma carta de outra pessoa. Trocar troca duas cartas de pessoas diferentes. Descartar remove uma carta. Essas ações são obrigatórias quando há cartas válidas. Trocas e roubos podem causar estouro.</li>
    <li>Só mais uma! obriga a comprar uma carta e parar. Compre 4 força até quatro compras; ações e modificadores só são resolvidos depois, na ordem de compra. Estourar durante a sequência descarta os efeitos que acabaram de sair.</li>
    <li>Quem parou continua vulnerável a ações e modificadores e resolve efeitos sem voltar à atividade. {brutal ? "Modificadores também podem atingir quem estourou; cartas anteriores ao estouro ficam fora de jogo." : "Quem estourou fica fora dos alvos."}</li>
    {brutal && <li>Ao fazer Flip7, escolha entre ganhar 15 pontos ou tirar 15 de outra pessoa. A rodada só é contabilizada após essa escolha.</li>}
  </ol>;
}
const playerStatus = { playing: "Ativo", stayed: "Parou", frozen: "Congelado", busted: "Estourou" } as const;
const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze"];
const numberColors = ["neutral", "slate", "lime", "pink", "cyan", "green", "purple", "coral", "lime", "orange", "red", "blue", "slate", "sky"];
function PlayingCard({ card, flipped = false, compact = false, fluid = false, sideways = false }: { card: Card; flipped?: boolean; compact?: boolean; fluid?: boolean; sideways?: boolean }) {
  const gradientId = useId();
  const holographic = card.type === "lucky13" && !compact && !flipped;
  const special = ["freeze", "chance", "three", "one", "four", "steal", "swap", "remove"].includes(card.type);
  const numeric = isNumber(card);
  const Icon = card.type === "freeze" ? Snowflake : card.type === "chance" ? Heart : card.type === "swap" ? ArrowLeftRight : card.type === "steal" ? Hand : card.type === "remove" ? Trash2 : PlayingCardsFan;
  const color = card.type === "unlucky7" ? "silver" : numeric ? numberColors[card.value]
    : card.type === "freeze" || card.type === "one" ? "cyan"
    : card.type === "four" ? "yellow" : card.type === "three" || card.type === "steal" ? "amber"
    : card.type === "minus" || card.type === "halve" ? "red"
    : card.type === "swap" ? "lime" : card.type === "remove" ? "purple" : "orange";
  const label = card.type === "number" ? numberNames[card.value] : cardLabel(card);
  return (
    <div role="img" aria-label={flipped ? "Carta de costas" : cardLabel(card)} title={flipped ? undefined : cardLabel(card)}
      data-card-back={flipped || undefined}
      data-card-sideways={sideways || undefined}
      data-holographic={holographic || undefined}
      className={cn("@container shrink-0 font-sans normal-nums [perspective:50rem]", fluid ? "aspect-[5/8] w-full sm:aspect-[2/3]" : compact ? "h-14 w-9" : "h-32 w-20 sm:h-36 sm:w-24")}>
      <div className={cn("relative size-full transition-transform duration-300 ease-in-out motion-reduce:transition-none", sideways && "rotate-90 scale-[0.625] sm:scale-[0.666667]")}>
      <div className={cn("relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none", flipped && "[transform:rotateY(180deg)]")}>
        <div aria-hidden={flipped} style={{ "--card-color": !compact && card.type === "chance" ? "var(--color-brand)" : `var(--color-flip-${color})` } as CSSProperties}
          className={cn("absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-control-hover shadow-sm [backface-visibility:hidden]",
            compact ? "rounded-md border-[0.125rem] border-field-border/30" : "rounded-[18cqi] text-(--card-color) after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:inset-shadow-flip-card",
            !compact && !numeric && "bg-(--card-color) text-white",
            compact && (numeric ? "text-(--card-color)" : "border-white/10 bg-(--card-color) text-flip-ink"),
            compact && card.type === "chance" && "bg-brand text-white",
            holographic && "bg-flip-ink text-white",
          )}>
          {holographic && <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--background-image-flip-holographic) bg-size-[250%_250%] bg-center opacity-60 motion-safe:animate-flip-holographic" />
          </>}
          {compact ? <>
            {numeric && <span className="absolute top-0 h-0.5 w-4 rounded-b-full bg-(--card-color)" aria-hidden="true" />}
            {special ? <Icon className="size-4" fill={card.type === "chance" ? "currentColor" : "none"} aria-hidden="true" /> : <span className="text-lg font-medium normal-nums">{cardLabel(card)}</span>}
          </> : <>
            <div className={cn("absolute inset-x-[12cqi] top-[12cqi] z-10 flex items-start justify-between gap-[6cqi]", special && "justify-center")}>
              <span className={cn("min-w-0 text-[16cqi] leading-none font-normal", numeric && "text-foreground", holographic && "text-white", special && "text-center", (["bonus", "double", "minus", "halve"].includes(card.type)) && "text-[32cqi]")}>
                {card.type === "bonus" ? <Plus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "minus" ? <Minus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "halve" ? <Divide className="block size-[24cqi]" aria-hidden="true" /> : card.type === "double" ? <X className="block size-[24cqi]" aria-hidden="true" /> : card.type === "chance" ? <>Segunda<br />Chance</> : label}
              </span>
              {numeric && <span className={cn("size-[11cqi] shrink-0 rounded-full bg-(--card-color)", holographic && "bg-white")} aria-hidden="true" />}
            </div>
            {special ? <Icon className={cn("absolute -bottom-[28cqi] left-[8cqi] size-[112cqi]", card.type === "chance" && "-rotate-15")} strokeWidth={1.5} fill={card.type === "chance" ? "currentColor" : "none"} aria-hidden="true" /> : <svg className="absolute inset-0 size-full overflow-visible font-normal normal-nums" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
              {card.type === "zero" && <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-flip-cyan)" /><stop offset="35%" stopColor="var(--color-flip-pink)" /><stop offset="65%" stopColor="var(--color-flip-neutral)" /><stop offset="100%" stopColor="var(--color-flip-purple)" />
              </linearGradient></defs>}
              <text x="50" y="155" textAnchor="middle" fill={card.type === "zero" ? `url(#${gradientId})` : "currentColor"} fontSize={126} letterSpacing="-0.05em">{card.type === "double" || card.type === "halve" ? 2 : card.value}</text>
            </svg>}
          </>}
        </div>
        <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden bg-control inset-shadow-flip-card [backface-visibility:hidden] [transform:rotateY(180deg)]", compact ? "rounded-md" : "rounded-[18cqi]")}>
          <span className={cn("absolute bg-control-hover", compact ? "inset-1 rounded-sm" : "inset-[14cqi] rounded-[12cqi]")} />
        </div>
      </div>
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

function SetupScreen({ onStart, initialError }: { onStart: (setup: Setup[], options: GameOptions) => void; initialError: string }) {
  const { username, openLogin } = useDemoSession();
  const [count, setCount] = useState(2);
  const [options, setOptions] = useState<GameOptions>({ mode: "classic", brutal: false });
  const [opponents, setOpponents] = useState<(Setup | null)[]>(Array(11).fill(null));
  const selected = opponents.slice(0, count - 1);
  const ready = selected.every(player => player !== null);
  return (
    <div className="mx-auto flex min-h-96 w-full max-w-xl flex-col justify-center py-6 sm:py-12">
      <Surface>
        <Field className="mb-4 min-w-0 items-center gap-2 text-base sm:grid-cols-[1fr_auto] sm:gap-4">
          Versão
          <Select aria-label="Versão do Flip7" value={options.mode} onChange={event => setOptions({ mode: event.target.value as GameOptions["mode"], brutal: false })}>
            <option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option>
          </Select>
        </Field>
        {options.mode === "vengeance" && <Field className="mb-4 min-w-0 items-center gap-2 text-base sm:grid-cols-[1fr_auto] sm:gap-4">
          Modo Brutal
          <Select aria-label="Modo Brutal" value={String(options.brutal)} onChange={event => setOptions(previous => ({ ...previous, brutal: event.target.value === "true" }))}>
            <option value="false">Desativado</option><option value="true">Ativado</option>
          </Select>
        </Field>}
        <Field className="grid-cols-[1fr_auto] items-center gap-4 text-base">
          Número de jogadores
          <Select aria-label="Número de jogadores" value={count} onChange={event => setCount(Number(event.target.value))}>
            {Array.from({ length: 11 }, (_, i) => i + 2).map(value => <option key={value} value={value}>{value}</option>)}
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
          else if (ready) onStart([{ name: username, kind: "human" }, ...selected.filter((player): player is Setup => player !== null)], options);
        }}>{username ? "Começar partida" : "Entrar para jogar"}</Button>
        <Rules options={options} />
      </div>
      {initialError && <p role="alert" className="mt-4 text-sm text-destructive">{initialError}</p>}
    </div>
  );
}

type CardMovement = { card: Card; target: number | null; origin: { left: number; top: number; width: number } };

export default function Flip7Game() {
  const router = useRouter();
  const { registerBackHandler } = usePageBack();
  const [exitHref, setExitHref] = useState<string | null>(null);
  const exitTriggerRef = useRef<HTMLElement | null>(null);
  const [restored] = useState(currentMatch);
  const [game, setGame] = useState<Game | null>(restored.match?.game ?? null);
  const [matchCode, setMatchCode] = useState<string | null>(restored.match?.code ?? null);
  const matchCodeRef = useRef(matchCode);
  const hasMatch = game !== null;
  useEffect(() => {
    if (!hasMatch) return;
    return registerBackHandler(href => {
      exitTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setExitHref(href);
    });
  }, [hasMatch, registerBackHandler]);
  const saveErrorShown = useRef(false);
  const [historyVisible, setHistoryVisible] = useState(true);
  const gameRef = useRef<Game | null>(game);
  const [presentationBefore, setPresentationBefore] = useState<Game | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const [flight, setFlight] = useState<{ card: Card; target: number; initial: boolean; parked: boolean; consumedChance?: Card; discardedCards?: Card[]; discardAfter?: boolean; hand?: { height: number; cards: { id: string; left: number; top: number; width: number; height: number }[] }; origin?: { left: number; top: number; width: number } } | null>(null);
  const [landed, setLanded] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [swapPreview, setSwapPreview] = useState<number[] | null>(null);
  const [movingCards, setMovingCards] = useState<CardMovement[] | null>(null);
  useEffect(() => {
    if (matchCode) matchUrl(matchCode);
  }, [matchCode]);
  const persist = useCallback((next: Game, code: string) => {
    try {
      saveMatch({ version: 1, code, game: next });
      saveErrorShown.current = false;
    } catch {
      if (!saveErrorShown.current) toast.error("Não foi possível salvar a partida. O progresso atual pode ser perdido ao sair.");
      saveErrorShown.current = true;
    }
  }, []);
  const openMatch = (match: SavedMatch) => {
    persist(match.game, match.code);
    matchCodeRef.current = match.code;
    gameRef.current = match.game;
    matchUrl(match.code);
    setMatchCode(match.code);
    setGame(match.game);
  };
  const send = useCallback((action: Action) => {
    const current = gameRef.current;
    if (!current || locked.current) return;
    const next = transition(current, action);
    if (next === current) return;
    setSelectedCards([]);
    setPresentationBefore(current);
    const captureHand = (target: number) => {
      const hand = boardRef.current?.querySelector<HTMLElement>(`[data-player-hand="${target}"]`);
      if (!hand) return undefined;
      return { height: hand.getBoundingClientRect().height, cards: Array.from(hand.querySelectorAll<HTMLElement>("[data-hand-card]")).map(element => {
        const rect = element.getBoundingClientRect();
        return { id: element.dataset.handCard!, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }) };
    };
    if ((action.type === "draw" || action.type === "step") && next.lastDraw) {
      locked.current = true;
      setLanded(false);
      const target = action.type === "step" ? current.forced!.target : current.turn;
      const parked = [next.pending, ...next.queue].some(action => action?.card.id === next.lastDraw!.id);
      const consumedChance = current.players[target].cards.find(card => card.type === "chance" && next.discard.some(discarded => discarded.id === card.id));
      const discardedCards = current.players[target].cards.filter(card => card.id !== consumedChance?.id && next.discard.some(c => c.id === card.id));
      setFlight({ card: next.lastDraw, target, initial: !current.players[target].hasDrawn, parked, consumedChance, discardedCards, discardAfter: !consumedChance && next.discard.some(c => c.id === next.lastDraw!.id), hand: captureHand(target) });
    }
    if (action.type === "target" && current.pending && next.pending?.card.id !== current.pending.card.id) {
      const card = current.pending.card;
      const source = boardRef.current?.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`)?.getBoundingClientRect();
      if (source) {
        locked.current = true;
        setLanded(false);
        setFlight({ card, target: action.target, initial: false, parked: false, discardAfter: next.discard.some(c => c.id === card.id), hand: captureHand(action.target), origin: { left: source.left, top: source.top, width: source.width } });
      }
    }
    if (action.type === "cards" && !swapPreview) {
      const movements = current.players.flatMap((player, owner) => player.cards.flatMap(card => {
        const target = next.players.findIndex(p => p.cards.some(c => c.id === card.id));
        if (target === owner) return [];
        const rect = boardRef.current?.querySelector<HTMLElement>(`[data-hand-card="${card.id}"]`)?.getBoundingClientRect();
        return rect ? [{ card, target: target < 0 ? null : target, origin: { left: rect.left, top: rect.top, width: rect.width } }] : [];
      }));
      if (movements.length) { locked.current = true; setMovingCards(movements); }
    }
    setSwapPreview(null);
    if (matchCodeRef.current) persist(next, matchCodeRef.current);
    gameRef.current = next;
    setGame(next);
  }, [persist, swapPreview]);
  const leave = () => {
    try { window.localStorage.removeItem(matchStorageKey); }
    catch { toast.error("Não foi possível abandonar a partida. Tente novamente."); return false; }
    gameRef.current = null;
    locked.current = false;
    setFlight(null);
    setMovingCards(null);
    setSwapPreview(null);
    setSelectedCards([]);
    setGame(null);
    setMatchCode(null);
    matchCodeRef.current = null;
    matchUrl(null);
    return true;
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
    const hand = board.querySelector<HTMLElement>(`[data-player-hand="${flight.target}"]`);
    const layoutElements: HTMLElement[] = [];
    const timeline = gsap.timeline({ onComplete: () => {
      gsap.set(layoutElements, { clearProps: "transform,width,height" });
      if (hand) gsap.set(hand, { clearProps: "height" });
      locked.current = false;
      setFlight(null);
    } });
    // Preserve the previous hand until the card leaves the reveal area.
    // All destination bounds are measured before applying these visual offsets.
    const extractionDuration = reduced ? 0 : 0.24;
    const revealDuration = reduced ? 0 : 0.16;
    const revealAt = extractionDuration + revealDuration;
    const departure = reduced || flight.origin ? 0 : revealAt + (flight.initial ? 0.02 : 0.65);
    const layoutDuration = reduced ? 0 : flight.origin ? 0.28 : 0.2;
    if (!flight.parked && flight.hand && hand) {
      const height = hand.getBoundingClientRect().height;
      const positions = flight.hand.cards.flatMap(previous => {
        const element = hand.querySelector<HTMLElement>(`[data-hand-card="${previous.id}"]`);
        return element ? [{ previous, element, rect: element.getBoundingClientRect() }] : [];
      });
      timeline.fromTo(hand, { height: flight.hand.height }, { height, duration: layoutDuration, ease: "power2.inOut", immediateRender: true }, departure);
      for (const { previous, element, rect } of positions) {
        layoutElements.push(element);
        timeline.fromTo(element, { x: previous.left - rect.left, y: previous.top - rect.top, width: previous.width, height: previous.height }, { x: 0, y: 0, width: rect.width, height: rect.height, duration: layoutDuration, ease: "power2.inOut", immediateRender: true }, departure);
      }
    }
    gsap.set(ghost, { x: origin.left - bounds.left, y: origin.top - bounds.top, rotation: 0, scale: origin.width / ghost.offsetWidth, zIndex: flight.origin ? 30 : 0, transformOrigin: "top left" });
    if (flight.origin) {
      timeline.to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, scale: target.width / ghost.offsetWidth, duration: reduced ? 0 : 0.28, ease: "power2.inOut" }, 0);
    } else {
      timeline.to(ghost, { x: origin.left - bounds.left + origin.width + 8, y: origin.top - bounds.top, duration: extractionDuration, ease: "power2.inOut" }, 0)
        .set(ghost, { zIndex: 30 }, extractionDuration)
        .to(ghost, { x: staging.left - bounds.left, y: staging.top - bounds.top, scale: 1, duration: revealDuration, ease: "power2.out" }, extractionDuration)
        .to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, scale: target.width / ghost.offsetWidth, duration: reduced || flight.parked ? 0 : 0.2, ease: "power2.inOut" }, departure);
    }
    timeline.call(() => setLanded(true));
    if (flight.consumedChance) {
      const protection = board.querySelector<HTMLElement>(`[data-flight-card="${flight.consumedChance.id}"]`);
      if (protection) {
        const discarded = [destination, protection];
        timeline.set(ghost, { autoAlpha: 0 })
          .set(destination, { visibility: "visible" })
          .to(discarded, { y: reduced ? 0 : -12, duration: reduced ? 0 : 0.16, ease: "power2.out" }, reduced ? ">" : ">0.2")
          .to(discarded, { y: reduced ? 0 : 64, x: reduced ? 0 : 24, rotation: reduced ? 0 : 12, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.32, ease: "power2.in" });
      }
    }
    if (flight.discardedCards?.length || flight.discardAfter) {
      const discarded = [...(flight.discardedCards ?? []).flatMap(card => {
        const element = board.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`);
        return element ? [element] : [];
      }), ...(flight.discardAfter ? [destination] : [])];
      timeline.set(ghost, { autoAlpha: 0 }).set(destination, { visibility: "visible" })
        .to(discarded, { y: reduced ? 0 : 48, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.28, ease: "power2.in" });
    }
    return () => {
      timeline.kill();
      gsap.set(layoutElements, { clearProps: "transform,width,height" });
      if (hand) gsap.set(hand, { clearProps: "height" });
    };
  }, [flight]);

  useLayoutEffect(() => {
    if (!movingCards || !boardRef.current) return;
    const board = boardRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ onComplete: () => { locked.current = false; setMovingCards(null); } });
    for (const movement of movingCards) {
      const ghost = board.querySelector<HTMLElement>(`[data-moving-card="${movement.card.id}"]`);
      const target = movement.target === null ? deckRef.current : board.querySelector<HTMLElement>(`[data-hand-card="${movement.card.id}"]`);
      if (!ghost || !target) continue;
      const rect = target.getBoundingClientRect();
      timeline.fromTo(ghost, { x: movement.origin.left, y: movement.origin.top, scale: movement.origin.width / ghost.offsetWidth, transformOrigin: "top left" },
        { x: rect.left, y: rect.top, scale: rect.width / ghost.offsetWidth, opacity: movement.target === null ? 0 : 1, duration: reduced ? 0 : 0.35, ease: "power2.inOut" }, 0);
    }
    return () => { timeline.kill(); };
  }, [movingCards]);

  useEffect(() => {
    if (!game || flight || movingCards || exitHref || game.phase === "over") return;
    const action: Action | null = game.phase === "summary" ? { type: "next" } : automaticAction(game);
    if (!action) return;
    const initial = action.type === "draw" && !game.players[game.turn].hasDrawn;
    const timer = setTimeout(() => send(action), game.phase === "summary" ? 1600 : initial ? 60 : game.forced ? 100 : 220);
    return () => clearTimeout(timer);
  }, [game, flight, movingCards, exitHref, send]);

  if (!game) return <SetupScreen initialError={restored.error} onStart={(setup, options) => {
    const next = createGame(setup, Math.floor(Math.random() * 4294967296), options);
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    openMatch({ version: 1, code, game: next });
  }} />;
  const visibleGame = ((flight && !landed) || movingCards) ? presentationBefore ?? game : game;
  const current = game.players[game.turn];
  const actor = game.players[game.bonusChoice ?? game.pending?.source ?? game.turn];
  const human = actor.kind === "human";
  const automaticZero = game.mode === "vengeance" && current.cards.some(card => card.type === "zero");
  const playable = !automaticZero && !flight && !movingCards && game.phase === "playing" && !game.pending && !game.forced && game.bonusChoice == null && human && current.hasDrawn;
  const validTargets = targets(game);
  const maxScore = Math.max(...game.players.map(player => player.total));
  const winners = game.players.filter(player => player.total === maxScore);
  const actionLabel = game.pending ? cardLabel(game.pending.card) : "";
  const choices = cardChoices(game);
  const selectingCards = !flight && !movingCards && human && game.pending?.resolving && game.pending.card.type === "swap";
  const validSelection = choices.some(ids => ids.length === selectedCards.length && ids.every(id => selectedCards.includes(id)));
  const eligibleCards = choices.filter(ids => selectedCards.every(id => ids.includes(id))).flat();
  const animateSwapPreview = (ids: number[], reverse = false) => {
    if (locked.current) return;
    const owners = ids.map(id => game.players.findIndex(p => p.cards.some(c => c.id === id)));
    const movements = ids.flatMap((id, index) => {
      const card = game.players[owners[index]]?.cards.find(c => c.id === id);
      const rect = boardRef.current?.querySelector<HTMLElement>(`[data-hand-card="${id}"]`)?.getBoundingClientRect();
      return card && rect ? [{ card, target: owners[reverse ? index : 1 - index], origin: { left: rect.left, top: rect.top, width: rect.width } }] : [];
    });
    setPresentationBefore(game);
    setSwapPreview(reverse ? null : ids);
    setSelectedCards(reverse ? [] : ids);
    if (movements.length) { locked.current = true; setMovingCards(movements); }
  };
  const previewPlayers = swapPreview ? game.players.map(player => ({ ...player, cards: player.cards.map(card => {
    const index = swapPreview.indexOf(card.id);
    return index < 0 ? card : game.players.flatMap(p => p.cards).find(c => c.id === swapPreview[1 - index]) ?? card;
  }) })) : game.players;
  const status = game.phase === "over" ? `${winners.map(player => player.name).join(" e ")} ${winners.length > 1 ? "venceram" : "venceu"}!`
    : game.phase === "summary" ? (game.flip7 !== null ? `${game.players[game.flip7].name} fez Flip7!` : "Rodada encerrada")
    : game.bonusChoice != null ? `${actor.name} · Flip7: ganhe 15 pontos ou tire 15 de alguém`
    : game.forced ? `${game.players[game.forced.target].name}: mais ${game.forced.remaining} carta(s)`
    : swapPreview ? "Prévia da troca · Confirme ou cancele"
    : game.pending?.card.type === "remove" ? (game.pending.resolving ? `${actor.name} vai descartar: escolha uma carta sua ou de outro jogador` : `${actor.name} · Descartar: escolha quem decidirá qual carta remover`)
    : game.pending?.card.type === "steal" ? (game.pending.resolving ? `${actor.name} vai roubar: escolha uma carta de outro jogador` : `${actor.name} · Roubar: escolha quem receberá a carta roubada`)
    : game.pending ? `${actor.name} · ${actionLabel}: ${game.pending.resolving ? "escolha " + (game.pending.card.type === "swap" ? "duas cartas" : "uma carta") : "escolha alguém"}` : !current.hasDrawn ? `Vez de ${current.name} · Distribuindo a primeira carta` : automaticZero ? `${current.name} · Zero: compra automática` : human ? "Sua vez" : `Vez de ${current.name}`;
  const waitingActions = [game.pending, ...game.queue].filter(action => action !== null);
  const activeSeat = visibleGame.bonusChoice ?? visibleGame.forced?.target ?? visibleGame.pending?.source ?? visibleGame.turn;

  return (
    <Surface ref={boardRef} className="relative @container min-h-[34rem] bg-transparent p-0 pb-32 sm:p-0 sm:pb-24" role="region" aria-label="Mesa de Flip7">
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4" data-flip7-controls>
        <div className="pointer-events-auto flex w-fit max-w-[calc(100vw-8rem)] flex-wrap items-center justify-center gap-3 rounded-panel border border-border bg-surface/95 p-3 shadow-lg backdrop-blur-md sm:gap-4">
          <h2 className="text-sm font-medium" aria-live="polite">{flight ? `${game.players[flight.target].name} está recebendo uma carta` : movingCards ? "Movendo cartas" : status}</h2>
          {playable && <div className="flex gap-2">
            <Button className="min-w-24" onClick={() => send({ type: "draw" })}>Comprar</Button>
            <Button className="min-w-24" variant="secondary" disabled={!canStay(current, game)} onClick={() => send({ type: "stay" })}>Parar</Button>
          </div>}
          {selectingCards && <div className="flex gap-2">
            <Button disabled={!validSelection} onClick={() => send({ type: "cards", cards: selectedCards })}>Confirmar</Button>
            <Button variant="secondary" onClick={() => swapPreview ? animateSwapPreview(swapPreview, true) : setSelectedCards([])}>Cancelar</Button>
          </div>}
          {!flight && !movingCards && game.bonusChoice != null && human && <Button onClick={() => send({ type: "bonus", target: null })}>Ganhar 15 pontos</Button>}
          {game.phase === "over" && !flight && !movingCards && <Button onClick={leave}>Jogar novamente</Button>}
        </div>
      </div>
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30">
        <Button variant="secondary" size="icon" className="rounded-full border border-border shadow-sm" aria-label={historyVisible ? "Esconder histórico" : "Mostrar histórico"} title={historyVisible ? "Esconder histórico" : "Mostrar histórico"} aria-expanded={historyVisible} aria-controls="flip7-history" disabled={!!flight || !!movingCards} onClick={() => setHistoryVisible(visible => !visible)}>
          {historyVisible ? <PanelRightClose className="size-4" aria-hidden="true" /> : <PanelRightOpen className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      <div className={cn("grid items-start overflow-x-clip transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none", historyVisible ? "gap-6 @[60rem]:grid-cols-[minmax(0,1fr)_14rem]" : "gap-0 @[60rem]:grid-cols-[minmax(0,1fr)_0rem]")}>
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-4">{modeLabel(game)}</Badge>
          <div className="mb-6 flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex max-w-full flex-wrap gap-2" aria-label="Baralho e ações pendentes">
              <div ref={deckRef} className="relative @container z-10 h-32 w-20 overflow-hidden rounded-2xl bg-control-hover font-sans after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:inset-shadow-flip-card sm:h-36 sm:w-24" aria-label={`${game.deck.length} cartas no baralho`}>
                <div className="absolute inset-x-[12cqi] top-[12cqi] flex items-start justify-between gap-[6cqi]">
                  <span className="text-[16cqi] leading-tight font-medium">Cartas</span>
                </div>
                <svg className="absolute inset-0 size-full font-normal normal-nums" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
                  <text x="50" y="155" textAnchor="middle" fill="currentColor" fontSize={game.deck.length > 9 ? 80 : 126} letterSpacing="-0.05em">{game.deck.length}</text>
                </svg>
              </div>
              {waitingActions.map(action => <div key={action.card.id} data-flight-card={action.card.id} aria-label={`${cardLabel(action.card)} de ${game.players[action.source].name} aguardando ação`} className={flight?.card.id === action.card.id && !landed ? "invisible" : undefined}>
                <PlayingCard card={action.card} />
              </div>)}
              <div ref={revealRef} data-card-reveal aria-hidden="true" className="h-32 w-20 shrink-0 sm:h-36 sm:w-24" />
            </div>
            <div className="flex w-full min-w-0 flex-wrap gap-x-6 gap-y-4 @[36rem]:w-auto @[36rem]:flex-1" aria-label="Usuários da partida">
              {visibleGame.players.map((player, i) => <div key={i} className="flex min-w-0 max-w-full shrink-0 items-center gap-3">
                <Avatar className="size-14" aria-hidden="true">
                  <AvatarFallback className={cn("text-sm", visibleGame.phase === "playing" && activeSeat === i && "bg-selected text-accent")}>
                    {Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={cn("truncate text-sm font-medium", visibleGame.phase === "playing" && activeSeat === i && "text-accent")}>{player.name}</p>
                    <Badge variant={player.status === "playing" ? "default" : "secondary"} className="shrink-0 px-2 py-0.5 font-medium">{playerStatus[player.status]}</Badge>
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="text-xl font-semibold text-foreground tabular-nums" title="Pontos garantidos">{player.total}</span>
                    <span className="tabular-nums" title="Total incluindo a rodada em andamento"><span className="font-medium text-accent">{player.total + (visibleGame.phase === "playing" ? score(player, visibleGame) : 0)}</span> ao vivo</span>
                  </p>
                </div>
              </div>)}
            </div>
          </div>
          <div className={cn("grid auto-rows-fr items-stretch gap-4", game.players.length === 2 ? "@[40rem]:grid-cols-2" : "@[44rem]:grid-cols-3")}>
            {previewPlayers.map((player, i) => {
              const visiblePlayer = visibleGame.players[i];
              const inTransit = flight?.target === i && !flight.parked && !player.cards.some(card => card.id === flight.card.id) ? [flight.card] : [];
              const cards = [...player.cards, ...(flight?.target === i ? flight.discardedCards ?? [] : []), ...(flight?.target === i && flight.consumedChance ? [flight.consumedChance] : []), ...inTransit];
              const modifiers = cards.filter(card => !isNumber(card));
              const numeric = cards.filter(isNumber).sort((a, b) => a.value - b.value);
              const flipped = visiblePlayer.status === "busted" && !movingCards?.some(m => m.target === i) && (!flight || flight.target !== i || landed);
              const renderCard = (card: Card) => <div key={card.id} data-flight-card={card.id} data-hand-card={card.id}
                className={cn("relative min-w-0", ((flight?.card.id === card.id && !landed) || movingCards?.some(m => m.card.id === card.id)) && "invisible")}>
                <PlayingCard card={card} flipped={flipped && (game.mode !== "vengeance" || player.bustedCards?.includes(card.id) !== false)} sideways={game.mode === "vengeance" && visiblePlayer.status === "stayed" && (card.id === numeric[0]?.id || card.id === modifiers[0]?.id)} fluid />
                {!flight && !movingCards && human && eligibleCards.includes(card.id) && <Button variant="ghost" aria-label={`Selecionar ${cardLabel(card)} de ${player.name}`} aria-pressed={selectedCards.includes(card.id)} className={cn("absolute inset-0 size-full rounded-2xl border hover:border-accent hover:bg-brand/10", selectedCards.includes(card.id) ? "border-brand bg-brand/10" : "border-transparent")} onClick={() => {
                  if (game.pending?.card.type === "swap") {
                    if (swapPreview) animateSwapPreview(swapPreview, true);
                    else if (selectedCards.includes(card.id)) setSelectedCards([]);
                    else if (selectedCards.length === 0) setSelectedCards([card.id]);
                    else animateSwapPreview([selectedCards[0], card.id]);
                  } else send({ type: "cards", cards: [card.id] });
                }}><span className="sr-only">Selecionar {cardLabel(card)} de {player.name}</span></Button>}
              </div>;
              return <section key={i} aria-label={`Mesa de ${player.name}`} className={cn(
                "relative min-h-48 min-w-0 rounded-panel border border-field-border/60 p-3",
                visibleGame.phase === "playing" && activeSeat === i && "border-brand",
                visiblePlayer.status !== "playing" && "opacity-50",
              )}>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <h3 className="min-w-0 truncate font-medium">{player.name}</h3>
                  {visiblePlayer.status !== "playing" && <span className="text-xs text-muted">{playerStatus[visiblePlayer.status]}</span>}
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums" title="Pontos nesta rodada">{score(visiblePlayer, visibleGame)} pts</span>
                </div>
                <div data-player-hand={i} style={{ "--hand-columns": Math.max(numeric.length, modifiers.length, 1) } as CSSProperties} className="space-y-2 [--hand-max:5rem] sm:[--hand-max:6rem]">
                  {modifiers.length > 0 && <div className="grid max-w-[calc(var(--hand-columns)*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))] gap-2">{modifiers.map(renderCard)}</div>}
                  <div className="grid max-w-[calc(var(--hand-columns)*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))] gap-2">{numeric.map(renderCard)}</div>
                </div>
                {!flight && !movingCards && game.phase === "playing" && game.pending && human && validTargets.includes(i) && <Button variant="ghost" aria-label={game.pending.card.type === "steal" ? `${player.name} vai roubar` : game.pending.card.type === "remove" ? `${player.name} escolhe a carta para descartar` : `Escolher ${player.name}`} title={game.pending.card.type === "steal" ? `${player.name} receberá a carta roubada` : game.pending.card.type === "remove" ? `${player.name} poderá escolher uma carta de qualquer mão` : `Escolher ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-accent hover:bg-brand/10" onClick={() => send({ type: "target", target: i })}>{game.pending.card.type === "steal" ? <span>{player.name} vai roubar</span> : game.pending.card.type === "remove" ? <span>{player.name} escolhe o descarte</span> : <span className="sr-only">Escolher {player.name}</span>}</Button>}
                {!flight && !movingCards && game.bonusChoice != null && human && <Button variant="ghost" aria-label={game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-accent hover:bg-brand/10" onClick={() => send({ type: "bonus", target: game.bonusChoice === i ? null : i })}><span className="sr-only">{game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`}</span></Button>}
              </section>;
            })}
          </div>
        </div>
        <div className={cn("grid min-w-0 overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none", historyVisible ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <aside id="flip7-history" inert={!historyVisible} aria-hidden={!historyVisible} className={cn("min-h-0 min-w-0 overflow-hidden transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:w-56", !historyVisible && "invisible translate-x-full")} aria-label="Histórico da partida">
            <div className="rounded-panel bg-surface p-4">
              <div className="max-h-[max(12rem,calc(100dvh-var(--header-height)-10rem))] overflow-y-auto text-xs leading-relaxed text-muted" data-lenis-prevent><GameLog game={visibleGame} /></div>
            </div>
          </aside>
        </div>
      </div>
      <Dialog open={exitHref !== null} onOpenChange={open => { if (!open) setExitHref(null); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); exitTriggerRef.current?.focus(); }}>
          <DialogTitle>Abandonar partida?</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted">A partida será encerrada e o progresso será perdido.</DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Continuar jogando</Button></DialogClose>
            <Button variant="destructive" onClick={() => {
              if (exitHref && leave()) {
                const href = exitHref;
                setExitHref(null);
                router.push(href);
              }
            }}>Abandonar partida</Button>
          </div>
        </DialogContent>
      </Dialog>
      {movingCards?.map(m => <div key={m.card.id} data-moving-card={m.card.id} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-40"><PlayingCard card={m.card} /></div>)}
      {flight && <div ref={flyingRef} aria-hidden="true" data-flying-card className={cn("pointer-events-none absolute top-0 left-0 z-30", landed && "invisible")}><PlayingCard card={flight.card} /></div>}
    </Surface>
  );
}
