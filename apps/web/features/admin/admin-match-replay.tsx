"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { matchReplaySchema } from "@croebet/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayingCard } from "@/features/games/flip7/flip7-game";
import { managementRequest } from "./management-api";
import { matchStatusLabels } from "./admin-game-history";
type Replay = ReturnType<typeof matchReplaySchema.parse>;
export function AdminMatchReplay({ initial }: { initial: Replay }) {
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
    managementRequest(`/admin/games/${initial.match.gameId}/matches/${initial.match.id}?offset=${requestedOffset}&limit=100`,matchReplaySchema)
      .then(value=>{if(active){setPage(value);setError("");}}).catch(reason=>{if(active){setPlaying(false);setError(reason instanceof Error?reason.message:"Não foi possível carregar as jogadas.");}});
    return ()=>{active=false;};
  },[initial,requestedOffset,retry]);
  useEffect(()=>{
    if(!playing||loading||!frame)return;
    if(index>=initial.match.frameCount-1)return;
    const timer=setTimeout(()=>setIndex(value=>value+1),delay);
    return ()=>clearTimeout(timer);
  },[playing,loading,frame,index,delay,initial.match.frameCount]);
  const atEnd=index>=initial.match.frameCount-1;
  function seek(value:number) {setPlaying(false);setError("");setIndex(value);}
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Partida {initial.match.code}</h1><p className="text-sm text-muted">{matchStatusLabels[initial.match.status]} · Regras v{initial.match.rulesVersion}</p></div><Button asChild variant="outline"><Link href={`/admin/jogos/${initial.match.gameId}`}>Voltar ao jogo</Link></Button></div>
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={()=>seek(0)} disabled={index===0}>Início</Button>
        <Button variant="outline" onClick={()=>seek(Math.max(0,index-1))} disabled={index===0}>Jogada anterior</Button>
        <Button onClick={()=>setPlaying(value=>!value)} disabled={loading||atEnd||!!error}>{playing&&!atEnd?"Pausar":"Reproduzir"}</Button>
        <Button variant="outline" onClick={()=>seek(Math.min(initial.match.frameCount-1,index+1))} disabled={atEnd}>Próxima jogada</Button>
        <Button variant="outline" onClick={()=>seek(initial.match.frameCount-1)} disabled={atEnd}>Final</Button>
        <Select aria-label="Velocidade da reprodução" value={delay} onChange={event=>setDelay(Number(event.target.value))}><option value={2000}>0,5×</option><option value={1000}>1×</option><option value={500}>2×</option></Select>
      </div>
      <label className="grid gap-2 text-sm">Jogada {index+1} de {initial.match.frameCount}<Input aria-label="Ir para jogada" type="range" min={0} max={Math.max(0,initial.match.frameCount-1)} value={index} onChange={event=>seek(Number(event.target.value))} className="w-full accent-brand" /></label>
      <p className="text-xs text-muted">A reprodução mostra as jogadas confirmadas. Os controles alteram apenas esta visualização.</p>
    </Card>
    {error?<Card role="alert">{error} <Button variant="outline" onClick={()=>{setError("");setRetry(value=>value+1);}}>Tentar novamente</Button></Card>:loading||!frame?<Card>Carregando jogadas…</Card>:<>
      <Card className="grid gap-5"><p className="text-sm text-muted">Rodada {frame.state.round} · {frame.state.phase==="over"?"Fim da partida":frame.state.phase==="summary"?"Fim da rodada":`Vez de ${frame.state.players[frame.state.turn].name}`}</p>
        {frame.state.players.map((player,seat)=><div key={seat} className="grid gap-3 border-b border-line pb-4 last:border-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{player.name}{player.kind!=="human"?" · Bot":""}</span><span>{player.total} pontos · {{playing:"Ativo",stayed:"Parou",frozen:"Congelado",busted:"Estourou"}[player.status]}</span></div><div className="flex flex-wrap gap-2">{player.cards.map(card=><PlayingCard key={card.id} card={card} compact flipped={player.status==="busted"} />)}</div></div>)}
      </Card>
      <Card className="grid gap-3"><h2 className="font-semibold">Histórico da jogada</h2><ul className="grid gap-2 text-sm text-muted">{frame.state.log.slice(0,8).map((entry,index)=><li key={index}>{entry.message}</li>)}</ul></Card>
    </>}
    <Card className="grid gap-3"><h2 className="font-semibold">{initial.match.status==="finished"?"Resultado":"Pontuação registrada"}</h2>{initial.match.players.map(player=><div className="flex justify-between gap-3 text-sm" key={player.seat}><span>{player.name}{player.winner?" · Vencedor":""}{player.bot?" · Bot":""}</span><span>{player.score} pontos</span></div>)}</Card>
  </div>;
}
