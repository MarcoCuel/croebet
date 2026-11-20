"use client";
import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { commandResultSchema, lobbyPlayersSchema, type LobbyPlayers } from "@croebet/shared";
import { realtimeRequest } from "../realtime";
import { managementRequest } from "@/features/admin/management-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function InvitePlayers({code,open,onOpenChange}:{code:string;open:boolean;onOpenChange:(open:boolean)=>void}) {
  const [query,setQuery]=useState("");
  const [players,setPlayers]=useState<LobbyPlayers|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [sending,setSending]=useState<string|null>(null);
  useEffect(()=>{
    if(!open)return;
    let active=true;
    async function load(){
      setLoading(true);
      try{
        const result=await managementRequest(`/matches/${code}/players?q=${encodeURIComponent(query)}`,lobbyPlayersSchema);
        if(active){setPlayers(result);setError("");}
      }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível buscar jogadores.");}
      finally{if(active)setLoading(false);}
    }
    const debounce=window.setTimeout(()=>void load(),200);
    const refresh=window.setInterval(()=>void load(),15000);
    return()=>{active=false;window.clearTimeout(debounce);window.clearInterval(refresh);};
  },[code,open,query]);
  async function invite(userId:string){
    if(sending)return;
    setSending(userId);
    try{
      await realtimeRequest({type:"invite",code,input:{targetUserId:userId}},commandResultSchema);
      setPlayers(current=>current && {...current,items:current.items.map(person=>person.userId===userId?{...person,invited:true}:person)});
      toast.success("Convite enviado.");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível enviar o convite.");}
    finally{setSending(null);}
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Convidar jogadores</DialogTitle>
      <div className="mt-5 space-y-4">
        <Button variant="secondary" className="w-full" onClick={async()=>{
          try{await navigator.clipboard.writeText(`${window.location.origin}/jogos/flip7?partida=${code}`);toast.success("Link de convite copiado.");}
          catch{toast.error("Não foi possível copiar o link.");}
        }}><Copy className="size-4" aria-hidden="true"/>Copiar link de convite</Button>
        <SearchInput aria-label="Encontrar jogadores" placeholder="Encontre jogadores…" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)}/>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!players && !error && <p role="status" className="text-sm text-muted">Buscando jogadores…</p>}
        {players && <div aria-busy={loading} className="max-h-80 space-y-4 overflow-y-auto" data-lenis-prevent>
          {[true,false].map(online=>{
            const group=players.items.filter(person=>person.online===online);
            return <details key={String(online)} open>
              <summary className="cursor-pointer text-sm font-medium">{online?"Online":"Offline"} <span className="text-muted">({group.length})</span></summary>
              {group.length===0?<p className="py-3 text-xs text-muted">Nenhum jogador {online?"online":"offline"} encontrado.</p>:<ul className="mt-2 space-y-1">{group.map(person=><li key={person.userId} className="flex items-center gap-3 py-2">
                <span className="relative"><Avatar className="size-10"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{person.username[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar><span aria-hidden="true" className={`absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-surface ${online?"bg-flip-green":"bg-muted"}`}/></span>
                <span className="min-w-0 flex-1 truncate text-sm">{person.username}</span>
                <Button size="icon-sm" variant="secondary" aria-label={person.invited?`Convite enviado para ${person.username}`:`Convidar ${person.username}`} disabled={person.invited || sending!==null} loading={sending===person.userId} onClick={()=>void invite(person.userId)}>{person.invited?<Check className="size-4" aria-hidden="true"/>:<UserPlus className="size-4" aria-hidden="true"/>}</Button>
              </li>)}</ul>}
            </details>;
          })}
          {players.hasMore && <p className="text-xs text-muted">Use a busca para encontrar mais jogadores.</p>}
        </div>}
      </div>
    </DialogContent>
  </Dialog>;
}
