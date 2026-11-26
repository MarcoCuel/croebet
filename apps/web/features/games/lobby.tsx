"use client";
import { gameUrl } from "./game-url";
import { MatchExitControl } from "./match-cancellation";
import { managementRequest } from "@/features/admin/management-api";
import { randomUUID } from "@/lib/uuid";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Eye, Plus, UserRound } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getGameDefinition, gameIdSchema, gameOptionsSchema, visibleSettings, settingValue, gameSettingBadges, commandResultSchema, maxGamePlayers, gameOptionsForPlayers } from "@croebet/shared";
import type { GameRecord, CreateMatch, Lobby, LobbyList, GameRoomSync, UpdateLobby } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { CroinIcon } from "@/components/shared/croin-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { BetInput } from "@/components/ui/bet-input";
import { formatBalance } from "@/features/wallet/wallet";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
type LobbyInitial={lobby:Lobby|null;directory:LobbyList;items:import("@croebet/shared").MatchSummary[];error:string;revision?:string;match?:unknown;unavailable?:boolean};
import { createServerMatch, changeLobby, updateServerLobby, confirmServerEntry } from "./match-api";
import { useRoomLive } from "./use-room-live";
import { InvitePlayers } from "./invite-players";
import { KickPlayer } from "./kick-player";
import { GameEntryHeader } from "./game-entry-header";
import { playerName } from "./player-name";
import { readGamePreferences, saveGamePreferences } from "./setup-storage";

const subscribeToHydration=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;

function SeatOutline() {
  return <svg className="pointer-events-none absolute inset-0 size-full text-contrast/20" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="31.5" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"/>
  </svg>;
}

export function LobbyScreen({initial,rules,onStarted,game,development=false,onTestOpen,onTestStarted}:{development?:boolean;onTestOpen?:(lobby:Lobby)=>void;onTestStarted?:(code:string)=>void;initial:LobbyInitial;game:GameRecord;onStarted?:(sync:GameRoomSync)=>void;rules?:(options:Lobby["options"])=>ReactNode}) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const {permissions,userId,username,displayName,avatar,openLogin,economy}=useSession();
  const scopeDirectory=(next:LobbyList):LobbyList=>({...next,
    owned:(next.ownedLobbies ?? (next.owned?[next.owned]:[])).find(l=>l.game===(game.moduleId ?? game.slug)) ?? null,
    active:next.active?.game===(game.moduleId ?? game.slug)?next.active:null,
  });
  const [room,setRoom]=useState<Lobby|null>(initial.lobby?.game===(game.moduleId ?? game.slug)?initial.lobby:null);
  const [directory,setDirectory]=useState<LobbyList>(()=>scopeDirectory(initial.directory));
  const [matches,setMatches]=useState(initial.items);
  const definition=getGameDefinition(game.moduleId ?? game.slug)!;
  const hydrated=useSyncExternalStore(subscribeToHydration,clientSnapshot,serverSnapshot);
  const gameId=game.moduleId ?? game.slug;
  const preferences=useMemo(()=>hydrated?readGamePreferences(gameId):{count:definition.minPlayers,options:gameOptionsSchema.parse(definition.defaults)},[hydrated,gameId,definition]);
  const [chosenCapacity,setCapacity]=useState<number>();
  const capacity=chosenCapacity ?? preferences.count;
  const [bots,setBots]=useState(0);
  const [onlyBots,setOnlyBots]=useState(false);
  const [chosenOptions,setOptions]=useState<Lobby["options"]>();
  const options=chosenOptions ?? preferences.options;
  const [entryAmount,setEntryAmount]=useState(0);
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
    window.history.replaceState(null,"",gameUrl(game.slug,{code,development:development && permissions.canManageSite,invite}));
  };
  const openMatch=(code:string)=>{
    if(searchParams.get("partida")===code){
      if(refreshed.current!==code){refreshed.current=code;router.refresh();}
    }
    else router.replace(gameUrl(game.slug,{code,development:development && permissions.canManageSite}),{scroll:false});
  };
  function acceptLobby(next:Lobby){
    setRoom(current=>current?.code===next.code && current.version>next.version?current:next);
    onTestOpen?.(next);
  }
  function accept(next:GameRoomSync){
    if(leaving.current || navigating.current)return;
    if(next.room.status==="lobby"){
      if(room?.participants.some(person=>person.userId===userId) && !next.room.participants.some(person=>person.userId===userId)){
        setRoom(null);visit(null);return;
      }
      acceptLobby(next.room);return;
    }
    if(development){onTestStarted?.(next.room.code);return;}
    navigating.current=true;
    if(next.room.status==="abandoned"){setRoom(null);setDirectory(current=>({...current,owned:current.owned?.code===next.room.code?null:current.owned,joined:current.joined.filter(lobby=>lobby.code!==next.room.code)}));visit(null);return;}
    onStarted?.(next);openMatch(next.room.code);
  }
  function acceptDirectory(next:LobbyList){
    next=scopeDirectory(next);
    setDirectory(next);
    if(development)return;
    if(next.active && !navigating.current){
      navigating.current=true;openMatch(next.active.code);return;
    }
  }
  useEffect(()=>{
    // Returning to a lobby URL can reuse the pre-start RSC entry. Refresh once
    // after the URL changes so a cached lobby cannot trap an active player.
    if(!development && directory.active && (!navigating.current || searchParams.get("partida")===directory.active.code)){
      navigating.current=true;openMatch(directory.active.code);
    }
    else if(!development && directory.owned && !room && !leaving.current && !navigating.current && !searchParams.get("partida")){
      acceptLobby(directory.owned);visit(directory.owned.code);
    }
  });
  const connected=useRoomLive(room?.code,room?.version ?? 0,true,accept,acceptDirectory,(message,roomClosed)=>{
    if(leaving.current || navigating.current)return;
    setError(message);
    if(room && roomClosed){
      setRoom(null);
      setDirectory(current=>({...current,owned:current.owned?.code===room.code?null:current.owned,joined:current.joined.filter(lobby=>lobby.code!==room.code),items:current.items.filter(lobby=>lobby.code!==room.code)}));
      visit(null);
    }
  },development?()=>{}:setMatches,()=>setError(""));
  const lobbies=[...new Map((development?(directory.testLobbies ?? []).filter(l=>l.game===(game.moduleId ?? game.slug)):[...directory.items,...directory.joined].filter(l=>l.game===(game.moduleId ?? game.slug))).map(lobby=>[lobby.id,lobby])).values()];
  const listedMatches=matches.filter(match=>match.game===(game.moduleId ?? game.slug));
  const listedRooms=development?[...lobbies,...(directory.testMatches ?? []).filter(m=>m.game===(game.moduleId ?? game.slug))]:lobbies;
  const creationBlocked=!development && (!!directory.owned || !!directory.active);
  const host=room?.hostId===userId;
  const member=!!room?.participants.some(person=>person.userId===userId);
  const settings=gameOptionsSchema.parse(definition.options.parse(room?.options ?? options));
  const limit=room?.capacity ?? capacity;
  const entry=development?0:room?.entryAmount ?? entryAmount;
  const confirmed=!!userId && !!room?.confirmedUserIds.includes(userId);
  const allConfirmed=!entry || !!room?.participants.every(p=>room.confirmedUserIds.includes(p.userId));
  const seats=room?[...room.participants,...room.pendingInvitations]:[];
  const occupied=room?seats.length+room.bots:(onlyBots?0:1)+bots;
  const allOnline=!!room && room.pendingInvitations.length===0 && room.participants.every(p=>room.onlineUserIds.includes(p.userId));
  const editableSettings=!!userId && (!development || permissions.canManageSite) && (!room || host);
  const showSettings=editableSettings || !!room;
  const canEdit=editableSettings && !busy && (!room || connected);

  function rememberChoice(choice:Partial<Lobby["options"] & {count:number}>){
    if(!Object.keys(choice).length)return;
    if(choice.count!==undefined)setCapacity(choice.count);
    const {count:chosenCount,...changed}=choice;
    const nextOptions=gameOptionsSchema.parse(definition.options.parse({...options,...changed}));
    setOptions(nextOptions);
    try{saveGamePreferences(game.moduleId ?? game.slug,chosenCount ?? capacity,nextOptions);}catch{/* Preferences are optional. */}
  }
  async function configure(nextOptions:Lobby["options"],nextCapacity:number,nextEntry=entry,choice:Partial<Lobby["options"] & {count:number}>={}){
    if(!canEdit)return;
    if(!room){setBots(n=>Math.min(n,nextCapacity-(onlyBots?0:1)));setOptions(nextOptions);setCapacity(nextCapacity);setEntryAmount(nextEntry);rememberChoice(choice);return;}
    setBusy(true);setError("");
    const payload={capacity:nextCapacity,options:nextOptions,entryAmount:nextEntry,expectedVersion:room.version};
    if(!pendingUpdate.current || JSON.stringify({...pendingUpdate.current,commandId:undefined})!==JSON.stringify(payload))pendingUpdate.current={...payload,commandId:randomUUID()};
    try{
      const response=await updateServerLobby(room.code,pendingUpdate.current);
      pendingUpdate.current=null;
      if(response.status==="lobby"){
        acceptLobby(response);rememberChoice(choice);
      }
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar a sala.");}
    finally{setBusy(false);}
  }
  async function confirmEntry(){
    if(!room || busy || !entry)return;
    setBusy(true);setError("");
    try{
      const response=await confirmServerEntry(room.code,{commandId:randomUUID(),expectedVersion:room.version,entryAmount:entry});
      if(response.status==="lobby")acceptLobby(response);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível confirmar a entrada.");}
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
      if(development && action==="start"){onTestStarted?.(lobby.code);return;}
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
    if(!userId || !connected || !room || room.code!==code || member || (host && room.onlyBots) || busy || leaving.current)return;
    const key=userId+":"+code;
    if(autoJoin.current===key)return;
    autoJoin.current=key;
    void act(room,"join");
  });
  async function cancelTest(code:string){
    if(busy)return;setBusy(true);setError("");
    try{const current=await managementRequest(`/matches/${code}`,{parse:(v:unknown)=>v as {version:number}});await managementRequest(`/matches/${code}/end-test`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:current.version});if(room?.code===code){setRoom(null);visit(null);}}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível cancelar a partida.");throw e;}finally{setBusy(false);}
  }
  async function create(invite=false){
    if(busy || creationBlocked)return;
    if(!userId){openLogin();return;}
    leaving.current=false;
    setBusy(true);setError("");
    const payload={development,bots,onlyBots,game:gameIdSchema.parse(game.moduleId ?? game.slug),capacity,options,entryAmount:development?0:room?.entryAmount ?? entryAmount};
    if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:randomUUID()};
    try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;acceptLobby(lobby);visit(lobby.code,invite);return lobby;}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}
    finally{setBusy(false);}
  }

  return <div className="w-full space-y-4">
    <GameEntryHeader game={game} development={development} actions={!userId?rules?.(settings):undefined}/>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
    {showSettings && <Card className="min-w-0 space-y-4" aria-label="Configuração e regras">
      {editableSettings?<fieldset disabled={!canEdit} className="space-y-4">
        {visibleSettings(definition,settings).map(field=>{
          const value=settingValue(settings,field.key);
          const change=(value:string|boolean)=>{
            const choice={...field.reset,[field.key]:value};
            const next=gameOptionsSchema.parse(definition.options.parse({...settings,...choice}));
            void configure(next,Math.min(limit,definition.maxPlayers(next)),entry,{...choice,count:Math.min(limit,definition.maxPlayers(next))});
          };
          return <Field key={field.key} className="grid-cols-[auto_minmax(0,max-content)] items-center justify-between gap-4">{field.label}{field.type==="select"?<Select className="max-w-full" aria-label={field.ariaLabel ?? field.label} value={String(value)} onChange={e=>change(e.target.value)}>{field.choices?.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</Select>:<Switch aria-label={field.label} checked={value===true} onCheckedChange={change}/>}</Field>;
        })}
        {!development && definition.croins && <div className="min-w-0 space-y-4 rounded-xl bg-contrast/6 p-4" role="group" aria-label="Aposta da partida">
          <Field className="grid-cols-[1fr_auto] items-center gap-3">Jogar apostando<Switch aria-label="Jogar apostando" checked={entry>0} disabled={!economy && !entry} onCheckedChange={enabled=>{if(!enabled || economy)void configure(settings,limit,enabled?economy!.defaultBet:0);}}/></Field>
          {entry>0 && <BetInput label="Entrada por jogador" value={entry} presets={economy?.suggestedBets ?? []} disabled={!canEdit} onValueChange={amount=>void configure(settings,limit,amount)}/>}
        </div>}
        {development && !room && <><Field>Bots<Select value={bots} onChange={e=>setBots(Number(e.target.value))}>{Array.from({length:limit+(onlyBots?1:0)},(_,i)=>i).filter(n=>!onlyBots || n>=2).map(n=><option key={n}>{n}</option>)}</Select></Field><Field className="flex items-center justify-between">Somente bots<Switch checked={onlyBots} onCheckedChange={v=>{setOnlyBots(v);setBots(v?limit:0);}}/></Field></>}
      </fieldset>:<div className="space-y-4 text-sm font-semibold">
        {visibleSettings(definition,settings).map(field=><div key={field.key} className="flex min-h-11 items-center justify-between gap-4"><span>{field.label}</span><span className="text-right">{field.type==="switch"?(settingValue(settings,field.key)?"Ativado":"Desativado"):field.choices?.find(choice=>choice.value===settingValue(settings,field.key))?.label}</span></div>)}
        {!development && definition.croins && <div className="space-y-4 rounded-xl bg-contrast/6 p-4" role="group" aria-label="Aposta da partida">
          <div className="flex items-center justify-between gap-3"><span>Jogar apostando</span><span>{entry>0?"Sim":"Não"}</span></div>
          {entry>0 && <div className="flex items-center justify-between gap-3"><span>Entrada por jogador</span><span className="flex items-center gap-2"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(entry)} Croins</span></div>}
        </div>}
      </div>}
      {rules?.(settings)}
    </Card>}
    {((userId && (!development || permissions.canManageSite)) || room) && <Card className="min-w-0 space-y-4" aria-label="Jogadores e vagas">
      {editableSettings?<fieldset disabled={!canEdit}>
        <Field className="grid-cols-[1fr_auto] items-center gap-4">Número de jogadores<Select className="w-20" aria-label="Número de jogadores" value={limit} onChange={e=>{
          const count=Number(e.target.value),next=gameOptionsForPlayers(definition,settings,count);
          void configure(next,count,entry,{...next,count});
        }}>{Array.from({length:maxGamePlayers(definition,settings)-definition.minPlayers+1},(_,i)=>i+definition.minPlayers).map(n=><option key={n} value={n}>{n}</option>)}</Select></Field>
      </fieldset>:<div className="flex min-h-11 items-center justify-between gap-4 text-sm font-semibold"><span>Número de jogadores</span><span>{limit}</span></div>}
      {entry>0 && <div className="flex items-center justify-between gap-4 rounded-lg bg-contrast/6 p-3 text-sm mb-8"><span>Prêmio (Pote)</span><span className="flex items-center gap-2 tabular-nums"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(BigInt(entry)*BigInt(room?.participants.length ?? 1))} Croins</span></div>}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-x-3 gap-y-5" aria-label="Vagas da sala">
        {Array.from({length:limit},(_,i)=>{
          const person=seats[i];
          const waiting=!!person && !!room && (!room.participants.some(p=>p.userId===person.userId) || (person.userId!==userId && !room.onlineUserIds.includes(person.userId)));
          const preview=!room && !onlyBots && i===0;
          const botSeat=room?i>=seats.length && i<seats.length+room.bots:i>=(onlyBots?0:1) && i<occupied;
          const name=person ? playerName(person) : (botSeat?`Bot ${i+1}`:preview?displayName?.trim() || username || "Você":null);
          const isHost=(person && person.userId===room?.hostId) || preview;
          const next=i===occupied;
          const placeholder=<UserRound className="size-6 text-muted" aria-hidden="true"/>;
          return <li key={person?.userId ?? (preview?userId:undefined) ?? "seat-"+i} className={cn("relative flex min-w-0 flex-col items-center gap-2",waiting && "opacity-40")}>
            <div className="relative">
              {name?<Avatar className="size-16"><AvatarImage src={person?.avatarUrl ?? (preview?avatar ?? undefined:undefined)}/><AvatarFallback className="text-lg">{name[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
                :next && (!room || host) && !(room?.onlyBots ?? onlyBots)?<Button variant="ghost" size="icon" className="relative size-16 rounded-full! border-0 p-0" aria-label="Convidar jogadores" disabled={busy || (!!userId && !connected)} onClick={async()=>{
                  if(!userId){openLogin();return;}
                  if(room){setInviting(true);return;}
                  const created=await create(true);if(created)setInviting(true);
                }}><SeatOutline/><Plus className="size-6" aria-hidden="true"/></Button>
                :<span className="relative flex size-16 items-center justify-center rounded-full"><SeatOutline/>{placeholder}</span>}
              {isHost && <span className="absolute -top-3 -left-1" title="Host"><Image src="/host.svg" width={25} height={24} className="h-6 w-auto" alt="Host"/></span>}
            </div>
            <span className={cn("w-full truncate text-center text-xs font-medium",isHost?"text-brand":!name && "text-muted")} title={waiting?`${name} · Aguardando entrada`:name ?? undefined}>{name ?? "Disponível"}</span>
            {entry>0 && person && room?.participants.some(p=>p.userId===person.userId) && <span className="text-center text-xs text-muted">{room.confirmedUserIds.includes(person.userId)?"Confirmado":"A confirmar"}</span>}
            {room && host && person && person.userId!==userId && <KickPlayer code={room.code} version={room.version} userId={person.userId} name={playerName(person)} compact disabled={busy || !connected} onSuccess={response=>{if(response.status==="lobby")acceptLobby(response);}}/>}
          </li>;
        })}
      </ul>
      {room && host && <InvitePlayers key={room.code} gameSlug={game.slug} code={room.code} open={inviting} onOpenChange={open=>{setInviting(open);if(!open && searchParams.has("convidar"))visit(room.code);}}/>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {room && member && entry>0 && !confirmed && <Button className="w-full" variant="secondary" loading={busy} disabled={busy || !connected} onClick={()=>void confirmEntry()}>Confirmar entrada de {formatBalance.format(entry)} Croins</Button>}
        {!room?<Button className="w-full bg-tertiary text-white" loading={busy} disabled={creationBlocked || (!!userId && !connected)} onClick={()=>void create()}>{userId?"Jogar":"Entrar para jogar"}</Button>
          :!member && !host?<Button className="w-full" loading={busy} disabled={busy || !connected || occupied>=room.capacity && !room.pendingInvitations.some(p=>p.userId===userId) || (!development && !!directory.active)} onClick={()=>void act(room,"join")}>Entrar na sala</Button>
          :<div className="flex items-center gap-3">
            <Button className="min-w-0 flex-1 bg-tertiary text-white" loading={busy} disabled={busy || !connected || !host || room.participants.length+room.bots<2 || !allOnline || !allConfirmed} onClick={()=>void act(room,"start")}>{host?"Jogar":"Aguardando o host"}</Button>
            <Button className="shrink-0" variant="secondary" disabled={busy || !connected} onClick={()=>void act(room,"leave")}>Cancelar</Button>
          </div>}
        {room && host && entry>0 && !allConfirmed && <p className="text-sm text-muted" role="status">Aguardando todos confirmarem o valor da entrada.</p>}
        {room && host && connected && !allOnline && <p className="text-sm text-muted" role="status">Aguardando todos os convidados entrarem na sala.</p>}
        {room && !connected && <p className="text-sm text-muted" role="status">Reconectando à sala…</p>}
        {userId && room && !creationBlocked && <Button className="w-full" variant="secondary" disabled={busy || !connected} onClick={()=>void create()}>Criar meu lobby</Button>}
      </div>
    </Card>}
    <section className={cn("min-w-0 space-y-4",development && "rounded-panel bg-surface p-4",!showSettings && (userId || room?"xl:col-span-2":"xl:col-span-3"))} aria-label="Lobbies abertos">
      <>
        {development && <p className="text-sm font-medium">Partidas de teste</p>}
        {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
        {listedRooms.length===0?connected && <EmptyState title="Nenhum lobby aberto por enquanto." icon={<UserRound className="size-6" />} className="rounded-panel bg-surface" />:<ul className="grid gap-4">{listedRooms.map(lobby=>{
          const active=lobby.status==="playing";
          const people=[...lobby.participants,...(lobby.status==="lobby"?lobby.pendingInvitations:[]),...Array.from({length:lobby.bots},(_,i)=>({userId:`bot-${i}`,username:`Bot ${i+1}`,displayName:`Bot ${i+1}`,avatarUrl:null,seat:lobby.participants.length+i}))];
          const hostName=lobby.participants.some(p=>p.userId===lobby.hostId)?playerName(lobby.participants.find(p=>p.userId===lobby.hostId)):lobby.hostId===userId?(displayName || username || "Você"):"Administrador";
          const joined=(development && lobby.hostId===userId) || lobby.participants.some(p=>p.userId===userId);
          const reserved=lobby.status==="lobby" && lobby.pendingInvitations.some(p=>p.userId===userId);
          const canCancel=development && permissions.canManageSite && lobby.hostId===userId;
          return <li key={lobby.code}><Card className={cn("relative isolate h-full space-y-4",development && "bg-transparent p-0")}>
            <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 truncate text-sm font-semibold">Sala de {hostName}</p>{active && <Badge variant="secondary">Em andamento</Badge>}{gameSettingBadges(definition,lobby.options).map(badge=><Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}{lobby.entryAmount>0 && <Badge variant="secondary" className="gap-1.5"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(lobby.entryAmount)} Croins</Badge>}</div>
            <ul className="flex flex-wrap gap-x-3 gap-y-4" aria-label="Vagas do lobby">{Array.from({length:lobby.capacity},(_,i)=>{
              const person=people[i];
              return <li key={person?.userId ?? i} className={cn("flex w-14 min-w-0 flex-col items-center gap-2",lobby.status==="lobby" && person && !person.userId.startsWith("bot-") && (!lobby.participants.some(p=>p.userId===person.userId) || !lobby.onlineUserIds.includes(person.userId)) && "opacity-40")}>
                {person?<span className="relative size-11 shrink-0"><Avatar className="size-11"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{playerName(person)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>{person.userId===lobby.hostId && <span className="absolute -top-2 -left-1" title="Host"><Image src="/host.svg" width={21} height={20} className="h-5 w-auto" alt="Host"/></span>}</span>:active?<span className="relative flex size-11 items-center justify-center rounded-full"><SeatOutline/><UserRound className="size-4 text-muted"/></span>:<Button variant="ghost" size="icon" className="relative size-11 rounded-full! border-0 p-0" aria-label={`Entrar na sala de ${hostName}, vaga ${i+1}`} disabled={busy || !connected || joined || (!development && !!directory.active)} onClick={()=>{if(lobby.status==="lobby")void act(lobby,"join");}}><SeatOutline/><Plus className="size-4" aria-hidden="true"/></Button>}
                <span title={person ? playerName(person) : undefined} className={cn("w-full truncate text-center text-xs",person?.userId===lobby.hostId?"text-brand":!person && "text-muted")}>{person ? playerName(person) : "Disponível"}</span>
              </li>;
            })}</ul>
            {(active || canCancel || (reserved && !joined)) && <div className="relative z-20 flex flex-wrap gap-2">{active && <Button size="sm" variant="secondary" onClick={()=>onTestStarted?.(lobby.code)}><Eye className="size-4" aria-hidden="true"/>Visualizar</Button>}{canCancel && <MatchExitControl label="Cancelar" match={lobby} onIndividual={active && !lobby.onlyBots?async()=>{await managementRequest(`/matches/${lobby.code}/abandon`,{parse:(v:unknown)=>v},"POST",{commandId:randomUUID(),expectedVersion:lobby.version});}:undefined} onEndTest={()=>cancelTest(lobby.code)}/>}
            {reserved && !joined && <Button size="sm" variant="secondary" disabled={busy || !connected || (!development && !!directory.active)} onClick={()=>{if(lobby.status==="lobby")void act(lobby,"join");}}>Aceitar convite</Button>}</div>}

            {joined && lobby.status==="lobby" && <Button variant="ghost" className="backdrop-blur-none absolute inset-0 z-10 size-full rounded-panel m-0! p-0" aria-label={`Abrir sala de ${hostName}`} disabled={busy} onClick={()=>{acceptLobby(lobby);visit(lobby.code);}}/>}
          </Card></li>;
        })}</ul>}
      </>
    </section>
    {listedMatches.length>0 && <section className="min-w-0 space-y-4 xl:col-span-3" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{listedMatches.map(match=>{
      const playing=!!userId && match.controllerIds.includes(userId);
      return <li key={match.code}><Card className="space-y-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Sala de {playerName(match.participants.find(p=>p.userId===match.hostId))}</p>{gameSettingBadges(definition,match.options).map(badge=><Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}{match.entryAmount>0 && <Badge variant="secondary" className="gap-1.5"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(match.entryAmount)} Croins</Badge>}</div><p className="text-xs text-muted">Rodada {match.round} · {match.participants.length} jogadores</p><Button size="sm" variant="secondary" onClick={()=>openMatch(match.code)}><Eye className="size-4" aria-hidden="true"/>{playing?"Continuar partida":"Visualizar"}</Button></Card></li>;
    })}</ul></section>}
    </div>
    {!userId && !room && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
