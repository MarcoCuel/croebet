"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { matchReplaySchema } from "@croebet/shared";
import { ReplayControls } from "@/features/games/replay-controls";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayingCard } from "@/features/games/flip7/flip7-game";
import { MatchBadges, MatchPlayerAvatar, MatchPlayerIdentity } from "./admin-match-summary";
import { Badge } from "@/components/ui/badge";
import { CroinIcon } from "@/components/shared/croin-icon";
import { ChevronLeft } from "lucide-react";
const replayDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
async function readReplayPage(path: string) {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Entre novamente para rever a partida." : response.status === 404 ? "Partida não encontrada." : "Não foi possível carregar as jogadas.");
  return matchReplaySchema.parse(await response.json());
}
type Replay = ReturnType<typeof matchReplaySchema.parse>;
export function AdminMatchReplay({ initial }: { initial: Replay }) {
  const replayPath = `/admin/games/${initial.match.gameId}/matches/${initial.match.id}`;
  const [page,setPage]=useState(initial);
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [delay,setDelay]=useState(1000);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const requestedOffset=Math.floor(index/100)*100;
  const visiblePage=requestedOffset===initial.offset?initial:page;
  const loading=visiblePage.offset!==requestedOffset;
  const frame=visiblePage.frames[index-visiblePage.offset];
  useEffect(()=>{
    if(requestedOffset===initial.offset) return;
    let active=true;
    readReplayPage(`${replayPath}?offset=${requestedOffset}&limit=100`)
      .then(value=>{if(active){setPage(value);setError("");}}).catch(reason=>{if(active){setPlaying(false);setError(reason instanceof Error?reason.message:"Não foi possível carregar as jogadas.");}});
    return ()=>{active=false;};
  },[initial,requestedOffset,retry,replayPath]);
  useEffect(()=>{
    if(!playing||loading||!frame)return;
    if(index>=initial.match.frameCount-1)return;
    const timer=setTimeout(()=>setIndex(value=>value+1),delay);
    return ()=>clearTimeout(timer);
  },[playing,loading,frame,index,delay,initial.match.frameCount]);
  function seek(value:number) {setPlaying(false);setError("");setIndex(value);}
  const match = initial.match;
  const rankedPlayers = [...match.players].sort((a, b) => b.score - a.score);
  return <div className="grid min-w-0 gap-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-2"><h1 className="text-xl font-semibold">Partida <span className="font-mono">{match.code}</span></h1><MatchBadges match={match} /><p className="text-xs text-muted">{replayDate(match.startedAt)} · {match.players.length} participantes · Regras v{match.rulesVersion}</p></div>
      <Button asChild variant="secondary" size="sm"><Link href={`/admin/jogos/${match.gameId}`}><ChevronLeft className="size-4" aria-hidden="true" />Voltar ao jogo</Link></Button>
    </div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid min-w-0 gap-4">
        <Card className="grid gap-4">
          <h2 className="font-semibold">Reprodução</h2>
          <ReplayControls index={index} count={match.frameCount} playing={playing && index < match.frameCount - 1} delay={delay} loading={loading} error={error} seek={seek} toggle={() => setPlaying(value => !value)} setDelay={setDelay} />
        </Card>
        {error ? <Card role="alert" className="grid justify-items-start gap-3 text-sm">{error}<Button variant="secondary" size="sm" onClick={() => { setError(""); setRetry(value => value + 1); }}>Tentar novamente</Button></Card> : loading || !frame ? <Card role="status" className="text-sm text-muted">Carregando jogadas…</Card> : <>
          <Card className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Rodada {frame.state.round}</h2><Badge variant="secondary">{frame.state.phase === "over" ? "Fim da partida" : frame.state.phase === "summary" ? "Fim da rodada" : `Vez de ${frame.state.players[frame.state.turn].name}`}</Badge></div>
            <div className="divide-y divide-contrast/6">{frame.state.players.map((player, seat) => {
              const identity = match.players.find(person => person.seat === seat) ?? { name: player.name, avatarUrl: null };
              return <div key={seat} className="grid gap-3 py-4 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><MatchPlayerAvatar player={identity} className="size-10" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{identity.name}</p><p className="text-xs text-muted tabular-nums">{player.total} pontos</p></div>{player.kind !== "human" && <Badge variant="secondary">Bot</Badge>}</div>
                  <Badge variant="secondary" className={player.status === "busted" ? "bg-prediction-no/10 text-prediction-no" : undefined}>{{ playing: "Ativo", stayed: "Parou", frozen: "Congelado", busted: "Estourou" }[player.status]}</Badge>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 sm:pl-13">{player.cards.map(card => <PlayingCard key={card.id} card={card} compact flipped={player.status === "busted"} />)}{!player.cards.length && <p className="text-xs text-muted">Sem cartas nesta rodada.</p>}</div>
              </div>;
            })}</div>
          </Card>
          <Card><h2 className="font-semibold">Histórico da jogada</h2><ul className="mt-3 divide-y divide-contrast/6 text-sm text-muted">{frame.state.log.slice(0, 8).map((entry, index) => <li className="py-2 first:pt-0 last:pb-0" key={index}>{entry.message}</li>)}</ul></Card>
        </>}
      </div>
      <aside className="grid min-w-0 gap-4 xl:sticky xl:top-[var(--header-height)]" aria-label="Resumo da partida">
        <Card><h2 className="font-semibold">{match.status === "finished" ? "Resultado" : "Pontuação registrada"}</h2><div className="mt-4 divide-y divide-contrast/6">{rankedPlayers.map(player => <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={player.seat}><MatchPlayerIdentity player={player} /><span className="shrink-0 text-sm font-semibold tabular-nums">{player.score}<span className="ml-1 text-xs font-normal text-muted">pts</span></span></div>)}</div></Card>
        {match.entryAmount > 0 && <Card className="grid gap-4"><h2 className="font-semibold">Croins da partida</h2><dl className="grid gap-3 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-muted">Entrada</dt><dd className="flex items-center gap-1.5 font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />{match.entryAmount.toLocaleString("pt-BR")}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-muted">Pote</dt><dd className="flex items-center gap-1.5 font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />{match.potTotal.toLocaleString("pt-BR")}</dd></div></dl><Badge variant="secondary">{{ pending: "Prêmio pendente", paid: "Pote distribuído", refunded: "Entradas devolvidas" }[match.settlement ?? "pending"]}</Badge>{match.payouts.length > 0 && <div className="grid gap-2 border-t border-contrast/6 pt-3">{match.payouts.map(payout => <div key={payout.seat} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 text-muted">{match.players.find(player => player.seat === payout.seat)?.name}{payout.house ? " · Casa (vaga com bot)" : ""}</span><span className="flex shrink-0 items-center gap-1.5 font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]" />{payout.amount.toLocaleString("pt-BR")}</span></div>)}</div>}</Card>}
        <p className="px-1 text-xs leading-relaxed text-muted">As jogadas confirmadas são exibidas em modo de reprodução. Os controles alteram apenas esta visualização.</p>
      </aside>
    </div>
  </div>;
}
