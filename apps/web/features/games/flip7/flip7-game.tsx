"use client";
import { numberColors } from "./card-colors";
import dynamic from "next/dynamic";
import { TableViewToggle, useTableView } from "../table-view";
import { rememberStart } from "./api";
import { flip7OptionsSchema, roomSyncSchema } from "@croebet/shared";
import { gameUrl } from "../game-url";
import {CancellationNotice,proposeCancellation} from "../match-cancellation";
import { Flip7ReplayControls, useFlip7Replay, type ResultMetadata } from "./flip7-replay";
import { Flip7Result } from "./flip7-result";
import { GameActionBar, GameDrawActions, GameActionShortcuts } from "../game-action-bar";
import { GameTableLayout } from "../game-table-layout";
import { GameControls } from "../game-controls";
import { useGameAudio } from "../use-game-audio";
import { randomUUID } from "@/lib/uuid";

import { useCallback, useMemo, useId, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { matchReplaySchema } from "@croebet/shared";
import type { GameRecord, MatchFrame, MatchCommand, RoomSync } from "@croebet/shared";
import type { InitialMatches } from "./server-matches";
import { sendMatchCommand, abandonServerMatch, createdPresentation, clearCreatedPresentation } from "./api";
import { toast } from "sonner";
import { LogOut, BookOpen, PlayingCardsFan, PlayingCard as PlayingCardIcon, Heart, Lock, Plus, Minus, Divide, ArrowLeftRight, Hand, ArrowUp, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CroinIcon } from "@/components/shared/croin-icon";
import { Button } from "@/components/ui/button";
import { Card as Surface } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSession } from "@/features/auth/session-context";
import { canStay, cardLabel, isNumber, modeLabel, score, targets } from "./presentation";
import type { Action, Card, Game, GameOptions } from "./presentation";
import { cardChoices } from "./vengeance";
import { drawTiming, forcedActionPresentation } from "./action-presentation";
import { gameWithPlayerNames } from "./player-name";
import { LobbyScreen } from "../lobby";
import { useMatchLive } from "./live";
import { KickPlayer } from "../kick-player";
import { GOAL } from "./presentation";


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
      <p className="mt-5 text-xs text-muted">Partidas gratuitas entre contas da Croebet. Cada pessoa controla suas próprias jogadas. Recarregar ou desconectar mantém sua participação; não há limite de tempo para jogar.</p>
      <p className="mt-3 text-xs text-muted">Jogo de Eric Olsen{options.mode === "vengeance" ? " e Alyssa Swatek" : ""}.</p>
    </DialogContent>
  </Dialog>;
}
function VengeanceRules({ brutal }: { brutal: boolean }) {
  return <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
    <li>Compre ou pare. Repetir um número estoura. Sete cartas numéricas encerram a rodada; o 13 da sorte permite uma exceção aos números diferentes. Vence o maior total ao fim da rodada em que alguém alcançar 200.</li>
    <li>O Zero obriga a continuar comprando e zera a rodada, exceto se completar Flip7. O 7 de merda descarta suas outras cartas; recebê-lo não estoura. O 13 da sorte permite dois 13; um terceiro estoura.</li>
    <li>Some os números, aplique ÷2 arredondando para baixo, subtraia −2, −4, −6, −8 e −10 e, por último, acrescente o bônus de 15 do Flip7. {brutal ? "A pontuação pode ser negativa." : "A pontuação não pode ficar abaixo de zero."}</li>
    <li>Roubar, Descartar e Trocar são resolvidos por quem comprou a ação, selecionando diretamente as cartas. Trocar permite conferir uma prévia e confirmar ou cancelar. Só mais uma! e Compre 4 permitem escolher quem receberá a ação. Roubar pega uma carta de outra pessoa. Trocar troca duas cartas de pessoas diferentes. Descartar remove uma carta. Essas ações são obrigatórias quando há cartas válidas. Trocas e roubos podem causar estouro.</li>
    <li>Só mais uma! obriga a comprar uma carta e parar. Compre 4 força até quatro compras; ações e modificadores só são resolvidos depois, na ordem de compra. Estourar durante a sequência descarta os efeitos que acabaram de sair.</li>
    <li>Quem parou continua vulnerável a ações e modificadores e resolve efeitos sem voltar à atividade. {brutal ? "Modificadores também podem atingir quem estourou; cartas anteriores ao estouro ficam fora de jogo." : "Quem estourou fica fora dos alvos."}</li>
    {brutal && <li>Ao fazer Flip7, escolha entre ganhar 15 pontos ou tirar 15 de outra pessoa. A rodada só é contabilizada após essa escolha.</li>}
  </ol>;
}
const playerStatus = { playing: "Ativo", stayed: "Parou", frozen: "Congelado", busted: "Estourou" } as const;
const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze"];
export function PlayingCard({ card, flipped = false, compact = false, fluid = false, sideways = false }: { card: Card; flipped?: boolean; compact?: boolean; fluid?: boolean; sideways?: boolean }) {
  const gradientId = useId();
  const holographic = card.type === "lucky13" && !flipped;
  const special = ["freeze", "chance", "three", "one", "four", "steal", "swap", "remove"].includes(card.type);
  const numeric = isNumber(card);
  const Icon = card.type === "one" ? PlayingCardIcon : card.type === "freeze" ? Lock : card.type === "chance" ? Heart : card.type === "swap" ? ArrowLeftRight : card.type === "steal" ? Hand : card.type === "remove" ? ArrowUp : PlayingCardsFan;
  const color = card.type === "unlucky7" ? "silver" : numeric ? numberColors[card.value]
    : card.type === "freeze" || card.type === "one" ? "cyan"
    : card.type === "four" ? "yellow" : card.type === "three" || card.type === "steal" ? "amber"
    : card.type === "minus" || card.type === "halve" ? "red"
    : card.type === "swap" ? "lime" : card.type === "remove" ? "purple" : "orange";
  const label = card.type === "number" ? numberNames[card.value] : cardLabel(card);
  const zeroGradient = card.type === "zero" ? <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor="var(--color-flip-cyan)" /><stop offset="35%" stopColor="var(--color-flip-pink)" /><stop offset="65%" stopColor="var(--color-flip-neutral)" /><stop offset="100%" stopColor="var(--color-flip-purple)" />
  </linearGradient></defs> : null;
  return (
    <div role="img" aria-label={flipped ? "Carta de costas" : cardLabel(card)} title={flipped ? undefined : cardLabel(card)}
      data-card-back={flipped || undefined}
      data-card-sideways={sideways || undefined}
      data-holographic={holographic || undefined}
      className={cn("relative @container shrink-0 font-sans normal-nums [perspective:50rem]", fluid ? sideways ? "aspect-[8/5] w-full sm:aspect-[3/2]" : "aspect-[5/8] w-full sm:aspect-[2/3]" : compact ? "h-14 w-9" : "h-32 w-20 sm:h-36 sm:w-24")}>
      <div className={cn("relative @container w-full aspect-[5/8] transition-transform duration-300 ease-in-out motion-reduce:transition-none sm:aspect-[2/3]", compact && "h-full aspect-auto sm:aspect-auto", sideways && "absolute top-1/2 left-1/2 w-[62.5%] -translate-x-1/2 -translate-y-1/2 rotate-90 sm:w-2/3")}>
      <div className={cn("relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none", flipped && "[transform:rotateY(180deg)]")}>
        <div aria-hidden={flipped} style={{ "--card-color": !compact && card.type === "chance" ? "var(--color-brand)" : `var(--color-flip-${color})` } as CSSProperties}
          className={cn("absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-flip-card shadow-md [backface-visibility:hidden] after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:[box-shadow:var(--inset-shadow-flip-card)]",
            compact ? "rounded-md" : "rounded-[18cqi] text-(--card-color)",
            !compact && !numeric && "bg-(--card-color) text-white",
            compact && (numeric ? "text-(--card-color)" : "bg-(--card-color) text-white"),
            compact && card.type === "chance" && "bg-brand text-white",
            holographic && "bg-flip-ink text-white",
          )}>
          {holographic && <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--background-image-flip-holographic) bg-size-[250%_250%] bg-center opacity-60 motion-safe:animate-flip-holographic" />
          </>}
          {compact ? <>
            {numeric && <span className={cn("absolute top-1 right-1 z-10 size-1 rounded-full bg-(--card-color)", holographic && "bg-white")} aria-hidden="true" />}
            {special ? <Icon className="size-4 rotate-15" fill="none" aria-hidden="true" /> : card.type === "zero" ? <svg className="relative z-10 h-8 w-6 font-medium normal-nums" viewBox="0 0 24 32" aria-hidden="true">
              {zeroGradient}
              <text x="12" y="23" textAnchor="middle" fontSize={18} fill={`url(#${gradientId})`}>0</text>
            </svg> : <span className="relative z-10 text-lg font-medium normal-nums">{numeric ? card.value : cardLabel(card)}</span>}
          </> : <>
            <div className={cn("absolute inset-x-[12cqi] top-[12cqi] z-10 flex items-start justify-between gap-[6cqi]", special && "justify-center")}>
              <span className={cn("min-w-0 text-[16cqi] leading-none font-normal", numeric && "text-foreground", holographic && "text-white", special && "text-center", (["bonus", "double", "minus", "halve"].includes(card.type)) && "text-[32cqi]")}>
                {card.type === "bonus" ? <Plus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "minus" ? <Minus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "halve" ? <Divide className="block size-[24cqi]" aria-hidden="true" /> : card.type === "double" ? <X className="block size-[24cqi]" aria-hidden="true" /> : card.type === "chance" ? <>Segunda<br />Chance</> : label}
              </span>
              {numeric && <span className={cn("size-[11cqi] shrink-0 rounded-full bg-(--card-color)", holographic && "bg-white")} aria-hidden="true" />}
            </div>
            {special ? <Icon className="absolute -bottom-[28cqi] left-[8cqi] size-[112cqi] rotate-15" strokeWidth={1.5} fill="none" aria-hidden="true" /> : <svg className="absolute inset-0 size-full overflow-visible font-normal normal-nums" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
              {zeroGradient}
              <text x="50" y="155" textAnchor="middle" fill={card.type === "zero" ? `url(#${gradientId})` : "currentColor"} fontSize={126} letterSpacing="-0.05em">{card.type === "double" || card.type === "halve" ? 2 : card.value}</text>
            </svg>}
          </>}
        </div>
        <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden bg-flip-card-back [box-shadow:var(--inset-shadow-flip-card)] [backface-visibility:hidden] [transform:rotateY(180deg)]", compact ? "rounded-md" : "rounded-[18cqi]")}>
          <span className={cn("absolute flex items-center justify-center bg-flip-card-inset overflow-hidden", compact ? "inset-1 rounded-sm" : "inset-2.5 rounded-[12cqi]")}>
            <span className={cn("rotate-12 font-bold leading-none text-contrast/6", compact ? "text-2xl" : "text-[120cqi]")}>7</span>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}


type CardMovement = { card: Card; target: number | null; origin: { left: number; top: number; width: number } };

export default function Flip7Game({ initial, game, testControls, exitControl }: { initial: InitialMatches; game: GameRecord | null; testControls?:ReactNode;exitControl?:ReactNode }) {
  const router = useRouter();
  const [requestedReplay, setRequestedReplay] = useState<ReturnType<typeof matchReplaySchema.parse> | null>(null);
  const [preparingReplay, setPreparingReplay] = useState(false);
  async function openReplay() {
    if (!initial.match || preparingReplay) return;
    setPreparingReplay(true);
    try {
      const response = await fetch(`/api/v1/me/matches/${initial.match.code}?limit=100`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível abrir o replay da partida.");
      setRequestedReplay(matchReplaySchema.parse(await response.json()));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir o replay da partida."); }
    finally { setPreparingReplay(false); }
  }
  if (initial.unavailable) return <Surface className="mx-auto max-w-xl space-y-4"><p role="alert">{initial.error}</p><Button onClick={() => router.refresh()}>Tentar novamente</Button></Surface>;
  if (requestedReplay && requestedReplay.match.code === initial.match?.code) return <Flip7Playback key={`replay:${initial.revision}`} initial={{ ...initial, replay: requestedReplay }} startPlaying />;
  if (initial.replay) return <Flip7Playback key={initial.revision} initial={initial} />;
  if (!game) return null;
  if (!initial.match) return <LobbyScreen key={initial.revision} game={game} initial={initial} onStarted={sync=>{const parsed=roomSyncSchema.safeParse(sync);if(parsed.success)rememberStart(parsed.data);}} rules={options=><Rules options={flip7OptionsSchema.parse(options)}/>}/>;
  return <Flip7Table key={initial.revision} initial={initial} testControls={testControls} exitControl={exitControl} onRequestReplay={openReplay} replayPending={preparingReplay} />;
}

function Flip7Playback({ initial, startPlaying = false }: { initial: InitialMatches; startPlaying?: boolean }) {
  const playback = useFlip7Replay(initial.replay!, startPlaying);
  if (!initial.replay?.frames.length) return <Surface><p className="text-sm text-muted">Nenhuma jogada disponível nesta partida.</p></Surface>;
  return <Flip7Table initial={initial} replay={{ epoch: playback.epoch, index: playback.index, frame: playback.frame, paused: playback.animationPaused, delay: playback.delay, onPresented: playback.onPresented, state: playback.state, active: playback.active, finished: initial.replay!.match.status === "finished", metadata: playback.metadata, restart: playback.restart, loading: playback.loading, controls: <Flip7ReplayControls playback={playback} /> }} />;
}

const FlipScene = dynamic(() => import("./flip-scene"), { ssr: false, loading: () => <p role="status">Carregando mesa 3D…</p> });

function Flip7Table({ initial, replay, testControls, exitControl, onRequestReplay, replayPending = false }: { exitControl?:ReactNode;testControls?:ReactNode; initial: InitialMatches; onRequestReplay?: () => Promise<void>; replayPending?: boolean; replay?: { epoch: number; index: number; frame?: MatchFrame; paused: boolean; delay: number; onPresented: (index: number) => void; state?: Game; active: boolean; finished: boolean; metadata: ResultMetadata; controls: ReactNode; restart: () => void; loading: boolean } }) {
  const router = useRouter();
  const tableView = useTableView("flip7");
  const [sceneAnimating, setSceneAnimating] = useState(false);
  const audio = useGameAudio();
  const { play: playSound, stop: stopSounds } = audio;
  const pathname = usePathname();
  const gameSlug = initial.match?.game ?? pathname.slice("/jogos/".length);
  const matchUrl = (code: string | null) => router.push(gameUrl(gameSlug,{code}), { scroll: false });
  const {userId,refreshWallet,permissions}=useSession();
  const refreshWalletRef=useRef(refreshWallet);
  useEffect(()=>{refreshWalletRef.current=refreshWallet;},[refreshWallet]);
  const serverMatch = useRef(initial.match);
  const [matchInfo,setMatchInfo]=useState(initial.match);
  const receivedVersion=useRef(initial.match?.version ?? 0);
  const incoming=useRef<RoomSync|null>(null);
  const [liveRevision,setLiveRevision]=useState(0);
  const connected=useMatchLive(initial.match?.code,matchInfo?.version ?? 0,!replay,sync=>{
    if(sync.room.version<=receivedVersion.current)return;
    const prior=incoming.current;
    incoming.current=prior && !sync.reset ? {...sync,frames:[...prior.frames,...sync.frames.filter(frame=>frame.version>prior.room.version)],reset:prior.reset} : sync;
    setLiveRevision(n=>n+1);
  },()=>{},(message,roomClosed)=>{toast.error(message);if(roomClosed){router.push(gameUrl(gameSlug));router.refresh();}});
  const [creation] = useState(() => replay ? null : createdPresentation(initial.match));
  useEffect(() => { if (!replay) clearCreatedPresentation(initial.match?.code); }, [initial.match?.code, replay]);
  const pendingCommand = useRef<MatchCommand | null>(null);
  const pendingAbandon = useRef<{ commandId: string; expectedVersion: number } | null>(null);
  const [frames, setFrames] = useState<MatchFrame[]>(creation?.frames ?? []);
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const exitTriggerRef = useRef<HTMLElement | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [resultReady, setResultReady] = useState(!!replay && !replay.active && replay.finished);
  const prizePlayed = useRef(initial.match?.status === "finished");
  useEffect(() => {
    if (replay || !resultReady || prizePlayed.current) return;
    prizePlayed.current = true;
    if (matchInfo?.potTotal && matchInfo.settlement === "paid") playSound("prize");
  }, [replay, resultReady, matchInfo?.potTotal, matchInfo?.settlement, playSound]);
  const refreshedEconomy=useRef("");
  useEffect(()=>{
    if(replay || !userId || !initial.match?.entryAmount || (matchInfo?.status==="finished" && !resultReady))return;
    const key=`${userId}:${matchInfo?.id}:${matchInfo?.settlement}`;
    if(refreshedEconomy.current===key)return;
    refreshedEconomy.current=key;
    void refreshWalletRef.current();
  },[matchInfo?.settlement,matchInfo?.status,matchInfo?.id,resultReady,userId,initial.match?.entryAmount,replay]);
  const resultTriggerRef = useRef<HTMLButtonElement>(null);
  const [liveGame, setGame] = useState<Game | null>(replay?.state ?? creation?.before ?? initial.match?.state ?? null);
  const game = liveGame;
  const [resolvingCard, setResolvingCard] = useState(() => forcedActionPresentation(replay?.state ?? creation?.before ?? initial.match?.state ?? null));
  const resolvingCardFinished = !!resolvingCard && !game?.forced;
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const gameRef = useRef<Game | null>(game);
  const [presentationBefore, setPresentationBefore] = useState<Game | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const replayEpoch = useRef(replay?.epoch);
  const replayIndex = useRef(replay?.loading ? null : replay?.index);
  const replayPrizePlayed = useRef(replay?.state?.phase === "over");
  const animationTimelines = useRef(new Set<gsap.core.Timeline>());
  const [flight, setFlight] = useState<{ card: Card; target: number; initial: boolean; parked: boolean; consumedChance?: Card; discardedCards?: Card[]; discardAfter?: boolean; hand?: { height: number; cards: { id: string; left: number; top: number; width: number; height: number }[] }; origin?: { left: number; top: number; width: number } } | null>(null);
  const [landed, setLanded] = useState(false);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [swapPreview, setSwapPreview] = useState<number[] | null>(null);
  const [movingCards, setMovingCards] = useState<CardMovement[] | null>(null);
  useEffect(() => {
    if (replay || game?.phase !== "over" || resolvingCard || flight || movingCards || sceneAnimating) return;
    const timeout = window.setTimeout(() => setResultReady(true), 1500);
    return () => window.clearTimeout(timeout);
  }, [game?.phase, resolvingCard, flight, movingCards, replay, sceneAnimating]);
  const replayActive = replay?.active;
  const replayPot = replay?.metadata.potTotal;
  const present = useCallback((action: Action, next: Game) => {
    const current = gameRef.current;
    if (!current) return;
    if (current.players.every(player => !player.cards.length) && next.players.some(player => player.cards.length) && current.round === 1 && initial.match?.entryAmount) playSound("entry");
    setSelectedCards([]);
    setPresentationBefore(current);
    if (tableView.view === "3d") {
      setSceneAnimating(true);
      const held = forcedActionPresentation(next);
      if (held) setResolvingCard(held);
      if (action.type === "draw" || action.type === "step" || action.type === "cards" || action.type === "target") playSound("slide");
      gameRef.current = next; setGame(next); return;
    }
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
      const heldAction = forcedActionPresentation(next);
      if (heldAction) setResolvingCard(heldAction);
      const source = boardRef.current?.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`)?.getBoundingClientRect();
      if (source) {
        locked.current = true;
        setLanded(false);
        setFlight({ card, target: action.target, initial: false, parked: false, discardAfter: !heldAction && next.discard.some(c => c.id === card.id), hand: captureHand(action.target), origin: { left: source.left, top: source.top, width: source.width } });
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
    gameRef.current = next;
    setGame(next);
  }, [swapPreview, playSound, initial.match?.entryAmount, tableView.view]);
  const replayReset = replay?.epoch;
  const replayFrame = replay?.frame;
  const replayFrameIndex = replay?.index;
  const replayLoading = replay?.loading;
  const onReplayPresented = replay?.onPresented;
  useEffect(() => {
    if (!replayActive) return;
    const reset = replayEpoch.current !== replayReset;
    if (reset) {
      stopSounds();
      // Preserve the slider DOM (and pointer capture) while cancelling the
      // previous presentation, even if the selected archive page is loading.
      for (const timeline of animationTimelines.current) timeline.kill();
      animationTimelines.current.clear();
    }
    if (reset && replayLoading) {
      const timer = window.setTimeout(() => {
        locked.current = false;
        setFlight(null); setMovingCards(null); setResolvingCard(null);
        setPresentationBefore(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (replayLoading || !replayFrame || (!reset && replayIndex.current === replayFrameIndex)) return;
    const timer = window.setTimeout(() => {
      const previousIndex = replayIndex.current;
      replayEpoch.current = replayReset;
      replayIndex.current = replayFrameIndex;
      if (reset || previousIndex == null) {
        locked.current = false;
        setFlight(null); setMovingCards(null); setLanded(false);
        setPresentationBefore(null); setSwapPreview(null); setSelectedCards([]);
        const elements = boardRef.current?.querySelectorAll("[data-hand-card], [data-flight-card], [data-player-hand]");
        if (elements?.length) gsap.set(elements, { clearProps: "transform,width,height,opacity,visibility" });
        gameRef.current = replayFrame.state;
        setGame(replayFrame.state);
        setResolvingCard(forcedActionPresentation(replayFrame.state));
        replayPrizePlayed.current = replayFrame.state.phase === "over";
        setResultReady(false); setResultDismissed(true);
      } else present(replayFrame.action, replayFrame.state);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [replayActive, replayReset, replayLoading, replayFrame, replayFrameIndex, present, stopSounds]);
  useEffect(() => {
    if (!replayActive || replayLoading || replayFrameIndex == null || replayIndex.current !== replayFrameIndex || replayEpoch.current !== replayReset || flight || movingCards || resolvingCardFinished || sceneAnimating) return;
    if (liveGame?.phase === "over" && !replayPrizePlayed.current) {
      replayPrizePlayed.current = true;
      if (replayPot) playSound("prize");
    }
    onReplayPresented?.(replayFrameIndex);
  }, [replayActive, replayReset, replayLoading, replayFrameIndex, liveGame, flight, movingCards, resolvingCardFinished, onReplayPresented, replayPot, playSound, sceneAnimating]);
  const send = useCallback(async (action: Action) => {
    const match = serverMatch.current;
    if (!match || !connected || (incoming.current && incoming.current.room.version>receivedVersion.current) || locked.current || busy || sceneAnimating || frames.length || resolvingCardFinished) return;
    if (action.type === "step" || action.type === "next" || action.type === "start" || action.type === "replace") return;
    if (pendingCommand.current && JSON.stringify(pendingCommand.current.action) !== JSON.stringify(action)) {
      toast.error("Confirme a ação pendente ou recarregue a partida."); return;
    }
    pendingCommand.current ??= { commandId: randomUUID(), expectedVersion: match.version, action };
    locked.current = true; setBusy(true); setCommandError("");
    try {
      await sendMatchCommand(match.code, pendingCommand.current);
      pendingCommand.current = null;
      // Confirmed frames arrive through the same Socket.IO event for everyone.
    } catch (error) { setCommandError(error instanceof Error ? error.message : "Não foi possível enviar a jogada."); }
    finally { locked.current = false; setBusy(false); }
  }, [busy, connected, frames.length, resolvingCardFinished, sceneAnimating]);
  const leave = async () => {
    if (!serverMatch.current || leavingRef.current || busy) return false;
    leavingRef.current = true;
    setLeaving(true);
    try {
      // Abandon against the newest confirmed state, even while its frames
      // are waiting for the current card animation to finish.
      const match = incoming.current && incoming.current.room.version > serverMatch.current.version ? incoming.current.room : serverMatch.current;
      pendingAbandon.current ??= { commandId: randomUUID(), expectedVersion: match.version };
      await abandonServerMatch(match.code, pendingAbandon.current.commandId, pendingAbandon.current.expectedVersion);
      pendingAbandon.current = null;
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abandonar a partida. Tente novamente."); return false; }
    finally { leavingRef.current = false; setLeaving(false); }
    stopSounds();
    gameRef.current = null;
    locked.current = false;
    setFlight(null);
    setMovingCards(null);
    setSwapPreview(null);
    setSelectedCards([]);
    setGame(null);
    setResolvingCard(null);
    setResultDismissed(false);
    setResultReady(false);
    serverMatch.current = null;
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
      if (layoutElements.length) gsap.set(layoutElements, { clearProps: "transform,width,height" });
      if (hand) gsap.set(hand, { clearProps: "height" });
      locked.current = false;
      setFlight(null);
    } });
    const timelines = animationTimelines.current;
    timelines.add(timeline);
    // Preserve the previous hand until the card leaves the reveal area.
    // All destination bounds are measured before applying these visual offsets.
    const extractionDuration = reduced ? 0 : drawTiming.extraction;
    const revealDuration = reduced ? 0 : drawTiming.reveal;
    const revealAt = extractionDuration + revealDuration;
    const departure = reduced || flight.origin ? 0 : revealAt + (flight.initial ? drawTiming.initialReading : drawTiming.reading);
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
        .to(ghost, { x: target.left - bounds.left, y: target.top - bounds.top, scale: target.width / ghost.offsetWidth, duration: reduced || flight.parked ? 0 : drawTiming.delivery, ease: "power2.inOut" }, departure);
    }
    timeline.call(() => playSound("slide"), [], 0);
    timeline.call(() => setLanded(true));
    if (flight.consumedChance) {
      const protection = board.querySelector<HTMLElement>(`[data-flight-card="${flight.consumedChance.id}"]`);
      if (protection) {
        const discarded = [destination, protection];
        timeline.call(() => playSound("discard")).set(ghost, { autoAlpha: 0 })
          .set(destination, { visibility: "visible" })
          .to(discarded, { y: reduced ? 0 : -12, duration: reduced ? 0 : 0.16, ease: "power2.out" }, reduced ? ">" : ">0.2")
          .to(discarded, { y: reduced ? 0 : -128, x: reduced ? 0 : 96, rotation: reduced ? 0 : 18, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.32, ease: "power2.in" });
      }
    }
    if (flight.discardedCards?.length || flight.discardAfter) {
      const discarded = [...(flight.discardedCards ?? []).flatMap(card => {
        const element = board.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`);
        return element ? [element] : [];
      }), ...(flight.discardAfter ? [destination] : [])];
      timeline.call(() => playSound("discard")).set(ghost, { autoAlpha: 0 }).set(destination, { visibility: "visible" })
        .to(discarded, { y: reduced ? 0 : -128, x: reduced ? 0 : 96, rotation: reduced ? 0 : 18, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.35, ease: "power2.in" });
    }
    return () => {
      if (timeline.progress() < 1) stopSounds();
      timeline.kill();
      timelines.delete(timeline);
      if (layoutElements.length) gsap.set(layoutElements, { clearProps: "transform,width,height" });
      if (hand) gsap.set(hand, { clearProps: "height" });
    };
  }, [flight, playSound, stopSounds]);

  useLayoutEffect(() => {
    if (!movingCards || !boardRef.current) return;
    const board = boardRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline({ onComplete: () => { locked.current = false; setMovingCards(null); } });
    timeline.call(() => playSound(movingCards.some(card => card.target === null) ? "discard" : "slide"), [], 0);
    const timelines = animationTimelines.current;
    timelines.add(timeline);
    for (const movement of movingCards) {
      const ghost = board.querySelector<HTMLElement>(`[data-moving-card="${movement.card.id}"]`);
      const target = movement.target === null ? deckRef.current : board.querySelector<HTMLElement>(`[data-hand-card="${movement.card.id}"]`);
      if (!ghost || !target) continue;
      const rect = target.getBoundingClientRect();
      timeline.fromTo(ghost, { x: movement.origin.left, y: movement.origin.top, scale: movement.origin.width / ghost.offsetWidth, transformOrigin: "top left" },
        { x: movement.target === null ? movement.origin.left + (reduced ? 0 : 96) : rect.left, y: movement.target === null ? movement.origin.top - (reduced ? 0 : 128) : rect.top, scale: movement.target === null ? movement.origin.width / ghost.offsetWidth * (reduced ? 1 : 0.8) : rect.width / ghost.offsetWidth, rotation: movement.target === null && !reduced ? 18 : 0, opacity: movement.target === null ? 0 : 1, duration: reduced ? 0 : 0.35, ease: "power2.inOut" }, 0);
    }
    return () => { if (timeline.progress() < 1) stopSounds(); timeline.kill(); timelines.delete(timeline); };
  }, [movingCards, playSound, stopSounds]);

  useLayoutEffect(() => {
    if (!resolvingCard || !resolvingCardFinished || flight || movingCards || sceneAnimating) return;
    if (tableView.view === "3d") {
      const timer = window.setTimeout(() => setResolvingCard(null), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500);
      return () => window.clearTimeout(timer);
    }
    const element = boardRef.current?.querySelector<HTMLElement>(`[data-hand-card="${resolvingCard.card.id}"]`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    locked.current = true;
    const timeline = gsap.timeline({ onComplete: () => {
      locked.current = false;
      setResolvingCard(null);
    } });
    const timelines = animationTimelines.current;
    timelines.add(timeline);
    // Let the final purchase and its stopped/busted status settle before discarding the action.
    timeline.to({}, { duration: reduced ? 0 : 0.5 });
    if (element) timeline.call(() => playSound("discard")).to(element, { y: reduced ? 0 : -128, x: reduced ? 0 : 96, rotation: reduced ? 0 : 18, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.35, ease: "power2.in" });
    return () => { if (timeline.progress() < 1) stopSounds(); timeline.kill(); timelines.delete(timeline); locked.current = false; };
  }, [resolvingCard, resolvingCardFinished, flight, movingCards, playSound, stopSounds, sceneAnimating, tableView.view]);

  useLayoutEffect(() => {
    if (replay?.paused) stopSounds();
    for (const timeline of animationTimelines.current) {
      timeline.timeScale(replay ? 1000 / replay.delay : 1);
      timeline.paused(replay?.paused ?? false);
    }
  }, [replay, flight, movingCards, resolvingCardFinished, stopSounds]);

  useEffect(() => {
    if (!game || sceneAnimating || resolvingCardFinished || flight || movingCards || exitOpen || leaving || busy || !frames.length) return;
    const frame = frames[0];
    const timer = setTimeout(() => {
      setFrames(previous => previous.slice(1));
      present(frame.action, frame.state);
    }, game.phase === "summary" ? 1600 : 0);
    return () => clearTimeout(timer);
  }, [game, resolvingCardFinished, flight, movingCards, exitOpen, leaving, busy, frames, present, sceneAnimating]);

  useEffect(()=>{
    const sync=incoming.current;
    if(!sync || busy || sceneAnimating || frames.length || flight || movingCards || resolvingCardFinished || locked.current)return;
    incoming.current=null;
    if(sync.room.version<=receivedVersion.current)return;
    if(sync.room.status==="lobby")return;
    if(sync.room.status==="abandoned"){void refreshWallet();toast.info(sync.room.settlement==="refunded"?"Partida cancelada por acordo. As entradas foram devolvidas.":"A partida foi encerrada.");router.push(gameUrl(gameSlug));router.refresh();return;}
    // Fill a gap from persisted events. Large gaps reload a confirmed snapshot.
    const fresh=sync.frames.filter(frame=>frame.version>receivedVersion.current);
    const complete=!sync.reset && fresh.length>0 && fresh[0].version===receivedVersion.current+1 && fresh.at(-1)?.version===sync.room.version;
    if(!complete || fresh.length>12 || document.visibilityState==="hidden"){
      stopSounds();
      // Recover directly to the confirmed snapshot instead of replaying a long
      // animation backlog after a slow connection or a suspended browser tab.
      receivedVersion.current=sync.room.version;serverMatch.current=sync.room;
      setMatchInfo(sync.room);gameRef.current=sync.room.state;setGame(sync.room.state);setPresentationBefore(null);
      setResolvingCard(forcedActionPresentation(sync.room.state));
      setFrames([]);pendingCommand.current=null;setCommandError("");return;
    }
    receivedVersion.current=sync.room.version;serverMatch.current=sync.room;
    setMatchInfo(sync.room);
    pendingCommand.current=null;setCommandError("");setFrames(fresh);
  },[liveRevision,busy,frames,flight,movingCards,resolvingCardFinished,router,stopSounds,refreshWallet,gameSlug,sceneAnimating]);

  const notifiedTurn = useRef<string | null>(null);
  const turnSeat = game ? game.bonusChoice ?? game.pending?.source ?? game.turn : -1;
  const turnOwner = matchInfo?.participants.find(person => person.seat === turnSeat)?.userId;
  const ownsTurn = !replay && game?.phase === "playing" && turnOwner === userId && userId != null && game.players[turnSeat]?.kind === "human";
  const turnKey = ownsTurn ? `${game.round}:${turnSeat}` : null;
  const turnReady = ownsTurn && connected && !sceneAnimating && !busy && !frames.length && !commandError && !flight && !movingCards && !resolvingCardFinished &&
    (game.bonusChoice != null || !!game.pending || (!game.forced && game.players[game.turn].hasDrawn && !(game.mode === "vengeance" && game.players[game.turn].cards.some(card => card.type === "zero"))));
  useEffect(() => {
    if (!ownsTurn) { notifiedTurn.current = null; return; }
    // Busy, animation and connection changes during the same turn must not
    // announce it again. Wait until the confirmed action is available.
    if (!turnReady || notifiedTurn.current === turnKey) return;
    notifiedTurn.current = turnKey;
    playSound("notification");
  }, [ownsTurn, turnReady, turnKey, playSound]);

  const tableParticipants = useMemo(() => replay?.metadata.participants ?? matchInfo?.participants ?? initial.match?.participants ?? [], [replay?.metadata.participants, matchInfo?.participants, initial.match?.participants]);
  const displayGame = useMemo(() => game ? gameWithPlayerNames(game, tableParticipants) : null, [game, tableParticipants]);
  if (!game || !displayGame) return null;
  const visibleGame = gameWithPlayerNames(((flight && !landed) || movingCards) ? presentationBefore ?? game : game, tableParticipants);
  const current = displayGame.players[game.turn];
  const actor = displayGame.players[game.bonusChoice ?? game.pending?.source ?? game.turn];
  const ownSeat=tableParticipants.find(person=>person.userId===userId)?.seat;
  const spectator = !replay && (ownSeat == null || displayGame.players[ownSeat]?.kind !== "human");
  const playerSeats = displayGame.players.map((_, index) => (index + (spectator ? 0 : ownSeat ?? 0)) % displayGame.players.length);
  const human = !replay && connected && ownSeat===(game.bonusChoice ?? game.pending?.source ?? game.turn) && actor.kind === "human" && !busy && !frames.length && !commandError;
  const automaticZero = game.mode === "vengeance" && current.cards.some(card => card.type === "zero");
  const playable = !sceneAnimating && !resolvingCardFinished && !automaticZero && !flight && !movingCards && game.phase === "playing" && !game.pending && !game.forced && game.bonusChoice == null && human && current.hasDrawn;
  const validTargets = targets(game);
  const maxScore = Math.max(...displayGame.players.map(player => player.total));
  const winners = displayGame.players.filter(player => player.total === maxScore);
  const actionLabel = game.pending ? cardLabel(game.pending.card) : "";
  const choices = cardChoices(game);
  const selectingCards = !resolvingCardFinished && !flight && !movingCards && human && game.pending?.resolving && game.pending.card.type === "swap";
  const validSelection = choices.some(ids => ids.length === selectedCards.length && ids.every(id => selectedCards.includes(id)));
  const eligibleCards = choices.filter(ids => selectedCards.every(id => ids.includes(id))).flat();
  const animateSwapPreview = (ids: number[], reverse = false) => {
    if (locked.current) return;
    const owners = ids.map(id => displayGame.players.findIndex(p => p.cards.some(c => c.id === id)));
    const movements = ids.flatMap((id, index) => {
      const card = displayGame.players[owners[index]]?.cards.find(c => c.id === id);
      const rect = boardRef.current?.querySelector<HTMLElement>(`[data-hand-card="${id}"]`)?.getBoundingClientRect();
      return card && rect ? [{ card, target: owners[reverse ? index : 1 - index], origin: { left: rect.left, top: rect.top, width: rect.width } }] : [];
    });
    setPresentationBefore(game);
    setSwapPreview(reverse ? null : ids);
    setSelectedCards(reverse ? [] : ids);
    if (movements.length) { locked.current = true; setMovingCards(movements); }
  };
  const previewPlayers = swapPreview ? displayGame.players.map(player => ({ ...player, cards: player.cards.map(card => {
    const index = swapPreview.indexOf(card.id);
    return index < 0 ? card : displayGame.players.flatMap(p => p.cards).find(c => c.id === swapPreview[1 - index]) ?? card;
  }) })) : displayGame.players;
  const status = game.phase === "over" ? `${winners.map(player => player.name).join(" e ")} ${winners.length > 1 ? "venceram" : "venceu"}!`
    : game.phase === "summary" ? (game.flip7 !== null ? `${displayGame.players[game.flip7].name} fez Flip7!` : "Rodada encerrada")
    : game.bonusChoice != null ? `${actor.name} · Flip7: ganhe 15 pontos ou tire 15 de alguém`
    : game.forced ? `${displayGame.players[game.forced.target].name}: mais ${game.forced.remaining} carta(s)`
    : swapPreview ? "Prévia da troca · Confirme ou cancele"
    : game.pending?.card.type === "remove" ? (game.pending.resolving ? `${actor.name} vai descartar: escolha uma carta sua ou de outro jogador` : `${actor.name} · Descartar: escolha quem decidirá qual carta remover`)
    : game.pending?.card.type === "steal" ? (game.pending.resolving ? `${actor.name} vai roubar: escolha uma carta de outro jogador` : `${actor.name} · Roubar: escolha quem receberá a carta roubada`)
    : game.pending ? `${actor.name} · ${actionLabel}: ${game.pending.resolving ? "escolha " + (game.pending.card.type === "swap" ? "duas cartas" : "uma carta") : "escolha alguém"}` : !current.hasDrawn ? `Vez de ${current.name} · Distribuindo a primeira carta` : automaticZero ? `${current.name} · Zero: compra automática` : human ? "Sua vez" : `Vez de ${current.name}`;
  const waitingActions = [game.pending, ...game.queue].filter(action => action !== null);
  const activeSeat = visibleGame.bonusChoice ?? visibleGame.forced?.target ?? visibleGame.pending?.source ?? visibleGame.turn;

  const actionBar = <GameActionBar wide={replay?.active} contained={tableView.view === "3d"}>
          {replay ? <>{replay.active ? replay.controls : <h2 className="text-sm font-medium">{replay.finished ? status : "Partida encerrada"}</h2>}{!replay.finished && !replay.active && <Button onClick={replay.restart}>Replay</Button>}{game.phase === "over" && !replay.loading && <Button ref={resultTriggerRef} size="sm" variant="secondary" onClick={() => { setResultReady(true); setResultDismissed(false); }}>Ver resultado</Button>}</> : <>
          <h2 className="text-sm font-medium" aria-live="polite">{flight ? `${displayGame.players[flight.target].name} está recebendo uma carta` : (movingCards || sceneAnimating) ? "Movendo cartas" : status}</h2>
          {playable && <GameDrawActions onDraw={() => { void send({ type: "draw" }); }} onStop={() => { void send({ type: "stay" }); }} canStop={canStay(current, game)} />}
          {selectingCards && <div className="flex gap-2">
            <Button disabled={!validSelection || sceneAnimating} onClick={() => send({ type: "cards", cards: selectedCards })}>Confirmar</Button>
            <Button variant="secondary" onClick={() => swapPreview ? animateSwapPreview(swapPreview, true) : setSelectedCards([])}>Cancelar</Button>
          </div>}
          {!resolvingCardFinished && !flight && !movingCards && game.bonusChoice != null && human && <Button onClick={() => send({ type: "bonus", target: null })}>Ganhar 15 pontos</Button>}
          {game.phase === "over" && !flight && !movingCards && <Button ref={resultTriggerRef} onClick={() => { setResultReady(true); setResultDismissed(false); }}>Ver resultado</Button>}
          </>}

      </GameActionBar>;

  const tableHeader = { identity: <>
            {tableView.view === "3d" && <span className="text-sm font-medium">Flip 7</span>}
            <Badge variant="secondary">{modeLabel(game)}</Badge>
            {!!matchInfo?.entryAmount && <Badge className="gap-1.5 tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />Pote: {matchInfo.potTotal.toLocaleString("pt-BR")} Croins</Badge>}
            {initial.match?.development && <Badge>Desenvolvimento</Badge>}
            {replay?.active && <><Badge variant="outline">Replay</Badge><Button size="sm" variant="ghost" className="ml-auto" onClick={() => router.push(gameUrl(gameSlug))}>Sair da reprodução</Button></>}
            {spectator && <Badge variant="outline">Espectador</Badge>}
            </>, controls: <GameControls historyDisabled={!!flight || !!movingCards || sceneAnimating} audio={audio} developmentControls={testControls}>
            <TableViewToggle view={tableView.view} disabled={!!flight || !!movingCards || sceneAnimating || busy} onChange={next => { stopSounds(); setPresentationBefore(null); setSelectedCards([]); setSwapPreview(null); tableView.setView(next); }} />
            {exitControl}
            {!exitControl && spectator && <Button size="icon" variant="ghost" title="Sair da visualização" aria-label="Sair da visualização" onClick={()=>router.push(gameUrl(gameSlug,{development:initial.match?.development && permissions.canManageSite}))}><LogOut className="size-4" aria-hidden="true"/></Button>}
            {!exitControl && !replay && !spectator && game.phase !== "over" && <Button size="icon" variant="ghost" title="Abandonar partida" aria-label="Abandonar partida" disabled={leaving} onClick={event => { exitTriggerRef.current = event.currentTarget; setExitOpen(true); }}><LogOut className="size-4" aria-hidden="true" /></Button>}
            </GameControls> };

  return (
    <Surface ref={boardRef} className="relative isolate @container bg-transparent p-0 sm:p-0" role="region" aria-label="Mesa de Flip7">
      <GameActionShortcuts onDraw={playable && !exitOpen && !leaving ? () => { void send({ type: "draw" }); } : undefined} onStop={playable && !exitOpen && !leaving && canStay(current, game) ? () => { void send({ type: "stay" }); } : undefined} />
      {tableView.view === "classic" && actionBar}
      {!replay && !connected && <p role="status" className="text-sm text-muted">Reconectando à partida…</p>}
          {commandError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm"><p>{commandError}</p><Button variant="secondary" onClick={() => { const action = pendingCommand.current?.action; if (action) void send(action); }}>Tentar novamente</Button><Button variant="secondary" onClick={() => router.refresh()}>Recarregar partida</Button></div>}
      <GameTableLayout fitTable={tableView.view === "3d"} history={visibleGame.log.map(entry => ({
        message: entry.message,
        player: entry.player === undefined ? undefined : {
          name: visibleGame.players[entry.player].name,
          avatarUrl: tableParticipants.find(person => person.seat === entry.player)?.avatarUrl,
        },
        card: entry.card ? <PlayingCard card={entry.card} compact /> : undefined,
      }))}>
        <div className={cn("min-w-0", tableView.view === "3d" ? "pb-4" : replay?.active ? "pb-48 sm:pb-40" : "pb-32 sm:pb-24")}>
          {tableView.view === "classic" && <div className="mb-4 flex flex-wrap items-center gap-3">{tableHeader.identity}{tableHeader.controls}</div>}
          {!replay && matchInfo && <CancellationNotice match={matchInfo}/>}
          {tableView.view === "3d" ? <FlipScene header={tableHeader} actions={actionBar} key={replay?.epoch ?? "live"} game={displayGame} summaryGame={sceneAnimating ? presentationBefore ?? game : game} localPlayer={!spectator} participants={tableParticipants} viewer={ownSeat ?? 0}
            interactive={!sceneAnimating && human} eligible={!resolvingCardFinished && !replay && ownSeat === game.pending?.source && actor.kind === "human" ? [...new Set(eligibleCards)] : []} targetSeats={!resolvingCardFinished && human ? validTargets : []} selected={selectedCards}
            onCard={id => { if (game.pending?.card.type === "swap") setSelectedCards(ids => ids.includes(id) ? [] : ids.length >= 2 ? [id] : [...ids, id]); else void send({ type: "cards", cards: [id] }); }}
            onSeat={seat => { if (game.bonusChoice != null && human) void send({ type: "bonus", target: game.bonusChoice === seat ? null : seat }); else if (human && validTargets.includes(seat)) void send({ type: "target", target: seat }); }}
            canDraw={playable && !exitOpen && !leaving} onDraw={() => void send({ type: "draw" })} status="" onAnimating={setSceneAnimating} animate={!!presentationBefore} held={resolvingCard} paused={replay?.paused} timeScale={replay ? 1000 / replay.delay : 1}>
          </FlipScene> : <>
          <div className="mb-6 flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex max-w-full flex-wrap gap-2" aria-label="Baralho e ações pendentes">
              <div ref={deckRef} className="relative @container z-10 h-32 w-20 overflow-hidden rounded-2xl bg-flip-card font-sans shadow-md after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:[box-shadow:var(--inset-shadow-flip-card)] sm:h-36 sm:w-24" aria-label={`${game.deckCount} cartas no baralho`}>
                <div className="absolute inset-x-[12cqi] top-[12cqi] flex items-start justify-between gap-[6cqi]">
                  <span className="text-[16cqi] leading-tight font-medium">Cartas</span>
                </div>
                <svg className="absolute inset-0 size-full font-normal normal-nums" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
                  <text x="50" y="155" textAnchor="middle" fill="currentColor" fontSize={game.deckCount > 9 ? 80 : 126} letterSpacing="-0.05em">{game.deckCount}</text>
                </svg>
                <Button variant="ghost" disabled={!playable || exitOpen || leaving} aria-label="Comprar carta do baralho" title={playable ? "Comprar carta (Enter)" : "Aguarde sua vez de comprar"} onClick={() => send({ type: "draw" })} className="absolute inset-0 z-30 size-full rounded-2xl p-0 hover:bg-contrast/10 disabled:opacity-100 focus-visible:border-foreground">
                  <span className="sr-only">Comprar carta do baralho</span>
                </Button>
              </div>
              {waitingActions.map(action => <div key={action.card.id} data-flight-card={action.card.id} aria-label={`${cardLabel(action.card)} de ${displayGame.players[action.source].name} aguardando ação`} className={flight?.card.id === action.card.id && !landed ? "invisible" : undefined}>
                <PlayingCard card={action.card} />
              </div>)}
              <div ref={revealRef} data-card-reveal aria-hidden="true" className="h-32 w-20 shrink-0 sm:h-36 sm:w-24" />
            </div>
            <div className="flex justify-around w-full min-w-0 flex-wrap gap-x-6 gap-y-4 @[36rem]:w-auto @[36rem]:flex-1" aria-label="Usuários da partida">
              {playerSeats.map(i => { const player = visibleGame.players[i]; return <div key={i} className="flex min-w-0 max-w-full shrink-0 items-center gap-3">
                <Avatar className={cn("size-14 transition-shadow duration-300 ease-in-out motion-reduce:transition-none", visibleGame.phase === "playing" && activeSeat === i && "shadow-[0_0_0_2px_var(--color-brand)]")} aria-hidden="true">
                  <AvatarImage src={tableParticipants.find(person=>person.seat===i)?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-sm">
                    {Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={cn("truncate text-sm font-medium", visibleGame.phase === "playing" && activeSeat === i && "text-brand")}>{player.name}</p>
                    <Badge variant={player.status === "playing" ? "default" : "secondary"} className="shrink-0 px-2 py-0.5 font-medium">{playerStatus[player.status]}</Badge>
                    {player.kind!=="human" && <Badge variant="secondary">Bot</Badge>}
                    {!replay && matchInfo?.hostId===userId && i!==ownSeat && player.kind==="human" && game.phase==="playing" && <KickPlayer code={matchInfo.code} version={matchInfo.version} userId={matchInfo.participants.find(person=>person.seat===i)!.userId} name={player.name} duringGame withCroins={!!matchInfo.entryAmount} disabled={!connected || busy || frames.length>0 || !!flight || !!movingCards}/>}
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="text-xl font-semibold text-foreground tabular-nums" title="Pontos garantidos">{player.total}</span>
                    <span className="tabular-nums" title="Total incluindo a rodada em andamento"><span className="font-medium text-brand">{player.total + (visibleGame.phase === "playing" ? score(player, visibleGame) : 0)}</span> ao vivo</span>
                  </p>
                </div>
              </div>; })}
            </div>
          </div>
          <div className={cn("grid auto-rows-fr items-stretch gap-4", displayGame.players.length === 2 ? "@[40rem]:grid-cols-2" : "@[44rem]:grid-cols-3")}>
            {playerSeats.map(i => {
              const player = previewPlayers[i];
              const visiblePlayer = visibleGame.players[i];
              const inTransit = flight?.target === i && !flight.parked && !player.cards.some(card => card.id === flight.card.id) ? [flight.card] : [];
              const heldCards = resolvingCard?.target === i ? [resolvingCard.card] : [];
              const cards = [...new Map([...heldCards, ...player.cards, ...(flight?.target === i ? flight.discardedCards ?? [] : []), ...(flight?.target === i && flight.consumedChance ? [flight.consumedChance] : []), ...inTransit].map(card => [card.id, card])).values()];
              const modifiers = cards.filter(card => !isNumber(card));
              const numeric = cards.filter(isNumber).sort((a, b) => a.value - b.value);
              const sideways = game.mode === "vengeance" && visiblePlayer.status === "stayed";
              const columns = Math.max(numeric.length, modifiers.length, 1);
              const rowClass = cn("grid items-center max-w-[calc((var(--hand-columns)+var(--hand-extra))*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] gap-2",
                columns === 1 ? "grid-cols-1" : sideways
                  ? "grid-cols-[minmax(0,var(--hand-first))_repeat(var(--hand-remaining),minmax(0,1fr))]"
                  : "grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))]");
              const flipped = visiblePlayer.status === "busted" && !movingCards?.some(m => m.target === i) && (!flight || flight.target !== i || landed);
              const arrivedCards = player.cards.filter(card => !(flight?.card.id === card.id && !landed) && !movingCards?.some(move => move.card.id === card.id));
              const sixSeven = !flipped
                && arrivedCards.some(card => card.type === "number" && card.value === 6)
                && arrivedCards.some(card => card.type === "number" && card.value === 7);
              const sixIndex = numeric.findIndex(card => card.value === 6);
              const sixNine = !flipped && sixIndex !== -1 && numeric[sixIndex + 1]?.value === 9
                && arrivedCards.some(card => card.id === numeric[sixIndex].id)
                && arrivedCards.some(card => card.id === numeric[sixIndex + 1].id);
              const renderCard = (card: Card) => <div key={card.id} data-flight-card={card.id} data-hand-card={card.id} data-resolving-action={resolvingCard?.card.id === card.id || undefined}
                className={cn("relative min-w-0", ((flight?.card.id === card.id && !landed) || movingCards?.some(m => m.card.id === card.id)) && "invisible")}>
                <div className={cn(
                  sixSeven && card.type === "number" && (card.value === 6 || card.value === 7) && "motion-safe:animate-flip-six-seven",
                  sixNine && card.type === "number" && (card.value === 6 || card.value === 9) && "motion-safe:animate-flip-six-nine",
                  sixNine && card.type === "number" && card.value === 6 && "translate-x-[calc(10%+0.25rem)]",
                  sixNine && card.type === "number" && card.value === 9 && "-translate-x-[calc(10%+0.25rem)]",
                )} style={{ animationDelay: card.type === "number" && (card.value === 7 || (sixNine && card.value === 9)) ? "-1.2s" : undefined }}>
                <PlayingCard card={card} flipped={flipped && card.id !== resolvingCard?.card.id && (game.mode !== "vengeance" || player.bustedCards?.includes(card.id) !== false)} sideways={sideways && (card.id === numeric[0]?.id || card.id === modifiers[0]?.id)} fluid />
                </div>
                {!resolvingCardFinished && !flight && !movingCards && human && eligibleCards.includes(card.id) && <Button variant="ghost" aria-label={`Selecionar ${cardLabel(card)} de ${player.name}`} aria-pressed={selectedCards.includes(card.id)} className={cn("absolute inset-0 size-full rounded-2xl border hover:border-brand hover:bg-brand/10", selectedCards.includes(card.id) ? "border-brand bg-brand/10" : "border-transparent")} onClick={() => {
                  if (game.pending?.card.type === "swap") {
                    if (swapPreview) animateSwapPreview(swapPreview, true);
                    else if (selectedCards.includes(card.id)) setSelectedCards([]);
                    else if (selectedCards.length === 0) setSelectedCards([card.id]);
                    else animateSwapPreview([selectedCards[0], card.id]);
                  } else send({ type: "cards", cards: [card.id] });
                }}><span className="sr-only">Selecionar {cardLabel(card)} de {player.name}</span></Button>}
              </div>;
              return <section key={i} aria-label={`Mesa de ${player.name}`} className={cn(
                "relative min-h-48 min-w-0 rounded-panel bg-surface p-3 transition-shadow duration-300 ease-in-out motion-reduce:transition-none",
                visibleGame.phase === "playing" && activeSeat === i && "shadow-[0_0_0_2px_var(--color-brand)]",
                visiblePlayer.status !== "playing" && "opacity-50",
              )}>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-6" aria-hidden="true">
                      <AvatarImage src={tableParticipants.find(person => person.seat === i)?.avatarUrl ?? undefined} />
                      <AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
                    </Avatar>
                    <h3 className="min-w-0 truncate font-medium">{player.name}</h3>
                  </div>
                  {visiblePlayer.status !== "playing" && <span className="text-xs text-muted">{playerStatus[visiblePlayer.status]}</span>}
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums" title="Pontos nesta rodada">{score(visiblePlayer, visibleGame)} pts</span>
                </div>
                <div data-player-hand={i} style={{ "--hand-columns": columns, "--hand-remaining": columns - 1 } as CSSProperties} className={cn("space-y-2 [--hand-max:5rem] sm:[--hand-max:6rem]", sideways ? "[--hand-extra:0.6] [--hand-first:1.6fr] sm:[--hand-extra:0.5] sm:[--hand-first:1.5fr]" : "[--hand-extra:0]")}>
                  {modifiers.length > 0 && <div className={rowClass}>{modifiers.map(renderCard)}</div>}
                  <div className={rowClass}>{numeric.map(renderCard)}</div>
                </div>
                {!resolvingCardFinished && !flight && !movingCards && game.phase === "playing" && game.pending && human && validTargets.includes(i) && <Button variant="ghost" aria-label={game.pending.card.type === "steal" ? `${player.name} vai roubar` : game.pending.card.type === "remove" ? `${player.name} escolhe a carta para descartar` : `Escolher ${player.name}`} title={game.pending.card.type === "steal" ? `${player.name} receberá a carta roubada` : game.pending.card.type === "remove" ? `${player.name} poderá escolher uma carta de qualquer mão` : `Escolher ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-brand hover:bg-brand/10" onClick={() => send({ type: "target", target: i })}>{game.pending.card.type === "steal" ? <span>{player.name} vai roubar</span> : game.pending.card.type === "remove" ? <span>{player.name} escolhe o descarte</span> : <span className="sr-only">Escolher {player.name}</span>}</Button>}
                {!resolvingCardFinished && !flight && !movingCards && game.bonusChoice != null && human && <Button variant="ghost" aria-label={game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-brand hover:bg-brand/10" onClick={() => send({ type: "bonus", target: game.bonusChoice === i ? null : i })}><span className="sr-only">{game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`}</span></Button>}
              </section>;
            })}
          </div>
          </>}
        </div>
      </GameTableLayout>
      <Dialog open={game.phase === "over" && resultReady && !flight && !movingCards && !sceneAnimating && !exitOpen && !resultDismissed} onOpenChange={open => setResultDismissed(!open)}>
        <DialogContent className="max-h-[85dvh] w-[min(36rem,calc(100%-2rem))] overflow-y-auto" data-lenis-prevent onCloseAutoFocus={event => { event.preventDefault(); resultTriggerRef.current?.focus(); }}>
          <Flip7Result game={displayGame} match={replay?.metadata ?? matchInfo} leaving={leaving} onPlayAgain={() => matchUrl(null)} replayLoading={replayPending} onReplay={replay || ownSeat != null || (matchInfo?.development && matchInfo.hostId === userId && permissions.canManageSite) ? () => { if (replay) { setResultDismissed(true); replay.restart(); } else void onRequestReplay?.(); } : undefined} />
        </DialogContent>
      </Dialog>
      <Dialog open={exitOpen} onOpenChange={open => { if (!open) setExitOpen(false); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); exitTriggerRef.current?.focus(); }}>
          <DialogTitle>Sair da partida?</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted">Abandonar sozinho entrega sua vaga a um bot e a partida continua para os demais. {!matchInfo?.development && "O abandono coletivo exige a aprovação de todos que continuam, encerra a partida sem resultado e devolve todas as entradas, inclusive de quem já saiu."}{!!matchInfo?.entryAmount && " No abandono individual, sua entrada não será devolvida. Se esta vaga vencer, o prêmio irá para a casa."}</DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Continuar jogando</Button></DialogClose>
            {!matchInfo?.development && <Button variant="secondary" disabled={leaving || !!matchInfo?.cancellation} onClick={async()=>{const match=serverMatch.current;if(!match)return;setLeaving(true);try{await proposeCancellation(match);setExitOpen(false);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível propor o abandono coletivo.");}finally{setLeaving(false);}}}>Propor abandono coletivo</Button>}
            <Button variant="destructive" loading={leaving} disabled={leaving || busy} onClick={async () => {
              if (exitOpen && await leave()) {
                setExitOpen(false);
              }
            }}>Abandonar sozinho</Button>
          </div>
        </DialogContent>
      </Dialog>
      {movingCards?.map(m => <div key={m.card.id} data-moving-card={m.card.id} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-40"><PlayingCard card={m.card} /></div>)}
      {flight && <div ref={flyingRef} aria-hidden="true" data-flying-card className={cn("pointer-events-none absolute top-0 left-0 z-30", landed && "invisible")}><PlayingCard card={flight.card} /></div>}
    </Surface>
  );
}
