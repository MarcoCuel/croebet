"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Crown, Plus, UserRound } from "lucide-react";
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
import { InvitePlayers } from "./invite-players";
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
  const [inviting,setInviting]=useState(searchParams.get("convidar")==="1");
  const [error,setError]=useState(initial.error);
  const pendingCreate=useRef<CreateMatch|null>(null);
  const pendingUpdate=useRef<UpdateLobby|null>(null);
  const pending=useRef<{key:string;id:string;version?:number}|null>(null);
  const navigating=useRef(false);
  const leaving=useRef(false);
  const visit=(code:string|null,invite=false)=>{
    if(searchParams.get("partida")===code)router.refresh();
    else router.replace(code?"/jogos/flip7?partida="+code+(invite?"&convidar=1":""):"/jogos/flip7",{scroll:false});
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
  const seats=room?[...room.participants,...room.pendingInvitations]:[];
  const occupied=room?seats.length:1;
  const allOnline=!!room && room.pendingInvitations.length===0 && room.participants.every(p=>room.onlineUserIds.includes(p.userId));
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
  const autoJoin=useRef("");
  useEffect(()=>{
    const code=searchParams.get("partida");
    if(!userId || !room || room.code!==code || member || busy || leaving.current)return;
    const key=userId+":"+code;
    if(autoJoin.current===key)return;
    autoJoin.current=key;
    void act(room,"join");
  });
  async function create(invite=false){
    if(busy || room || directory.current)return;
    if(!userId){openLogin();return;}
    leaving.current=false;
    setBusy(true);setError("");
    const payload={game:"flip7" as const,capacity,options};
    if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:crypto.randomUUID()};
    try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;acceptLobby(lobby);visit(lobby.code,invite);return lobby;}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}
    finally{setBusy(false);}
  }

  return <div className="mx-auto grid w-full max-w-5xl items-start gap-6 py-6 sm:py-12 lg:grid-cols-2">
    <Card className="space-y-5" aria-label="Configuração e regras">
      <Heading variant="section">Configuração</Heading>
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field className="grid-cols-[auto_minmax(0,max-content)] items-center justify-between gap-4">Versão<Select className="max-w-full" aria-label="Versão do Flip7" value={settings.mode} onChange={e=>void configure({mode:e.target.value as GameOptions["mode"],brutal:false},limit)}><option value="classic">Clássico</option><option value="vengeance">A vingança nunca é plena</option></Select></Field>
        {settings.mode==="vengeance" && <Field className="grid-cols-[1fr_auto] items-center">Modo Brutal<Switch aria-label="Modo Brutal" checked={settings.brutal} onCheckedChange={brutal=>void configure({...settings,brutal},limit)}/></Field>}
      </fieldset>
      {rules(settings)}
    </Card>
    <Card className="space-y-5" aria-label="Jogadores e vagas">
      <fieldset disabled={!canEdit}>
        <Field className="grid-cols-[1fr_auto] items-center gap-4">Número de jogadores<Select className="w-20" aria-label="Número de jogadores" value={limit} onChange={e=>void configure(settings,Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(n=><option key={n} value={n} disabled={n<occupied}>{n}</option>)}</Select></Field>
      </fieldset>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5" aria-label="Vagas da sala">
        {Array.from({length:limit},(_,i)=>{
          const person=seats[i];
          const waiting=!!person && !!room && (!room.participants.some(p=>p.userId===person.userId) || !room.onlineUserIds.includes(person.userId));
          const preview=!room && i===0;
          const name=person?.username ?? (preview?username ?? "Você":null);
          const isHost=(person && person.userId===room?.hostId) || preview;
          const next=i===occupied;
          const placeholder=<UserRound className="size-6 text-muted" aria-hidden="true"/>;
          return <li key={person?.userId ?? "seat-"+i} className={cn("relative flex min-w-0 flex-col items-center gap-2",waiting && "opacity-40")}>
            <div className="relative">
              {name?<Avatar className="size-16"><AvatarImage src={person?.avatarUrl ?? (preview?avatar ?? undefined:undefined)}/><AvatarFallback className="text-lg">{name[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
                :next && (!room || host)?<Button variant="ghost" size="icon" className="size-16 rounded-full! border border-dashed border-field-border p-0" aria-label="Convidar jogadores" disabled={busy || (!!room && !connected)} onClick={async()=>{
                  if(!userId){openLogin();return;}
                  if(room){setInviting(true);return;}
                  const created=await create(true);if(created)setInviting(true);
                }}><Plus className="size-6" aria-hidden="true"/></Button>
                :<span className="flex size-16 items-center justify-center rounded-full border border-dashed border-field-border">{placeholder}</span>}
              {isHost && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-brand" title="Host"><Crown className="size-4" aria-label="Host"/></span>}
            </div>
            <span className={cn("w-full truncate text-center text-xs font-medium",isHost?"text-brand":!name && "text-muted")} title={waiting?`${name} · Aguardando entrada`:name ?? undefined}>{name ?? "Disponível"}</span>
            {room && host && person && person.userId!==userId && <KickPlayer code={room.code} version={room.version} userId={person.userId} name={person.username} compact disabled={busy || !connected} onSuccess={response=>{if(response.status==="lobby")acceptLobby(response);}}/>}
          </li>;
        })}
      </ul>
      {room && host && <InvitePlayers key={room.code} code={room.code} open={inviting} onOpenChange={open=>{setInviting(open);if(!open && searchParams.has("convidar"))router.replace("/jogos/flip7?partida="+room.code,{scroll:false});}}/>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {!room?<Button className="w-full" loading={busy} disabled={!!directory.current} onClick={()=>void create()}>{userId?"Jogar":"Entrar para jogar"}</Button>
          :!member?<Button className="w-full" loading={busy} disabled={busy || !connected || occupied>=room.capacity && !room.pendingInvitations.some(p=>p.userId===userId) || !!directory.current} onClick={()=>void act(room,"join")}>Entrar na sala</Button>
          :<div className="flex items-center gap-3">
            <Button className="min-w-0 flex-1" loading={busy} disabled={busy || !connected || !host || room.participants.length<2 || !allOnline} onClick={()=>void act(room,"start")}>{host?"Jogar":"Aguardando o host"}</Button>
            <Button className="shrink-0" variant="secondary" disabled={busy} onClick={()=>void act(room,"leave")}>Cancelar</Button>
          </div>}
        {room && host && connected && !allOnline && <p className="text-sm text-muted" role="status">Aguardando todos os convidados entrarem na sala.</p>}
        {room && !connected && <p className="text-sm text-muted" role="status">Reconectando à sala…</p>}
      </div>
    </Card>
    <section className="space-y-5 lg:col-span-2" aria-label="Lobbies abertos">
      <Heading variant="section">Lobbies abertos</Heading>
      {!userId?<p className="text-sm text-muted">Entre na sua conta para ver as salas.</p>:<>
        {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
        {directory.items.length===0?<p className="text-sm text-muted">Nenhum lobby aberto por enquanto.</p>:<ul className="grid gap-4 sm:grid-cols-2">{directory.items.map(lobby=>{
          const joined=lobby.participants.some(p=>p.userId===userId);
          return <li key={lobby.code}><Card className="h-full space-y-5">
            <div><p className="truncate text-sm font-semibold">Sala de {lobby.participants.find(p=>p.userId===lobby.hostId)?.username}</p><p className="mt-1 text-xs text-muted">{modeLabel(lobby.options)} · {lobby.participants.length+lobby.pendingInvitations.length}/{lobby.capacity} jogadores</p></div>
            <ul className="flex flex-wrap gap-3" aria-label="Jogadores do lobby">{[...lobby.participants,...lobby.pendingInvitations].map(person=><li key={person.userId} className={cn("flex w-14 min-w-0 flex-col items-center gap-2",(!lobby.participants.some(p=>p.userId===person.userId) || !lobby.onlineUserIds.includes(person.userId)) && "opacity-40")}>
              <Avatar className="size-11"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{person.username[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
              <span title={person.username} className={cn("w-full truncate text-center text-xs",person.userId===lobby.hostId && "text-brand")}>{person.username}</span>
            </li>)}</ul>
            {joined?<Button className="w-full" size="sm" variant="secondary" onClick={()=>visit(lobby.code)}>Voltar ao lobby</Button>:<Button className="w-full" size="sm" variant="secondary" loading={busy} disabled={busy || !connected || !!directory.current || lobby.participants.length+lobby.pendingInvitations.length>=lobby.capacity && !lobby.pendingInvitations.some(p=>p.userId===userId)} onClick={()=>void act(lobby,"join")}>{lobby.participants.length+lobby.pendingInvitations.length>=lobby.capacity && !lobby.pendingInvitations.some(p=>p.userId===userId)?"Lotado":"Entrar"}</Button>}
          </Card></li>;
        })}</ul>}
      </>}
    </section>
    {initial.items.length>0 && <Card className="space-y-4 lg:col-span-2" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="divide-y divide-contrast/6">{initial.items.map(match=><li key={match.code} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{modeLabel(match.options)} · Rodada {match.state.round} · {match.participants.length} jogadores</span><Button size="sm" variant="secondary" onClick={()=>visit(match.code)}>Continuar partida</Button></li>)}</ul></Card>}
  </div>;
}
