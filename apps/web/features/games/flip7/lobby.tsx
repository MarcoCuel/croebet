"use client";
import { randomUUID } from "@/lib/uuid";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crown, Eye, Plus, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameRecord, CreateMatch, Lobby, LobbyList, RoomSync, UpdateLobby } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
import type { InitialMatches } from "./server-matches";
import type { GameOptions } from "./types";
import { createServerMatch, changeLobby, rememberStart, updateServerLobby } from "./api";
import { useMatchLive } from "./live";
import { InvitePlayers } from "./invite-players";
import { KickPlayer } from "./kick-player";
import { GameEntryHeader } from "../game-entry-header";
import { readSetupPreferences, saveSetupPreferences } from "./setup-storage";

function SeatOutline() {
  return <svg className="pointer-events-none absolute inset-0 size-full text-field-border" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="31.5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"/>
  </svg>;
}

export function LobbyScreen({initial,rules,game}:{initial:InitialMatches;game:GameRecord;rules:(options:GameOptions)=>ReactNode}) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const {userId,username,avatar,openLogin}=useSession();
  const [room,setRoom]=useState<Lobby|null>(initial.lobby);
  const [directory,setDirectory]=useState<LobbyList>(initial.directory);
  const [matches,setMatches]=useState(initial.items);
  const [preferences]=useState(readSetupPreferences);
  const [capacity,setCapacity]=useState(preferences.count);
  const [options,setOptions]=useState<GameOptions>({mode:preferences.mode,brutal:preferences.brutal});
  const [busy,setBusy]=useState(false);
  const [inviting,setInviting]=useState(searchParams.get("convidar")==="1");
  const [error,setError]=useState(initial.error);
  const pendingCreate=useRef<CreateMatch|null>(null);
  const pendingUpdate=useRef<UpdateLobby|null>(null);
  const pending=useRef<{key:string;id:string;version?:number}|null>(null);
  const navigating=useRef(false);
  const refreshed=useRef<string|null>(null);
  const leaving=useRef(false);
  const visit=(code:string|null,invite=false)=>{
    if(!code)navigating.current=false;
    window.history.replaceState(null,"",code?"/jogos/flip7?partida="+code+(invite?"&convidar=1":""):"/jogos/flip7");
  };
  const openMatch=(code:string)=>{
    if(searchParams.get("partida")===code){
      if(refreshed.current!==code){refreshed.current=code;router.refresh();}
    }
    else router.replace("/jogos/flip7?partida="+code,{scroll:false});
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
    if(next.room.status==="abandoned"){setRoom(null);setDirectory(current=>({...current,owned:current.owned?.code===next.room.code?null:current.owned,joined:current.joined.filter(lobby=>lobby.code!==next.room.code)}));visit(null);return;}
    rememberStart(next);openMatch(next.room.code);
  }
  function acceptDirectory(next:LobbyList){
    setDirectory(next);
    if(next.active && !navigating.current){
      navigating.current=true;openMatch(next.active.code);return;
    }
  }
  useEffect(()=>{
    // Returning to a lobby URL can reuse the pre-start RSC entry. Refresh once
    // after the URL changes so a cached lobby cannot trap an active player.
    if(directory.active && (!navigating.current || searchParams.get("partida")===directory.active.code)){
      navigating.current=true;openMatch(directory.active.code);
    }
    else if(directory.owned && !room && !leaving.current && !navigating.current && !searchParams.get("partida")){
      acceptLobby(directory.owned);visit(directory.owned.code);
    }
  });
  const connected=useMatchLive(room?.code,room?.version ?? 0,true,accept,acceptDirectory,message=>{
    if(leaving.current || navigating.current)return;
    setError(message);
    if(room){setRoom(null);visit(null);}
  },setMatches);
  const lobbies=[...new Map([...directory.items,...directory.joined].map(lobby=>[lobby.id,lobby])).values()];
  const host=room?.hostId===userId;
  const member=!!room?.participants.some(person=>person.userId===userId);
  const settings=room?.options ?? options;
  const limit=room?.capacity ?? capacity;
  const seats=room?[...room.participants,...room.pendingInvitations]:[];
  const occupied=room?seats.length:1;
  const allOnline=!!room && room.pendingInvitations.length===0 && room.participants.every(p=>room.onlineUserIds.includes(p.userId));
  const showSettings=!!userId && (!room || host);
  const canEdit=showSettings && !busy && (!room || connected);

  async function configure(nextOptions:GameOptions,nextCapacity:number){
    if(!canEdit)return;
    if(!room){setOptions(nextOptions);setCapacity(nextCapacity);return;}
    setBusy(true);setError("");
    const payload={capacity:nextCapacity,options:nextOptions,expectedVersion:room.version};
    if(!pendingUpdate.current || JSON.stringify({...pendingUpdate.current,commandId:undefined})!==JSON.stringify(payload))pendingUpdate.current={...payload,commandId:randomUUID()};
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
    if(!userId){
      if(action==="join"){acceptLobby(lobby);visit(lobby.code);}
      openLogin();return;
    }
    setBusy(true);setError("");leaving.current=action==="leave";
    const key=lobby.code+":"+action;
    if(pending.current?.key!==key)pending.current={key,id:randomUUID(),version:action==="start"?lobby.version:undefined};
    try{
      const response=await changeLobby(lobby.code,action,pending.current.id,pending.current.version);
      pending.current=null;
      if(action==="leave"){
        setRoom(null);setDirectory(current=>({...current,owned:current.owned?.code===lobby.code?null:current.owned,joined:current.joined.filter(room=>room.code!==lobby.code)}));visit(null);leaving.current=false;
      }else if(response.status==="lobby"){
        acceptLobby(response);
        if(action==="join")visit(response.code);
      }
      // The room stream presents the initial deal after the host starts.
    }catch(e){pending.current=null;leaving.current=false;setError(e instanceof Error?e.message:"Não foi possível atualizar a sala.");}
    finally{setBusy(false);}
  }
  const autoJoin=useRef("");
  useEffect(()=>{
    const code=searchParams.get("partida");
    if(!userId || !connected || !room || room.code!==code || member || busy || leaving.current)return;
    const key=userId+":"+code;
    if(autoJoin.current===key)return;
    autoJoin.current=key;
    void act(room,"join");
  });
  async function create(invite=false){
    if(busy || directory.owned || directory.active)return;
    if(!userId){openLogin();return;}
    leaving.current=false;
    setBusy(true);setError("");
    const payload={game:"flip7" as const,capacity:room?.capacity ?? capacity,options:room?.options ?? options};
    if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:randomUUID()};
    try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;setCapacity(lobby.capacity);setOptions(lobby.options);acceptLobby(lobby);visit(lobby.code,invite);return lobby;}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}
    finally{setBusy(false);}
  }

  return <div className="w-full space-y-6 py-6 sm:py-12">
    <GameEntryHeader game={game} actions={!userId?rules(settings):undefined}/>
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
    {showSettings && <Card className="min-w-0 space-y-5" aria-label="Configuração e regras">
      <Heading variant="section">Configuração</Heading>
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field className="grid-cols-[auto_minmax(0,max-content)] items-center justify-between gap-4">Modo<Select className="max-w-full" aria-label="Modo do Flip7" value={settings.mode} onChange={e=>void configure({mode:e.target.value as GameOptions["mode"],brutal:false},limit)}><option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option></Select></Field>
        {settings.mode==="vengeance" && <Field className="grid-cols-[1fr_auto] items-center">Modo Brutal<Switch aria-label="Modo Brutal" checked={settings.brutal} onCheckedChange={brutal=>void configure({...settings,brutal},limit)}/></Field>}
      </fieldset>
      {rules(settings)}
    </Card>}
    {(userId || room) && <Card className="min-w-0 space-y-5" aria-label="Jogadores e vagas">
      {showSettings?<fieldset disabled={!canEdit}>
        <Field className="grid-cols-[1fr_auto] items-center gap-4">Número de jogadores<Select className="w-20" aria-label="Número de jogadores" value={limit} onChange={e=>void configure(settings,Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n} disabled={n<occupied}>{n}</option>)}</Select></Field>
      </fieldset>:<div className="flex flex-wrap items-center gap-2" aria-label="Modo da sala"><Badge variant="secondary">{settings.mode==="classic"?"Clássico":"Vingança"}</Badge>{settings.brutal && <Badge>Brutal</Badge>}</div>}
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 xl:grid-cols-3" aria-label="Vagas da sala">
        {Array.from({length:limit},(_,i)=>{
          const person=seats[i];
          const waiting=!!person && !!room && (!room.participants.some(p=>p.userId===person.userId) || (person.userId!==userId && !room.onlineUserIds.includes(person.userId)));
          const preview=!room && i===0;
          const name=person?.username ?? (preview?username ?? "Você":null);
          const isHost=(person && person.userId===room?.hostId) || preview;
          const next=i===occupied;
          const placeholder=<UserRound className="size-6 text-muted" aria-hidden="true"/>;
          return <li key={person?.userId ?? (preview?userId:undefined) ?? "seat-"+i} className={cn("relative flex min-w-0 flex-col items-center gap-2",waiting && "opacity-40")}>
            <div className="relative">
              {name?<Avatar className="size-16"><AvatarImage src={person?.avatarUrl ?? (preview?avatar ?? undefined:undefined)}/><AvatarFallback className="text-lg">{name[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
                :next && (!room || host)?<Button variant="ghost" size="icon" className="relative size-16 rounded-full! border-0 p-0" aria-label="Convidar jogadores" disabled={busy || (!!userId && !connected)} onClick={async()=>{
                  if(!userId){openLogin();return;}
                  if(room){setInviting(true);return;}
                  const created=await create(true);if(created)setInviting(true);
                }}><SeatOutline/><Plus className="size-6" aria-hidden="true"/></Button>
                :<span className="relative flex size-16 items-center justify-center rounded-full"><SeatOutline/>{placeholder}</span>}
              {isHost && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-brand" title="Host"><Crown className="size-4" aria-label="Host"/></span>}
            </div>
            <span className={cn("w-full truncate text-center text-xs font-medium",isHost?"text-brand":!name && "text-muted")} title={waiting?`${name} · Aguardando entrada`:name ?? undefined}>{name ?? "Disponível"}</span>
            {room && host && person && person.userId!==userId && <KickPlayer code={room.code} version={room.version} userId={person.userId} name={person.username} compact disabled={busy || !connected} onSuccess={response=>{if(response.status==="lobby")acceptLobby(response);}}/>}
          </li>;
        })}
      </ul>
      {room && host && <InvitePlayers key={room.code} code={room.code} open={inviting} onOpenChange={open=>{setInviting(open);if(!open && searchParams.has("convidar"))visit(room.code);}}/>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {!room?<Button className="w-full" loading={busy} disabled={!!directory.owned || !!directory.active || (!!userId && !connected)} onClick={()=>void create()}>{userId?"Jogar":"Entrar para jogar"}</Button>
          :!member?<Button className="w-full" loading={busy} disabled={busy || !connected || occupied>=room.capacity && !room.pendingInvitations.some(p=>p.userId===userId) || !!directory.active} onClick={()=>void act(room,"join")}>Entrar na sala</Button>
          :<div className="flex items-center gap-3">
            <Button className="min-w-0 flex-1" loading={busy} disabled={busy || !connected || !host || room.participants.length<2 || !allOnline} onClick={()=>void act(room,"start")}>{host?"Jogar":"Aguardando o host"}</Button>
            <Button className="shrink-0" variant="secondary" disabled={busy || !connected} onClick={()=>void act(room,"leave")}>Cancelar</Button>
          </div>}
        {room && host && connected && !allOnline && <p className="text-sm text-muted" role="status">Aguardando todos os convidados entrarem na sala.</p>}
        {room && !connected && <p className="text-sm text-muted" role="status">Reconectando à sala…</p>}
        {userId && room && !directory.owned && !directory.active && <Button className="w-full" variant="secondary" disabled={busy || !connected} onClick={()=>void create()}>Criar meu lobby</Button>}
        {room && directory.owned && directory.owned.code!==room.code && <Button className="w-full" variant="secondary" disabled={busy} onClick={()=>{acceptLobby(directory.owned!);visit(directory.owned!.code);}}>Meu lobby</Button>}
      </div>
    </Card>}
    <section className={cn("min-w-0 space-y-5",!showSettings && (userId || room?"xl:col-span-2":"xl:col-span-3"))} aria-label="Lobbies abertos">
      <Heading variant="section">Lobbies abertos</Heading>
      <>
        {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
        {lobbies.length===0?<p className="text-sm text-muted">Nenhum lobby aberto por enquanto.</p>:<ul className={cn("grid gap-4",!showSettings && "sm:grid-cols-2",!userId && !room && "xl:grid-cols-3")}>{lobbies.map(lobby=>{
          const people=[...lobby.participants,...lobby.pendingInvitations];
          const joined=lobby.participants.some(p=>p.userId===userId);
          const reserved=lobby.pendingInvitations.some(p=>p.userId===userId);
          return <li key={lobby.code}><Card className="h-full space-y-5">
            <div className="flex flex-wrap items-center gap-2">{joined?<Button variant="ghost" className="h-auto min-h-0 min-w-0 truncate rounded-sm p-0 text-sm font-semibold text-foreground" disabled={busy} onClick={()=>{acceptLobby(lobby);visit(lobby.code);}}>Sala de {lobby.participants.find(p=>p.userId===lobby.hostId)?.username}</Button>:<p className="min-w-0 truncate text-sm font-semibold">Sala de {lobby.participants.find(p=>p.userId===lobby.hostId)?.username}</p>}<Badge variant="secondary">{lobby.options.mode==="classic"?"Clássico":"Vingança"}</Badge>{lobby.options.brutal && <Badge>Brutal</Badge>}</div>
            <ul className="flex flex-wrap gap-x-3 gap-y-4" aria-label="Vagas do lobby">{Array.from({length:lobby.capacity},(_,i)=>{
              const person=people[i];
              return <li key={person?.userId ?? i} className={cn("flex w-14 min-w-0 flex-col items-center gap-2",person && (!lobby.participants.some(p=>p.userId===person.userId) || !lobby.onlineUserIds.includes(person.userId)) && "opacity-40")}>
                {person?<Avatar className="size-11"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{person.username[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>:<Button variant="ghost" size="icon" className="relative size-11 rounded-full! border-0 p-0" aria-label={`Entrar na sala de ${lobby.participants.find(p=>p.userId===lobby.hostId)?.username}, vaga ${i+1}`} disabled={busy || !connected || joined || !!directory.active} onClick={()=>void act(lobby,"join")}><SeatOutline/><Plus className="size-4" aria-hidden="true"/></Button>}
                <span title={person?.username} className={cn("w-full truncate text-center text-xs",person?.userId===lobby.hostId?"text-brand":!person && "text-muted")}>{person?.username ?? "Disponível"}</span>
              </li>;
            })}</ul>
            {reserved && !joined && <Button size="sm" variant="secondary" disabled={busy || !connected || !!directory.active} onClick={()=>void act(lobby,"join")}>Aceitar convite</Button>}
          </Card></li>;
        })}</ul>}
      </>
    </section>
    {matches.length>0 && <section className="min-w-0 space-y-5 xl:col-span-3" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{matches.map(match=>{
      const playing=!!userId && match.controllerIds.includes(userId);
      return <li key={match.code}><Card className="space-y-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Sala de {match.participants.find(p=>p.userId===match.hostId)?.username}</p><Badge variant="secondary">{match.options.mode==="classic"?"Clássico":"Vingança"}</Badge>{match.options.brutal && <Badge>Brutal</Badge>}</div><p className="text-xs text-muted">Rodada {match.round} · {match.participants.length} jogadores</p><Button size="sm" variant="secondary" onClick={()=>openMatch(match.code)}><Eye className="size-4" aria-hidden="true"/>{playing?"Continuar partida":"Visualizar"}</Button></Card></li>;
    })}</ul></section>}
    </div>
    {!userId && !room && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
