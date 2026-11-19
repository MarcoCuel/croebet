"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CreateMatch, Lobby, RoomSync } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Heading } from "@/components/shared/heading";
import type { InitialMatches } from "./server-matches";
import type { GameOptions } from "./types";
import { modeLabel } from "./presentation";
import { createServerMatch, changeLobby, rememberStart } from "./api";
import { useMatchLive } from "./live";
import { readSetupPreferences, saveSetupPreferences } from "./setup-storage";

export function LobbyScreen({initial,rules}:{initial:InitialMatches;rules:(options:GameOptions)=>ReactNode}) {
  const router=useRouter();
  const {userId,openLogin}=useSession();
  const [room,setRoom]=useState<Lobby|null>(initial.lobby);
  const [lobbies,setLobbies]=useState(initial.lobbies);
  const [preferences]=useState(readSetupPreferences);
  const [capacity,setCapacity]=useState(preferences.count);
  const [options,setOptions]=useState<GameOptions>({mode:preferences.mode,brutal:preferences.brutal});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(initial.error);
  const pendingCreate=useRef<CreateMatch|null>(null);
  const pending=useRef<{key:string;id:string;version?:number}|null>(null);
  const navigating=useRef(false);
  useEffect(()=>{try{saveSetupPreferences({count:capacity,...options});}catch{/* Preferences are optional. */}},[capacity,options]);
  function accept(next:RoomSync){
    if(next.room.status==="lobby"){setRoom(next.room);return;}
    if(navigating.current)return;
    navigating.current=true;
    if(next.room.status==="abandoned"){router.push("/jogos/flip7");router.refresh();return;}
    rememberStart(next);router.refresh();
  }
  const connected=useMatchLive(room?.code,room?.version ?? 0,!!userId,accept,setLobbies,message=>{setError(message);});
  const visit=(code:string)=>router.push(`/jogos/flip7?partida=${code}`,{scroll:false});
  async function act(lobby:Lobby,action:"join"|"leave"|"start"){
    if(busy)return;
    setBusy(true);setError("");
    const key=`${lobby.code}:${action}`;
    if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID(),version:action==="start"?lobby.version:undefined};
    try{
      const response=await changeLobby(lobby.code,action,pending.current.id,pending.current.version);
      pending.current=null;
      if(action==="leave"){router.push("/jogos/flip7");router.refresh();}
      else if(response.status!=="closed"){
        if(action==="join") {if(room)setRoom(response as Lobby);else visit(response.code);}
        // Let the live stream carry the first deal to everyone, including host.
        else if(response.status==="lobby")setRoom(response);
      }
    }catch(e){pending.current=null;setError(e instanceof Error?e.message:"Não foi possível atualizar a sala.");}
    finally{setBusy(false);}
  }
  if(room){
    const member=room.participants.some(person=>person.userId===userId);
    const host=room.hostId===userId;
    return <div className="mx-auto grid w-full max-w-5xl items-start gap-6 py-6 sm:py-12 lg:grid-cols-2">
      <Card className="space-y-5">
        <Heading variant="section">Lobby {room.code}</Heading>
        <p className="text-sm text-muted">{modeLabel(room.options)} · {room.participants.length}/{room.capacity} jogadores</p>
        <ul className="divide-y divide-contrast/6" aria-label="Participantes da sala">
          {room.participants.map(person=><li key={person.userId} className="flex items-center gap-3 py-3">
            <Avatar className="size-10"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{person.username[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1 truncate">{person.username}</span>
            {person.userId===room.hostId && <span className="text-xs text-muted">Host</span>}
          </li>)}
        </ul>
        <p className="text-sm text-muted" role="status">{!connected?"Reconectando à sala…":host?"Você pode iniciar com pelo menos 2 jogadores.":"Aguardando o host iniciar a partida."}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-3">
          {!member?<Button disabled={busy || !connected || room.participants.length>=room.capacity} loading={busy} onClick={()=>act(room,"join")}>Entrar na sala</Button>:<>
            {host && <Button disabled={busy || !connected || room.participants.length<2} loading={busy} onClick={()=>act(room,"start")}>Iniciar partida</Button>}
            <Button variant="outline" disabled={busy} onClick={()=>act(room,"leave")}>Sair do lobby</Button>
          </>}
          <Button variant="ghost" onClick={()=>router.push("/jogos/flip7")}>Ver salas</Button>
        </div>
      </Card>
      <Card>{rules(room.options)}</Card>
    </div>;
  }
  return <div className="mx-auto grid w-full max-w-5xl items-start gap-6 py-6 sm:py-12 lg:grid-cols-2">
    <Card className="space-y-5">
      <Heading variant="section">Criar lobby</Heading>
      <fieldset disabled={busy} className="space-y-4">
        <Field>Versão<Select aria-label="Versão do Flip7" value={options.mode} onChange={e=>setOptions({mode:e.target.value as GameOptions["mode"],brutal:false})}><option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option></Select></Field>
        {options.mode==="vengeance" && <Field className="grid-cols-[1fr_auto] items-center">Modo Brutal<Switch aria-label="Modo Brutal" checked={options.brutal} onCheckedChange={brutal=>setOptions({...options,brutal})}/></Field>}
        <Field>Limite de jogadores<Select aria-label="Limite de jogadores" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n}>{n}</option>)}</Select></Field>
        <p className="text-sm text-muted">A partida pode começar com 2 pessoas, sem preencher todas as vagas.</p>
        <Button className="w-full" loading={busy} onClick={async()=>{
          if(!userId){openLogin();return;}
          setBusy(true);setError("");
          const payload={game:"flip7" as const,capacity,options};
          if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:crypto.randomUUID()};
          try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;visit(lobby.code);}
          catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}finally{setBusy(false);}
        }}>{userId?"Criar lobby":"Entrar para jogar"}</Button>
      </fieldset>
      {rules(options)}
    </Card>
    <Card className="space-y-5" aria-label="Lobbies abertos">
      <Heading variant="section">Lobbies abertos</Heading>
      {!userId?<p className="text-sm text-muted">Entre na sua conta para ver as salas.</p>:<>
        {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
        {lobbies.length===0?<p className="text-sm text-muted">Nenhum lobby aberto por enquanto.</p>:<ul className="divide-y divide-contrast/6">{lobbies.map(lobby=><li key={lobby.code} className="flex flex-wrap items-center gap-3 py-4">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Sala de {lobby.participants.find(p=>p.userId===lobby.hostId)?.username}</p><p className="text-xs text-muted">{modeLabel(lobby.options)} · {lobby.participants.length}/{lobby.capacity} jogadores</p></div>
          {lobby.participants.some(p=>p.userId===userId)?<Button size="sm" variant="secondary" onClick={()=>visit(lobby.code)}>Voltar ao lobby</Button>:<Button size="sm" variant="secondary" loading={busy} disabled={busy || !connected || lobby.participants.length>=lobby.capacity} onClick={()=>act(lobby,"join")}>{lobby.participants.length>=lobby.capacity?"Lotado":"Entrar"}</Button>}
        </li>)}</ul>}
      </>}
    </Card>
    {error && <p role="alert" className="text-sm text-destructive lg:col-span-2">{error}</p>}
    {initial.items.length>0 && <Card className="space-y-4 lg:col-span-2" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="divide-y divide-contrast/6">{initial.items.map(match=><li key={match.code} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{modeLabel(match.options)} · Rodada {match.state.round} · {match.participants.length} jogadores</span><Button size="sm" variant="secondary" onClick={()=>visit(match.code)}>Continuar partida</Button></li>)}</ul></Card>}
  </div>;
}
