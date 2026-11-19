"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreateMatch, Lobby, LobbyList, RoomSync, UpdateLobby } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
import type { InitialMatches } from "./server-matches";
import type { GameOptions } from "./types";
import { modeLabel } from "./presentation";
import { createServerMatch, changeLobby, rememberStart, updateServerLobby } from "./api";
import { useMatchLive } from "./live";
import { KickPlayer } from "./kick-player";
import { readSetupPreferences, saveSetupPreferences } from "./setup-storage";

export function LobbyScreen({initial,rules}:{initial:InitialMatches;rules:(options:GameOptions)=>ReactNode}) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const {userId,username,avatar,openLogin}=useSession();
  const [room,setRoom]=useState<Lobby|null>(initial.lobby);
  const [directory,setDirectory]=useState<LobbyList>({items:initial.lobbies,current:initial.currentLobby});
  const [preferences]=useState(readSetupPreferences);
  const [capacity,setCapacity]=useState(preferences.count);
  const [options,setOptions]=useState<GameOptions>({mode:preferences.mode,brutal:preferences.brutal});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(initial.error);
  const pendingCreate=useRef<CreateMatch|null>(null);
  const pendingUpdate=useRef<UpdateLobby|null>(null);
  const pending=useRef<{key:string;id:string;version?:number}|null>(null);
  const navigating=useRef(false);
  const leaving=useRef(false);
  const visit=(code:string|null)=>{
    if(searchParams.get("partida")===code)router.refresh();
    else router.replace(code?"/jogos/flip7?partida="+code:"/jogos/flip7",{scroll:false});
  };
  useEffect(()=>{try{saveSetupPreferences({count:capacity,...options});}catch{/* Preferences are optional. */}},[capacity,options]);
  function acceptLobby(next:Lobby){
    setRoom(current=>current?.code===next.code && current.version>next.version?current:next);
  }
  function accept(next:RoomSync){
    if(leaving.current || navigating.current)return;
    if(next.room.status==="lobby"){
      if(room?.participants.some(person=>person.userId===userId) && !next.room.participants.some(person=>person.userId===userId)){
        setRoom(null);visit(null);return;
      }
      acceptLobby(next.room);return;
    }
    navigating.current=true;
    if(next.room.status==="abandoned"){visit(null);return;}
    rememberStart(next);visit(next.room.code);
  }
  function acceptDirectory(next:LobbyList){
    setDirectory(next);
    if(next.current && !leaving.current && !navigating.current && next.current.code!==room?.code){
      acceptLobby(next.current);visit(next.current.code);
    }
  }
  const connected=useMatchLive(room?.code,room?.version ?? 0,!!userId,accept,acceptDirectory,message=>{
    if(leaving.current)return;
    setError(message);
    if(room){setRoom(null);visit(null);}
  });
  const host=room?.hostId===userId;
  const member=!!room?.participants.some(person=>person.userId===userId);
  const settings=room?.options ?? options;
  const limit=room?.capacity ?? capacity;
  const occupied=room?.participants.length ?? 1;
  const canEdit=!busy && (!room || (host && connected));

  async function configure(nextOptions:GameOptions,nextCapacity:number){
    if(!canEdit)return;
    if(!room){setOptions(nextOptions);setCapacity(nextCapacity);return;}
    setBusy(true);setError("");
    const payload={capacity:nextCapacity,options:nextOptions,expectedVersion:room.version};
    if(!pendingUpdate.current || JSON.stringify({...pendingUpdate.current,commandId:undefined})!==JSON.stringify(payload))pendingUpdate.current={...payload,commandId:crypto.randomUUID()};
    try{
      const response=await updateServerLobby(room.code,pendingUpdate.current);
      pendingUpdate.current=null;
      if(response.status==="lobby"){
        acceptLobby(response);setOptions(response.options);setCapacity(response.capacity);
      }
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar a sala.");}
    finally{setBusy(false);}
  }
  async function act(lobby:Lobby,action:"join"|"leave"|"start"){
    if(busy)return;
    setBusy(true);setError("");leaving.current=action==="leave";
    const key=lobby.code+":"+action;
    if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID(),version:action==="start"?lobby.version:undefined};
    try{
      const response=await changeLobby(lobby.code,action,pending.current.id,pending.current.version);
      pending.current=null;
      if(action==="leave"){
        setRoom(null);setDirectory(current=>({...current,current:null}));visit(null);
      }else if(response.status==="lobby"){
        acceptLobby(response);
        if(action==="join")visit(response.code);
      }
      // The room stream presents the initial deal after the host starts.
    }catch(e){pending.current=null;leaving.current=false;setError(e instanceof Error?e.message:"Não foi possível atualizar a sala.");}
    finally{setBusy(false);}
  }
  async function create(){
    if(busy || room || directory.current)return;
    if(!userId){openLogin();return;}
    leaving.current=false;
    setBusy(true);setError("");
    const payload={game:"flip7" as const,capacity,options};
    if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:crypto.randomUUID()};
    try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;acceptLobby(lobby);visit(lobby.code);}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}
    finally{setBusy(false);}
  }

  return <div className="mx-auto grid w-full max-w-5xl items-start gap-6 py-6 sm:py-12 lg:grid-cols-2">
    <Card className="space-y-5" aria-label="Configuração e regras">
      <Heading variant="section">Configuração</Heading>
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field>Versão<Select aria-label="Versão do Flip7" value={settings.mode} onChange={e=>void configure({mode:e.target.value as GameOptions["mode"],brutal:false},limit)}><option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option></Select></Field>
        {settings.mode==="vengeance" && <Field className="grid-cols-[1fr_auto] items-center">Modo Brutal<Switch aria-label="Modo Brutal" checked={settings.brutal} onCheckedChange={brutal=>void configure({...settings,brutal},limit)}/></Field>}
      </fieldset>
      {rules(settings)}
    </Card>
    <Card className="space-y-5" aria-label="Jogadores e vagas">
      <Heading variant="section">{room?"Lobby "+room.code:"Jogadores"}</Heading>
      <fieldset disabled={!canEdit}>
        <Field>Limite de jogadores<Select aria-label="Limite de jogadores" value={limit} onChange={e=>void configure(settings,Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n} disabled={n<occupied}>{n}</option>)}</Select></Field>
      </fieldset>
      <p className="text-sm text-muted">{modeLabel(settings)} · {occupied}/{limit} jogadores</p>
      <ul className="divide-y divide-contrast/6" aria-label="Vagas da sala">
        {Array.from({length:limit},(_,i)=>{
          const person=room?.participants[i];
          const preview=!room && i===0;
          const name=person?.username ?? (preview?username ?? "Você":null);
          return <li key={person?.userId ?? "seat-"+i} className="flex min-h-16 items-center gap-3 py-3">
            <Avatar className="size-10"><AvatarImage src={person?.avatarUrl ?? (preview?avatar ?? undefined:undefined)}/><AvatarFallback>{name?.[0]?.toLocaleUpperCase("pt-BR") ?? "·"}</AvatarFallback></Avatar>
            <span className={cn("min-w-0 flex-1 truncate text-sm",!name && "text-muted")}>{name ?? "Vaga livre"}</span>
            {((person && person.userId===room?.hostId) || preview) && <span className="text-xs text-muted">Host</span>}
            {room && host && person && person.userId!==userId && <KickPlayer code={room.code} version={room.version} userId={person.userId} name={person.username} disabled={busy || !connected} onSuccess={response=>{if(response.status==="lobby")acceptLobby(response);}}/>}
          </li>;
        })}
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {!room?<Button className="w-full" loading={busy} disabled={!!directory.current} onClick={()=>void create()}>{userId?"Criar lobby":"Entrar para jogar"}</Button>
          :!member?<Button className="w-full" loading={busy} disabled={busy || !connected || room.participants.length>=room.capacity || !!directory.current} onClick={()=>void act(room,"join")}>Entrar na sala</Button>
          :<>
            <Button className="w-full" loading={busy} disabled={busy || !connected || !host || room.participants.length<2} onClick={()=>void act(room,"start")}>{host?"Jogar":"Aguardando o host"}</Button>
            <Button className="w-full" variant="ghost" disabled={busy} onClick={()=>void act(room,"leave")}>Sair do lobby</Button>
          </>}
        <p className="text-sm text-muted" role="status">{room?!connected?"Reconectando à sala…":host?"A partida pode começar com pelo menos 2 jogadores.":"Só o host pode alterar a configuração e iniciar.":"A partida pode começar com 2 pessoas, sem preencher todas as vagas."}</p>
      </div>
    </Card>
    <Card className="space-y-5 lg:col-span-2" aria-label="Lobbies abertos">
      <Heading variant="section">Lobbies abertos</Heading>
      {!userId?<p className="text-sm text-muted">Entre na sua conta para ver as salas.</p>:<>
        {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
        {directory.items.length===0?<p className="text-sm text-muted">Nenhum lobby aberto por enquanto.</p>:<ul className="divide-y divide-contrast/6">{directory.items.map(lobby=>{
          const joined=lobby.participants.some(p=>p.userId===userId);
          return <li key={lobby.code} className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Sala de {lobby.participants.find(p=>p.userId===lobby.hostId)?.username}</p><p className="text-xs text-muted">{modeLabel(lobby.options)} · {lobby.participants.length}/{lobby.capacity} jogadores</p></div>
            {joined?<span className="text-sm text-muted">Seu lobby</span>:<Button size="sm" variant="secondary" loading={busy} disabled={busy || !connected || !!directory.current || lobby.participants.length>=lobby.capacity} onClick={()=>void act(lobby,"join")}>{lobby.participants.length>=lobby.capacity?"Lotado":"Entrar"}</Button>}
          </li>;
        })}</ul>}
      </>}
    </Card>
    {initial.items.length>0 && <Card className="space-y-4 lg:col-span-2" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="divide-y divide-contrast/6">{initial.items.map(match=><li key={match.code} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{modeLabel(match.options)} · Rodada {match.state.round} · {match.participants.length} jogadores</span><Button size="sm" variant="secondary" onClick={()=>visit(match.code)}>Continuar partida</Button></li>)}</ul></Card>}
  </div>;
}
