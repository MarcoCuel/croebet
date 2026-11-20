"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { matchHistoryListSchema } from "@croebet/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { managementRequest } from "./management-api";
export const matchStatusLabels = { playing: "Em andamento", finished: "Concluída", abandoned: "Encerrada sem vencedor" };
export function AdminGameHistory({ gameId }: { gameId: string }) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [offset,setOffset]=useState(0);
  const [data,setData]=useState<ReturnType<typeof matchHistoryListSchema.parse> | null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    const timer=setTimeout(()=>{
      const params=new URLSearchParams({q:query,status,offset:String(offset)});
      managementRequest(`/admin/games/${gameId}/matches?${params}`,matchHistoryListSchema)
        .then(value=>{if(active)setData(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"Não foi possível carregar as partidas.");});
    },200);
    return ()=>{active=false;clearTimeout(timer);};
  },[gameId,query,status,offset,retry]);
  function reset() { setData(null);setError("");setOffset(0); }
  return <Card className="grid gap-5">
    <h2 className="text-xl font-semibold">Partidas</h2>
    <div className="flex flex-wrap gap-3">
      <Input aria-label="Buscar partidas por código ou participante" type="search" placeholder="Buscar código ou participante" value={query} onChange={event=>{reset();setQuery(event.target.value);}} className="sm:max-w-sm" />
      <Select aria-label="Status das partidas" value={status} onChange={event=>{reset();setStatus(event.target.value);}}>
        <option value="all">Todas</option><option value="playing">Em andamento</option><option value="finished">Concluídas</option><option value="abandoned">Encerradas sem vencedor</option>
      </Select>
    </div>
    {error ? <div role="alert">{error} <Button variant="outline" onClick={()=>{reset();setRetry(value=>value+1);}}>Tentar novamente</Button></div>
      : !data ? <p className="text-sm text-muted">Carregando partidas…</p>
      : <><ul aria-label="Partidas do jogo" className="divide-y divide-line">
        {data.items.map(match=><li key={match.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="grid gap-1 text-sm"><span className="font-medium">{match.code} · {matchStatusLabels[match.status]}</span>
            <span className="text-muted">{new Date(match.startedAt).toLocaleString("pt-BR")} · {match.options.mode==="classic"?"Clássico":"Vingança"}{match.options.brutal?" · Brutal":""}</span>
            <span>{match.players.map(p=>p.name).join(", ")}</span>
            <span className="text-muted">{match.status==="finished"?`Vencedor${match.players.filter(p=>p.winner).length>1?"es":""}: ${match.players.filter(p=>p.winner).map(p=>p.name).join(", ")}`:matchStatusLabels[match.status]}</span>
          </div>
          <Button asChild variant="outline" size="sm"><Link href={`/admin/jogos/${gameId}/partidas/${match.id}`}>Ver histórico</Link></Button>
        </li>)}
      </ul>{!data.items.length&&<EmptyState title="Nenhuma partida encontrada." />}
      <div className="flex gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>{setData(null);setOffset(value=>Math.max(0,value-20));}}>Anteriores</Button><Button variant="outline" disabled={!data.hasMore} onClick={()=>{setData(null);setOffset(value=>value+20);}}>Próximas</Button></div></>}
  </Card>;
}
