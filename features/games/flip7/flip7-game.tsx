"use client";

import { useCallback, useId, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, PanelRightClose, PanelRightOpen, PlayingCardsFan, Heart, Snowflake, Plus, Minus, Divide, ArrowLeftRight, Hand, Trash2, X, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as Surface } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { withDemoLock } from "@/lib/demo-storage";
import { AccountAvatarImage } from "@/features/auth/account-avatar-image";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { automaticAction, canStay, cardLabel, createGame, isNumber, modeLabel, score, targets, transition } from "./engine";
import type { Action, Card, Game, GameOptions, Setup } from "./engine";
import { cardChoices } from "./vengeance";
import { GOAL } from "./engine";
import { readSetupPreferences, saveSetupPreferences } from "./setup-storage";
import { matchStorageKey, currentMatch, matchUrl, readMatch, readMatches, saveMatch, type SavedMatch } from "./match-storage";
import { leaveLocalMatch, prepareWagerMatch, saveWagerProgress, startLocalMatch } from "./wager-storage";
import { wagerPayouts, type Wager } from "./wager";

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
      <p className="mt-5 text-xs text-muted">Com Croins, cada participante coloca a mesma entrada e os vencedores dividem o pote. A entrada dos bots é automática. Abandonar perde a entrada; recarregar mantém a partida. No modo livre, compartilhe o dispositivo.</p>
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
            {numeric && <span className="absolute top-1 right-1 size-1 rounded-full bg-(--card-color)" aria-hidden="true" />}
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
        <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden bg-flip-card-back [box-shadow:var(--inset-shadow-flip-card)] [backface-visibility:hidden] [transform:rotateY(180deg)]", compact ? "rounded-md" : "rounded-[18cqi]")}>
          <span className={cn("absolute flex items-center justify-center bg-flip-card-inset overflow-hidden", compact ? "inset-1 rounded-sm" : "inset-2.5 rounded-[12cqi]")}>
            <span className={cn("rotate-12 font-bold leading-none text-border", compact ? "text-2xl" : "text-[120cqi]")}>7</span>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}

function GameLog({ game }: { game: Game }) {
  return <ol className="space-y-3">{game.log.map((entry, i) => {
    const player = entry.player !== undefined ? game.players[entry.player] : null;
    return <li key={i} className="flex items-center gap-2 border-b border-contrast/6 pb-3 last:border-0">
      {player && <Avatar className="size-7" aria-hidden="true">{player.kind === "human" && <AccountAvatarImage name={player.name} />}<AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>}
      <span className="min-w-0 flex-1 break-words">{entry.message}</span>
      {entry.card && <PlayingCard card={entry.card} compact />}
    </li>;
  })}</ol>;
}

function ParticipantForm({ player, botsOnly, onSave, onRemove }: { player: Setup | null; botsOnly: boolean; onSave: (player: Setup) => void; onRemove: () => void }) {
  const [name, setName] = useState(player?.name ?? "");
  const [kind, setKind] = useState<"human" | "normal">(botsOnly ? "normal" : player?.kind === "human" || !player ? "human" : "normal");
  return <form className="mt-5 space-y-4" onSubmit={event => {
    event.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), kind });
  }}>
    <Field>Nome<Input value={name} onChange={event => setName(event.target.value)} maxLength={24} required autoComplete="off" /></Field>
    {!botsOnly && <Field>Tipo<Select value={kind} onChange={event => setKind(event.target.value as "human" | "normal")}><option value="human">Pessoa</option><option value="normal">Bot</option></Select></Field>}
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      {player && !botsOnly && <Button variant="ghost" className="mr-auto" onClick={onRemove}>Remover</Button>}
      <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
      <Button type="submit" disabled={!name.trim()}>{player ? "Salvar" : "Adicionar"}</Button>
    </div>
  </form>;
}

function ParticipantSlot({ index, player, botsOnly, onChange }: { index: number; player: Setup | null; botsOnly: boolean; onChange: (player: Setup | null) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="flex min-w-0 flex-col items-center gap-2">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("size-16 aspect-square overflow-hidden rounded-full! border border-dashed border-field-border p-0", player && "border-solid")} aria-label={player ? `Editar ${player.name}` : `Adicionar jogador ${index + 1}`}>
          {player ? <Avatar className="size-full" aria-hidden="true">{player.kind === "human" && <AccountAvatarImage name={player.name} />}<AvatarFallback className="text-lg">{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar> : <Plus className="size-6" aria-hidden="true" />}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{player ? "Editar jogador" : "Adicionar jogador"}</DialogTitle>
        <ParticipantForm player={player} botsOnly={botsOnly} onSave={value => { onChange(value); setOpen(false); }} onRemove={() => { onChange(null); setOpen(false); }} />
      </DialogContent>
    </Dialog>
    <span className={cn("w-full truncate text-center text-xs font-medium", !player && "text-muted")} title={player?.name}>{player?.name ?? "Disponível"}</span>
  </div>;
}

function SetupScreen({ onStart, initialError }: { onStart: (setup: Setup[], options: GameOptions, stake: number) => Promise<void>; initialError: string }) {
  const { username, balance, openLogin } = useDemoSession();
  const [matches, setMatches] = useState<SavedMatch[]>(() => {
    try { return readMatches(); } catch { return []; }
  });
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key !== matchStorageKey && event.key !== null) return;
      try { setMatches(readMatches()); } catch { /* Keep the configuration available. */ }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const pendingMatches = matches.filter(match => match.game.phase !== "over" && (!match.wager || match.wager.username.toLowerCase() === username?.toLowerCase()));
  const [withCroins, setWithCroins] = useState(false);
  const [stake, setStake] = useState("50");
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const amount = Number(stake);
  const [preferences] = useState(readSetupPreferences);
  const [count, setCount] = useState(preferences.count);
  const [options, setOptions] = useState<GameOptions>({ mode: preferences.mode, brutal: preferences.brutal });
  useEffect(() => {
    try { saveSetupPreferences({ count, ...options }); }
    catch { toast.error("Não foi possível salvar as configurações do Flip7.", { id: "flip7-setup-storage" }); }
  }, [count, options]);
  const [opponents, setOpponents] = useState<(Setup | null)[]>(Array(11).fill(null));
  const selected = opponents.slice(0, count - 1).map((player, i) => withCroins ? { name: player?.name ?? `Bot ${i + 1}`, kind: "normal" as const } : player);
  const ready = selected.every(player => player !== null);
  const validStake = !withCroins || (Number.isSafeInteger(amount) && amount > 0 && Number.isSafeInteger(amount * count));
  const insufficient = withCroins && validStake && !!username && amount > balance;
  return (
    <div className="mx-auto grid w-full max-w-5xl items-start gap-6 py-6 sm:py-12 lg:grid-cols-2">
      <Surface asChild>
        <section aria-label="Opções da partida">
          <fieldset disabled={starting} className="min-w-0 space-y-4">
            <Field className="min-w-0 items-center gap-2 text-base sm:grid-cols-[1fr_auto] sm:gap-4">
              Versão
              <Select aria-label="Versão do Flip7" value={options.mode} onChange={event => setOptions(previous => ({ ...previous, mode: event.target.value as GameOptions["mode"] }))}>
                <option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option>
              </Select>
            </Field>
            {options.mode === "vengeance" && <Field className="min-w-0 grid-cols-[1fr_auto] items-center gap-4 text-sm">
              Modo Brutal
              <Switch aria-label="Modo Brutal" checked={options.brutal} onCheckedChange={brutal => setOptions(previous => ({ ...previous, brutal }))} />
            </Field>}
            <Surface className="bg-background p-4 sm:p-4">
              <Field className="grid-cols-[1fr_auto] items-center gap-4 text-base">
                Jogar com Croins
                <Switch checked={withCroins} onCheckedChange={setWithCroins} />
              </Field>
              {withCroins && <div className="mt-4 space-y-3">
                <Field>Entrada por jogador<Input type="number" inputMode="numeric" min={1} step={1} value={stake} onChange={event => setStake(event.target.value)} aria-invalid={!validStake || insufficient} /></Field>
                <dl className="text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-muted">Pote total</dt><dd className="font-semibold text-brand tabular-nums">{validStake ? formatBalance.format(amount * count) : "—"} Croins</dd></div>
                </dl>
                {(!validStake || insufficient) && <p role="alert" className="text-sm text-destructive">{insufficient ? "Saldo insuficiente para pagar a entrada." : "Informe uma entrada inteira maior que zero."}</p>}
              </div>}
            </Surface>
            <Rules options={options} />
          </fieldset>
        </section>
      </Surface>
      <Surface asChild>
        <section aria-label="Jogadores da partida">
          <fieldset disabled={starting} className="flex min-w-0 flex-col gap-6">
            <Field className="min-w-0 items-center gap-2 text-base sm:grid-cols-[1fr_auto] sm:gap-4">
              Número de jogadores
              <Select aria-label="Número de jogadores" value={count} onChange={event => setCount(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, i) => i + 2).map(value => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5" aria-label="Lugares da partida">
              <div className="flex min-w-0 flex-col items-center gap-2">
                <Avatar className="size-16" aria-hidden="true">{username && <AccountAvatarImage name={username} />}<AvatarFallback className="text-lg">{username ? Array.from(username)[0]?.toLocaleUpperCase("pt-BR") : <UserRound className="size-6" />}</AvatarFallback></Avatar>
                <span className="w-full truncate text-center text-xs font-medium text-brand" title={username ?? "Sua conta"}>{username ?? "Sua conta"}</span>
              </div>
              {selected.map((player, i) => <ParticipantSlot key={`${i}-${withCroins}`} index={i + 1} player={player} botsOnly={withCroins} onChange={value => setOpponents(previous => previous.map((entry, j) => i === j ? value : entry))} />)}
            </div>
            <Button className="mt-auto w-full" loading={starting} disabled={starting || (!!username && (!ready || !validStake || insufficient))} onClick={async () => {
              if (!username) openLogin();
              else if (ready && validStake && !insufficient && !startingRef.current) {
                startingRef.current = true;
                setStarting(true);
                try { await onStart([{ name: username, kind: "human" }, ...selected.filter((player): player is Setup => player !== null)], options, withCroins ? amount : 0); }
                finally { startingRef.current = false; setStarting(false); }
              }
            }}>{username ? withCroins && validStake ? `Pagar ${formatBalance.format(amount)} Croins e jogar` : "Começar partida" : "Entrar para jogar"}</Button>
          </fieldset>
        </section>
      </Surface>
      {initialError && <p role="alert" className="text-sm text-destructive lg:col-span-2">{initialError}</p>}
      {pendingMatches.length > 0 && <aside className="min-w-0 lg:col-span-2" aria-label="Partidas em andamento">
        <Heading variant="section">Partidas em andamento</Heading>
        <ul className="mt-5 grid gap-4 xl:grid-cols-2">
          {pendingMatches.map(match => <Surface asChild key={match.code} className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
            <li>
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold">{modeLabel(match.game)}</h3>
                <Badge variant="secondary" className="shrink-0 font-medium">Rodada {match.game.round}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center -space-x-2" aria-label="Participantes">
                  {match.game.players.slice(0, 5).map((player, index) => <Avatar key={index} className="size-10 shadow-[0_0_0_0.125rem_var(--color-surface)]" role="img" aria-label={player.name} title={player.name}>
                    {player.kind === "human" && <AccountAvatarImage name={player.name} />}
                    <AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
                  </Avatar>)}
                  {match.game.players.length > 5 && <Avatar className="size-10 shadow-[0_0_0_0.125rem_var(--color-surface)]" role="img" aria-label={match.game.players.slice(5).map(player => player.name).join(", ")} title={match.game.players.slice(5).map(player => player.name).join(", ")}>
                    <AvatarFallback>+{match.game.players.length - 5}</AvatarFallback>
                  </Avatar>}
                </div>
                <span className="text-xs text-muted">{match.game.players.length} jogadores</span>
              </div>
              <Button variant="secondary" size="sm" className="mt-auto w-full" onClick={() => matchUrl(match.code)}>Continuar partida</Button>
            </li>
          </Surface>)}
        </ul>
      </aside>}

    </div>
  );
}

type CardMovement = { card: Card; target: number | null; origin: { left: number; top: number; width: number } };

export default function Flip7Game() {
  const code = useSearchParams().get("partida");
  return <Flip7Table key={code ?? "setup"} code={code} />;
}

function Flip7Table({ code }: { code: string | null }) {
  const { username, sessionReady, openLogin } = useDemoSession();
  const [exitOpen, setExitOpen] = useState(false);
  const exitTriggerRef = useRef<HTMLElement | null>(null);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const resultTriggerRef = useRef<HTMLButtonElement>(null);
  const [restored] = useState(() => code ? currentMatch(code) : { match: null, error: "" });
  const [game, setGame] = useState<Game | null>(restored.match?.game ?? null);
  const [matchCode, setMatchCode] = useState<string | null>(restored.match?.code ?? null);
  const [wager, setWager] = useState<Wager | undefined>(restored.match?.wager);
  const [payment, setPayment] = useState<{ code: string; phase: Game["phase"] } | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const [externalChange, setExternalChange] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const ownsWager = !wager || wager.username.toLowerCase() === username?.toLowerCase();
  const wagerReady = !wager || (ownsWager && payment?.code === matchCode && (game?.phase !== "over" || payment.phase === "over") && !paymentError && !externalChange);
  const matchCodeRef = useRef(matchCode);
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
    if (!wager) return;
    const changed = (event: StorageEvent) => {
      if (event.key !== matchStorageKey && event.key !== null) return;
      try {
        const saved = readMatch(window.localStorage, matchCode ?? undefined);
        if (!saved || JSON.stringify(saved.game) !== JSON.stringify(gameRef.current) || JSON.stringify(saved.wager) !== JSON.stringify(wager)) setExternalChange(true);
      } catch { setExternalChange(true); }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [wager, matchCode]);
  useEffect(() => {
    if (!wager || !matchCode || !sessionReady || !ownsWager) return;
    let cancelled = false;
    const phase = game?.phase;
    if (!phase) return;
    prepareWagerMatch(matchCode).then(() => {
      if (!cancelled) { setPayment({ code: matchCode, phase }); setPaymentError(""); }
    }).catch(error => {
      if (!cancelled) setPaymentError(error instanceof Error ? error.message : "Não foi possível confirmar a aposta.");
    });
    return () => { cancelled = true; };
  }, [wager, matchCode, game?.phase, sessionReady, ownsWager, paymentAttempt]);
  useEffect(() => {
    if (game?.phase !== "over" || flight || movingCards) return;
    const timeout = window.setTimeout(() => setResultReady(true), 1500);
    return () => window.clearTimeout(timeout);
  }, [game?.phase, flight, movingCards]);
  useEffect(() => {
    if (matchCode) matchUrl(matchCode);
  }, [matchCode]);
  useEffect(() => {
    if (!restored.match) return;
    const previous = restored.match.game;
    try { saveSetupPreferences({ count: previous.players.length, mode: previous.mode, brutal: previous.mode === "vengeance" ? previous.brutal : readSetupPreferences().brutal }); }
    catch { toast.error("Não foi possível salvar as configurações do Flip7.", { id: "flip7-setup-storage" }); }
  }, [restored]);
  const persist = useCallback(async (next: Game, code: string) => {
    try {
      await withDemoLock(() => {
        const saved = readMatch(window.localStorage, code);
        if (saved?.code !== code || saved.wager) throw new Error("A partida mudou em outra aba.");
        saveMatch({ version: 1, code, game: next });
      });
      saveErrorShown.current = false;
    } catch {
      if (!saveErrorShown.current) toast.error("Não foi possível salvar a partida. O progresso atual pode ser perdido ao sair.");
      saveErrorShown.current = true;
    }
  }, []);
  const openMatch = (match: SavedMatch) => {
    matchCodeRef.current = match.code;
    gameRef.current = match.game;
    matchUrl(match.code);
    setMatchCode(match.code);
    setWager(match.wager);
    setPayment(null);
    setPaymentError("");
    setExternalChange(false);
    setGame(match.game);
  };
  const send = useCallback(async (action: Action) => {
    const current = gameRef.current;
    if (!current || locked.current || !wagerReady || leavingRef.current) return;
    const next = transition(current, action);
    if (next === current) return;
    if (wager && matchCodeRef.current) {
      locked.current = true;
      try { await saveWagerProgress(matchCodeRef.current, current, next); }
      catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível salvar a jogada. Tente novamente.";
        toast.error(message);
        setPaymentError(message);
        return;
      } finally { locked.current = false; }
    }
    if (!wager && matchCodeRef.current) {
      locked.current = true;
      try { await persist(next, matchCodeRef.current); }
      finally { locked.current = false; }
    }
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
    gameRef.current = next;
    setGame(next);
  }, [persist, swapPreview, wager, wagerReady]);
  const leave = async () => {
    if (!matchCodeRef.current || leavingRef.current || locked.current) return false;
    leavingRef.current = true;
    setLeaving(true);
    try { await leaveLocalMatch(matchCodeRef.current); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abandonar a partida. Tente novamente."); return false; }
    finally { leavingRef.current = false; setLeaving(false); }
    gameRef.current = null;
    locked.current = false;
    setFlight(null);
    setMovingCards(null);
    setSwapPreview(null);
    setSelectedCards([]);
    setGame(null);
    setResultDismissed(false);
    setResultReady(false);
    setMatchCode(null);
    setWager(undefined);
    setPayment(null);
    setPaymentError("");
    setExternalChange(false);
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
          .to(discarded, { y: reduced ? 0 : -128, x: reduced ? 0 : 96, rotation: reduced ? 0 : 18, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.32, ease: "power2.in" });
      }
    }
    if (flight.discardedCards?.length || flight.discardAfter) {
      const discarded = [...(flight.discardedCards ?? []).flatMap(card => {
        const element = board.querySelector<HTMLElement>(`[data-flight-card="${card.id}"]`);
        return element ? [element] : [];
      }), ...(flight.discardAfter ? [destination] : [])];
      timeline.set(ghost, { autoAlpha: 0 }).set(destination, { visibility: "visible" })
        .to(discarded, { y: reduced ? 0 : -128, x: reduced ? 0 : 96, rotation: reduced ? 0 : 18, opacity: 0, scale: reduced ? 1 : 0.8, duration: reduced ? 0 : 0.35, ease: "power2.in" });
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
        { x: movement.target === null ? movement.origin.left + (reduced ? 0 : 96) : rect.left, y: movement.target === null ? movement.origin.top - (reduced ? 0 : 128) : rect.top, scale: movement.target === null ? movement.origin.width / ghost.offsetWidth * (reduced ? 1 : 0.8) : rect.width / ghost.offsetWidth, rotation: movement.target === null && !reduced ? 18 : 0, opacity: movement.target === null ? 0 : 1, duration: reduced ? 0 : 0.35, ease: "power2.inOut" }, 0);
    }
    return () => { timeline.kill(); };
  }, [movingCards]);

  useEffect(() => {
    if (!game || flight || movingCards || exitOpen || game.phase === "over" || !wagerReady || leaving) return;
    const action: Action | null = game.phase === "summary" ? { type: "next" } : automaticAction(game);
    if (!action) return;
    const initial = action.type === "draw" && !game.players[game.turn].hasDrawn;
    const timer = setTimeout(() => send(action), game.phase === "summary" ? 1600 : initial ? 60 : game.forced ? 100 : 220);
    return () => clearTimeout(timer);
  }, [game, flight, movingCards, exitOpen, send, wagerReady, leaving]);

  if (!game) return <SetupScreen initialError={restored.error} onStart={async (setup, options, stake) => {
    const next = createGame(setup, Math.floor(Math.random() * 4294967296), options);
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const match: SavedMatch = { version: 1, code, game: next, ...(stake ? { wager: { username: setup[0].name, stake } } : {}) };
    try { openMatch(await startLocalMatch(match)); }
    catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a partida.");
      // A failed wallet write leaves the saved intent available for retry, without a second entry.
      try { const saved = readMatch(window.localStorage, code); if (saved?.code === code) openMatch(saved); } catch { /* The setup remains available. */ }
    }
  }} />;
  if (wager && externalChange) return <Surface className="mx-auto max-w-xl space-y-4"><h2 className="font-semibold">Partida atualizada em outra aba</h2><p className="text-sm text-muted">Recarregue para continuar do último estado salvo.</p><Button onClick={() => window.location.reload()}>Recarregar partida</Button></Surface>;
  if (wager && (!ownsWager || !wagerReady) && game.phase !== "over") return <Surface className="mx-auto max-w-xl space-y-4">
    <h2 className="font-semibold">Partida com Croins</h2>
    <p role={paymentError ? "alert" : "status"} className="text-sm text-muted">{!ownsWager ? `Entre como ${wager.username} para retomar esta partida.` : paymentError || "Confirmando sua entrada…"}</p>
    {!username && <Button onClick={openLogin}>Entrar para continuar</Button>}
    {ownsWager && paymentError && <div className="flex flex-wrap gap-2"><Button onClick={() => setPaymentAttempt(value => value + 1)}>Tentar novamente</Button><Button variant="secondary" onClick={() => window.location.reload()}>Recarregar partida</Button><Button variant="secondary" loading={leaving} onClick={() => setExitOpen(true)}>Abandonar partida</Button></div>}
    <Dialog open={exitOpen} onOpenChange={open => { if (!open) setExitOpen(false); }}><DialogContent><DialogTitle>Abandonar partida?</DialogTitle><DialogDescription>A entrada de {formatBalance.format(wager.stake)} Croins não será devolvida se já tiver sido paga.</DialogDescription><div className="mt-6 flex justify-end gap-2"><DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose><Button variant="destructive" loading={leaving} onClick={async () => { if (await leave()) setExitOpen(false); }}>Abandonar partida</Button></div></DialogContent></Dialog>
  </Surface>;
  const visibleGame = ((flight && !landed) || movingCards) ? presentationBefore ?? game : game;
  const current = game.players[game.turn];
  const actor = game.players[game.bonusChoice ?? game.pending?.source ?? game.turn];
  const human = actor.kind === "human";
  const automaticZero = game.mode === "vengeance" && current.cards.some(card => card.type === "zero");
  const playable = !automaticZero && !flight && !movingCards && game.phase === "playing" && !game.pending && !game.forced && game.bonusChoice == null && human && current.hasDrawn;
  const validTargets = targets(game);
  const maxScore = Math.max(...game.players.map(player => player.total));
  const winners = game.players.filter(player => player.total === maxScore);
  const standings = [...game.players].sort((a, b) => b.total - a.total);
  const payouts = wager && game.phase === "over" ? wagerPayouts(game, wager.stake) : null;
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
    <Surface ref={boardRef} className="relative @container bg-transparent p-0 sm:p-0" role="region" aria-label="Mesa de Flip7">
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4" data-flip7-controls>
        <div className="pointer-events-auto flex w-fit max-w-[calc(100vw-8rem)] flex-wrap items-center justify-center gap-3 rounded-panel border border-contrast/6 bg-surface/95 p-3 shadow-lg backdrop-blur-md sm:gap-4">
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
          {game.phase === "over" && !flight && !movingCards && <Button ref={resultTriggerRef} onClick={() => { setResultReady(true); setResultDismissed(false); }}>Ver resultado</Button>}
        </div>
      </div>
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30">
        <Button variant="secondary" size="icon" className="rounded-full border border-contrast/6 shadow-sm" aria-label={historyVisible ? "Esconder histórico" : "Mostrar histórico"} title={historyVisible ? "Esconder histórico" : "Mostrar histórico"} aria-expanded={historyVisible} aria-controls="flip7-history" disabled={!!flight || !!movingCards} onClick={() => setHistoryVisible(visible => !visible)}>
          {historyVisible ? <PanelRightClose className="size-4" aria-hidden="true" /> : <PanelRightOpen className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      <div className={cn("grid items-start transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none", historyVisible ? "gap-6 @[60rem]:grid-cols-[minmax(0,1fr)_14rem]" : "gap-0 @[60rem]:grid-cols-[minmax(0,1fr)_0rem]")}>
        <div className="min-w-0 pb-32 sm:pb-24">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{modeLabel(game)}</Badge>
            {wager && <span className="text-sm text-muted">Pote <strong className="font-semibold text-brand tabular-nums">{formatBalance.format(wager.stake * game.players.length)} Croins</strong></span>}
            {game.phase !== "over" && <Button size="sm" variant="ghost" className="ml-auto" aria-label="Abandonar partida" disabled={!!flight || !!movingCards || leaving} onClick={event => { exitTriggerRef.current = event.currentTarget; setExitOpen(true); }}>Abandonar</Button>}
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex max-w-full flex-wrap gap-2" aria-label="Baralho e ações pendentes">
              <div ref={deckRef} className="relative @container z-10 h-32 w-20 overflow-hidden rounded-2xl bg-flip-card font-sans shadow-md after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:[box-shadow:var(--inset-shadow-flip-card)] sm:h-36 sm:w-24" aria-label={`${game.deck.length} cartas no baralho`}>
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
                <Avatar className={cn("size-14 transition-shadow duration-300 ease-in-out motion-reduce:transition-none", visibleGame.phase === "playing" && activeSeat === i && "shadow-[0_0_0_2px_var(--color-brand)]")} aria-hidden="true">
                  {player.kind === "human" && <AccountAvatarImage name={player.name} />}
                  <AvatarFallback className="text-sm">
                    {Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={cn("truncate text-sm font-medium", visibleGame.phase === "playing" && activeSeat === i && "text-brand")}>{player.name}</p>
                    <Badge variant={player.status === "playing" ? "default" : "secondary"} className="shrink-0 px-2 py-0.5 font-medium">{playerStatus[player.status]}</Badge>
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="text-xl font-semibold text-foreground tabular-nums" title="Pontos garantidos">{player.total}</span>
                    <span className="tabular-nums" title="Total incluindo a rodada em andamento"><span className="font-medium text-brand">{player.total + (visibleGame.phase === "playing" ? score(player, visibleGame) : 0)}</span> ao vivo</span>
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
              const sideways = game.mode === "vengeance" && visiblePlayer.status === "stayed";
              const columns = Math.max(numeric.length, modifiers.length, 1);
              const rowClass = cn("grid items-center max-w-[calc((var(--hand-columns)+var(--hand-extra))*var(--hand-max)+(var(--hand-columns)-1)*0.5rem)] gap-2",
                columns === 1 ? "grid-cols-1" : sideways
                  ? "grid-cols-[minmax(0,var(--hand-first))_repeat(var(--hand-remaining),minmax(0,1fr))]"
                  : "grid-cols-[repeat(var(--hand-columns),minmax(0,1fr))]");
              const flipped = visiblePlayer.status === "busted" && !movingCards?.some(m => m.target === i) && (!flight || flight.target !== i || landed);
              const renderCard = (card: Card) => <div key={card.id} data-flight-card={card.id} data-hand-card={card.id}
                className={cn("relative min-w-0", ((flight?.card.id === card.id && !landed) || movingCards?.some(m => m.card.id === card.id)) && "invisible")}>
                <PlayingCard card={card} flipped={flipped && (game.mode !== "vengeance" || player.bustedCards?.includes(card.id) !== false)} sideways={sideways && (card.id === numeric[0]?.id || card.id === modifiers[0]?.id)} fluid />
                {!flight && !movingCards && human && eligibleCards.includes(card.id) && <Button variant="ghost" aria-label={`Selecionar ${cardLabel(card)} de ${player.name}`} aria-pressed={selectedCards.includes(card.id)} className={cn("absolute inset-0 size-full rounded-2xl border hover:border-brand hover:bg-brand/10", selectedCards.includes(card.id) ? "border-brand bg-brand/10" : "border-transparent")} onClick={() => {
                  if (game.pending?.card.type === "swap") {
                    if (swapPreview) animateSwapPreview(swapPreview, true);
                    else if (selectedCards.includes(card.id)) setSelectedCards([]);
                    else if (selectedCards.length === 0) setSelectedCards([card.id]);
                    else animateSwapPreview([selectedCards[0], card.id]);
                  } else send({ type: "cards", cards: [card.id] });
                }}><span className="sr-only">Selecionar {cardLabel(card)} de {player.name}</span></Button>}
              </div>;
              return <section key={i} aria-label={`Mesa de ${player.name}`} className={cn(
                "relative min-h-48 min-w-0 rounded-panel bg-contrast/6 p-3 transition-shadow duration-300 ease-in-out motion-reduce:transition-none",
                visibleGame.phase === "playing" && activeSeat === i && "shadow-[0_0_0_2px_var(--color-brand)]",
                visiblePlayer.status !== "playing" && "opacity-50",
              )}>
                <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                  <h3 className="min-w-0 truncate font-medium">{player.name}</h3>
                  {visiblePlayer.status !== "playing" && <span className="text-xs text-muted">{playerStatus[visiblePlayer.status]}</span>}
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums" title="Pontos nesta rodada">{score(visiblePlayer, visibleGame)} pts</span>
                </div>
                <div data-player-hand={i} style={{ "--hand-columns": columns, "--hand-remaining": columns - 1 } as CSSProperties} className={cn("space-y-2 [--hand-max:5rem] sm:[--hand-max:6rem]", sideways ? "[--hand-extra:0.6] [--hand-first:1.6fr] sm:[--hand-extra:0.5] sm:[--hand-first:1.5fr]" : "[--hand-extra:0]")}>
                  {modifiers.length > 0 && <div className={rowClass}>{modifiers.map(renderCard)}</div>}
                  <div className={rowClass}>{numeric.map(renderCard)}</div>
                </div>
                {!flight && !movingCards && game.phase === "playing" && game.pending && human && validTargets.includes(i) && <Button variant="ghost" aria-label={game.pending.card.type === "steal" ? `${player.name} vai roubar` : game.pending.card.type === "remove" ? `${player.name} escolhe a carta para descartar` : `Escolher ${player.name}`} title={game.pending.card.type === "steal" ? `${player.name} receberá a carta roubada` : game.pending.card.type === "remove" ? `${player.name} poderá escolher uma carta de qualquer mão` : `Escolher ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-brand hover:bg-brand/10" onClick={() => send({ type: "target", target: i })}>{game.pending.card.type === "steal" ? <span>{player.name} vai roubar</span> : game.pending.card.type === "remove" ? <span>{player.name} escolhe o descarte</span> : <span className="sr-only">Escolher {player.name}</span>}</Button>}
                {!flight && !movingCards && game.bonusChoice != null && human && <Button variant="ghost" aria-label={game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`} className="absolute inset-0 size-full rounded-panel border border-field-border hover:border-brand hover:bg-brand/10" onClick={() => send({ type: "bonus", target: game.bonusChoice === i ? null : i })}><span className="sr-only">{game.bonusChoice === i ? `Ganhar 15 pontos para ${player.name}` : `Tirar 15 pontos de ${player.name}`}</span></Button>}
              </section>;
            })}
          </div>
        </div>
        <div className={cn("grid min-w-0 overflow-clip transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:self-stretch", historyVisible ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <aside id="flip7-history" inert={!historyVisible} aria-hidden={!historyVisible} className={cn("min-h-0 min-w-0 overflow-hidden transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:sticky @[60rem]:top-[calc(var(--header-height)+1rem)] @[60rem]:w-56 @[60rem]:self-start", !historyVisible && "invisible translate-x-full")} aria-label="Histórico da partida">
            {/* Reserve a 1rem gap above and below the panel; padding scrolls with its content. */}
            <div className="max-h-[max(0rem,calc(100dvh-var(--header-height)-2rem))] overflow-y-auto rounded-panel bg-surface p-4 text-xs leading-relaxed text-muted" data-lenis-prevent>
              <GameLog game={visibleGame} />
            </div>
          </aside>
        </div>
      </div>
      <Dialog open={game.phase === "over" && resultReady && !flight && !movingCards && !exitOpen && !resultDismissed} onOpenChange={open => setResultDismissed(!open)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto" data-lenis-prevent onCloseAutoFocus={event => { event.preventDefault(); resultTriggerRef.current?.focus(); }}>
          <DialogTitle>Resultado da partida</DialogTitle>
          <DialogDescription className="mt-3 text-lg font-semibold text-brand">
            {winners.map(player => player.name).join(" e ")} {winners.length > 1 ? "venceram" : "venceu"}!
          </DialogDescription>
          {wager && payouts && <div className="mt-4 space-y-3 rounded-lg bg-contrast/6 p-4 text-sm" aria-label="Resultado em Croins">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-muted">Sua entrada</dt><dd className="font-medium tabular-nums">{formatBalance.format(wager.stake)} Croins</dd></div>
              <div><dt className="text-muted">Pote total</dt><dd className="font-medium tabular-nums">{formatBalance.format(wager.stake * game.players.length)} Croins</dd></div>
              <div><dt className="text-muted">Seu prêmio</dt><dd className="font-medium tabular-nums">{formatBalance.format(payouts[0])} Croins</dd></div>
              <div><dt className="text-muted">Seu resultado</dt><dd className={cn("font-semibold tabular-nums", payouts[0] > wager.stake ? "text-brand" : "text-muted")}>{payouts[0] > wager.stake ? "+" : ""}{formatBalance.format(payouts[0] - wager.stake)} Croins</dd></div>
            </dl>
            {!wagerReady && <p role={paymentError ? "alert" : "status"} className="text-muted">{!ownsWager ? `Entre como ${wager.username} para concluir a partida.` : paymentError || "Confirmando o resultado em Croins…"}</p>}
            {!username && <Button size="sm" onClick={openLogin}>Entrar para continuar</Button>}
            {ownsWager && paymentError && <Button size="sm" onClick={() => setPaymentAttempt(value => value + 1)}>Tentar pagamento novamente</Button>}
            {wagerReady && payouts[0] > 0 && <p role="status" className="text-muted">Prêmio creditado no seu saldo.</p>}
          </div>}
          <ol aria-label="Classificação final" className="mt-5 max-h-[50dvh] space-y-2 overflow-y-auto" data-lenis-prevent>
            {standings.map((player, index) => <li key={index} className={cn("flex min-w-0 items-center gap-3 rounded-lg bg-contrast/6 p-3 text-sm", player.total === maxScore && "bg-selected")}>
              <span className="w-6 shrink-0 text-muted tabular-nums">{standings.findIndex(p => p.total === player.total) + 1}º</span>
              <span className="min-w-0 flex-1 break-words font-medium">{player.name}</span>
              {payouts && payouts[game.players.indexOf(player)] > 0 && <span className="text-xs font-medium text-brand tabular-nums">{formatBalance.format(payouts[game.players.indexOf(player)])} Croins</span>}
              <span className="shrink-0 font-semibold tabular-nums">{player.total} pts</span>
            </li>)}
          </ol>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Fechar</Button></DialogClose>
            <Button disabled={!wagerReady || leaving} onClick={() => matchUrl(null)}>Jogar novamente</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={exitOpen} onOpenChange={open => { if (!open) setExitOpen(false); }}>
        <DialogContent onCloseAutoFocus={event => { event.preventDefault(); exitTriggerRef.current?.focus(); }}>
          <DialogTitle>Abandonar partida?</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-muted">{wager && game.phase !== "over" ? `A partida será encerrada e sua entrada de ${formatBalance.format(wager.stake)} Croins não será devolvida.` : "A partida será encerrada e o progresso será perdido."}</DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Continuar jogando</Button></DialogClose>
            <Button variant="destructive" loading={leaving} disabled={leaving || !ownsWager} onClick={async () => {
              if (exitOpen && await leave()) {
                setExitOpen(false);
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
