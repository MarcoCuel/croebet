"use client";
import { gameUrl } from "./game-url";
import { MatchExitControl } from "./match-cancellation";
import { managementRequest } from "@/features/admin/management-api";
import { randomUUID } from "@/lib/uuid";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Eye, Plus, UserRound, UsersRound } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getGameDefinition, gameIdSchema, gameOptionsSchema, gameSettingBadges, commandResultSchema } from "@croebet/shared";
import type { GameRecord, CreateMatch, Lobby, LobbyList, GameRoomSync, UpdateLobby, Ranking } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { CroinIcon } from "@/components/shared/croin-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBalance } from "@/features/wallet/wallet";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
type LobbyInitial={lobby:Lobby|null;directory:LobbyList;items:import("@croebet/shared").MatchSummary[];error:string;revision?:string;match?:unknown;unavailable?:boolean};
import { createServerMatch, changeLobby, updateServerLobby, confirmServerEntry } from "./match-api";
import { useRoomLive } from "./use-room-live";
import { InvitePlayers } from "./invite-players";
import { KickPlayer } from "./kick-player";
import { LobbyAside } from "./lobby-aside";
import { LobbyCreateDialog } from "./lobby-create";
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

export function LobbyScreen({initial,rules,onStarted,game,development=false,onTestOpen,onTestStarted,ranking=null}:{development?:boolean;onTestOpen?:(lobby:Lobby)=>void;onTestStarted?:(code:string)=>void;initial:LobbyInitial;game:GameRecord;onStarted?:(sync:GameRoomSync)=>void;rules?:(options:Lobby["options"])=>ReactNode;ranking?:Ranking|null}) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const {permissions,userId,username,displayName,openLogin,economy}=useSession();
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
  const [setup,setSetup]=useState<"create"|"edit"|null>(null);
  const [editCode,setEditCode]=useState<string|null>(null);
  const [inviteCode,setInviteCode]=useState<string|null>(null);
  const [error,setError]=useState(initial.error);
  const pendingCreate=useRef<CreateMatch|null>(null);
  const pendingUpdate=useRef<UpdateLobby|null>(null);
  const pending=useRef<{key:string;id:string;version?:number}|null>(null);
  const navigating=useRef(false);
  const refreshed=useRef<string|null>(null);
  const leaving=useRef(false);
  const visit=(code:string|null)=>{
    if(!code)navigating.current=false;
    window.history.replaceState(null,"",gameUrl(game.slug,{code,development:development && permissions.canManageSite}));
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
  const newSettings=gameOptionsSchema.parse(definition.options.parse(options));
  // "Jogar" starts the account's own room, even while another card is selected.
  const editableRoom=development?(room && host?room:null):(directory.owned ?? (room && host?room:null));
  const startReady=!!editableRoom && editableRoom.participants.length+editableRoom.bots>=2 && editableRoom.pendingInvitations.length===0 && editableRoom.participants.every(p=>editableRoom.onlineUserIds.includes(p.userId)) && (editableRoom.entryAmount===0 || editableRoom.participants.every(p=>editableRoom.confirmedUserIds.includes(p.userId)));
  const playDisabled=busy || !connected || (editableRoom ? !startReady : creationBlocked);

  function rememberChoice(choice:Partial<Lobby["options"] & {count:number}>){
    if(!Object.keys(choice).length)return;
    if(choice.count!==undefined)setCapacity(choice.count);
    const {count:chosenCount,...changed}=choice;
    const nextOptions=gameOptionsSchema.parse(definition.options.parse({...options,...changed}));
    setOptions(nextOptions);
    try{saveGamePreferences(game.moduleId ?? game.slug,chosenCount ?? capacity,nextOptions);}catch{/* Preferences are optional. */}
  }
  async function configure(nextOptions:Lobby["options"],nextCapacity:number,nextEntry:number,choice:Partial<Lobby["options"] & {count:number}>={}){
    const editRoom=editCode?listedRooms.find((lobby):lobby is Lobby=>lobby.status==="lobby" && lobby.code===editCode) ?? null:null;
    if(!editRoom || busy || !connected)return;
    setBusy(true);setError("");
    const payload={capacity:nextCapacity,options:nextOptions,entryAmount:nextEntry,expectedVersion:editRoom.version};
    if(!pendingUpdate.current || JSON.stringify({...pendingUpdate.current,commandId:undefined})!==JSON.stringify(payload))pendingUpdate.current={...payload,commandId:randomUUID()};
    try{
      const response=await updateServerLobby(editRoom.code,pendingUpdate.current);
      pendingUpdate.current=null;
      if(response.status==="lobby"){
        acceptLobby(response);rememberChoice(choice);
      }
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar a sala.");}
    finally{setBusy(false);}
  }
  // Creation settings are always local, even when another room is on screen.
  function configureNew(nextOptions:Lobby["options"],nextCapacity:number,nextEntry:number,choice:Partial<Lobby["options"] & {count:number}>={}){
    setBots(n=>Math.min(n,nextCapacity-(onlyBots?0:1)));
    setOptions(nextOptions);
    setCapacity(nextCapacity);
    setEntryAmount(nextEntry);
    rememberChoice(choice);
  }
  async function confirmEntry(lobby:Lobby){
    if(busy || !lobby.entryAmount)return;
    setBusy(true);setError("");
    try{
      const response=await confirmServerEntry(lobby.code,{commandId:randomUUID(),expectedVersion:lobby.version,entryAmount:lobby.entryAmount});
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
        const current=room?.code===lobby.code;
        setRoom(room=>room?.code===lobby.code?null:room);
        setDirectory(current=>({...current,owned:current.owned?.code===lobby.code?null:current.owned,joined:current.joined.filter(room=>room.code!==lobby.code)}));
        if(current)visit(null);
        leaving.current=false;
      }else if(response.status==="lobby"){
        acceptLobby(response);
        if(action==="join")visit(response.code);
      }
      // The watched room presents the initial deal after the host starts. When
      // the host starts another own room, navigate directly.
      if(action==="start" && !development && response.status==="started" && room?.code!==lobby.code){navigating.current=true;openMatch(lobby.code);}
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
  function openCreate(){
    if(busy)return;
    if(!userId){openLogin();return;}
    if(creationBlocked)return;
    setError("");
    setSetup("create");
  }
  function openEdit(lobby:Lobby){
    if(busy || lobby.hostId!==userId)return;
    setError("");
    setEditCode(lobby.code);
    setSetup("edit");
  }
  function play(){
    if(busy)return;
    if(!userId){openLogin();return;}
    if(editableRoom){if(startReady)void act(editableRoom,"start");return;}
    openCreate();
  }
  async function create(){
    if(busy || creationBlocked)return;
    if(!userId){openLogin();return;}
    leaving.current=false;
    setBusy(true);setError("");
    const payload={development,bots,onlyBots,game:gameIdSchema.parse(game.moduleId ?? game.slug),capacity,options,entryAmount:development?0:entryAmount};
    if(!pendingCreate.current || JSON.stringify({...pendingCreate.current,requestId:undefined})!==JSON.stringify(payload))pendingCreate.current={...payload,requestId:randomUUID()};
    try{const lobby=await createServerMatch(pendingCreate.current);pendingCreate.current=null;setSetup(null);acceptLobby(lobby);visit(lobby.code);return lobby;}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a sala.");}
    finally{setBusy(false);}
  }

  const rooms=<section className="min-w-0 space-y-4" aria-label="Lobbies abertos">
    <>
      {!connected && <p role="status" className="text-sm text-muted">Conectando às salas…</p>}
      {listedRooms.length===0?connected && <EmptyState title="Nenhum lobby aberto por enquanto." icon={<UserRound className="size-6" />} className="rounded-panel bg-surface" />:<ul className={cn("grid gap-4","@min-[34rem]:grid-cols-2 @min-[64rem]:grid-cols-3")}>{listedRooms.map(lobby=>{
        const active=lobby.status==="playing";
        const people=[...lobby.participants,...(lobby.status==="lobby"?lobby.pendingInvitations:[]),...Array.from({length:lobby.bots},(_,i)=>({userId:`bot-${i}`,username:`Bot ${i+1}`,displayName:`Bot ${i+1}`,avatarUrl:null,seat:lobby.participants.length+i}))];
        const filled=people.length;
        const hostName=lobby.participants.some(p=>p.userId===lobby.hostId)?playerName(lobby.participants.find(p=>p.userId===lobby.hostId)):lobby.hostId===userId?(displayName || username || "Você"):"Administrador";
        const cardHost=lobby.hostId===userId;
        const member=lobby.participants.some(p=>p.userId===userId);
        const joined=(development && cardHost) || member;
        const pending=lobby.status==="lobby"?lobby.pendingInvitations:[];
        const confirmedIds=lobby.status==="lobby"?lobby.confirmedUserIds:[];
        const onlineIds=lobby.status==="lobby"?lobby.onlineUserIds:[];
        const reserved=lobby.status==="lobby" && pending.some(p=>p.userId===userId);
        const canCancel=development && permissions.canManageSite && cardHost && active;
        const full=filled>=lobby.capacity;
        const confirmed=!!userId && confirmedIds.includes(userId);
        const allConfirmed=lobby.entryAmount===0 || lobby.participants.every(p=>confirmedIds.includes(p.userId));
        const allOnline=pending.length===0 && lobby.participants.every(p=>onlineIds.includes(p.userId));
        const nextSeat=filled;
        return <li key={lobby.code}><Card className={cn("relative isolate flex h-full flex-col gap-4",development && "bg-transparent p-0")}>
          <div className="min-w-0 space-y-2">
            <p className="truncate text-lg font-semibold" title={`Sala de ${hostName}`}>Sala de {hostName}</p>
            <div className="flex flex-wrap items-center gap-2">{active && <Badge variant="secondary">Em andamento</Badge>}{gameSettingBadges(definition,lobby.options).map(badge=><Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}</div>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Vagas do lobby">{Array.from({length:lobby.capacity},(_,i)=>{
            const person=people[i];
            const pending=!!person && lobby.status==="lobby" && !lobby.participants.some(p=>p.userId===person.userId);
            const offline=!!person && lobby.status==="lobby" && lobby.participants.some(p=>p.userId===person.userId) && person.userId!==userId && !lobby.onlineUserIds.includes(person.userId);
            const dim=!!person && !person.userId.startsWith("bot-") && (pending || offline);
            const seatLabel=person ? `${playerName(person)}, vaga ${i+1}` : `Disponível, vaga ${i+1}`;
            return <li key={person?.userId ?? i} aria-label={seatLabel} title={person ? playerName(person) : "Disponível"} className={cn("relative shrink-0",dim && "opacity-40")}>
              {person?<span className="relative block size-11"><Avatar className="size-11"><AvatarImage src={person.avatarUrl ?? undefined}/><AvatarFallback>{playerName(person)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>{person.userId===lobby.hostId && <span className="absolute -top-2 -left-1" title="Host"><Image src="/host.svg" width={21} height={20} className="h-5 w-auto" alt="Host"/></span>}{cardHost && member && !active && person.userId!==userId && !person.userId.startsWith("bot-") && <KickPlayer code={lobby.code} version={lobby.version} userId={person.userId} name={playerName(person)} compact disabled={busy || !connected} onSuccess={response=>{if(response.status==="lobby")acceptLobby(response);}}/>}</span>
                :active?<span className="relative flex size-11 items-center justify-center rounded-full"><SeatOutline/><UserRound className="size-4 text-muted"/></span>
                :joined?cardHost && i===nextSeat?<Button variant="ghost" size="icon" className="relative size-11 rounded-full! border-0 p-0" aria-label="Convidar jogadores" disabled={busy || !connected} onClick={()=>setInviteCode(lobby.code)}><SeatOutline/><Plus className="size-4" aria-hidden="true"/></Button>:<span className="relative flex size-11 items-center justify-center rounded-full"><SeatOutline/><UserRound className="size-4 text-muted"/></span>
                :<Button variant="ghost" size="icon" className="relative size-11 rounded-full! border-0 p-0" aria-label={`Entrar na sala de ${hostName}, vaga ${i+1}`} disabled={busy || !connected || (!development && !!directory.active)} onClick={()=>void act(lobby,"join")}><SeatOutline/><Plus className="size-4" aria-hidden="true"/></Button>}
            </li>;
          })}</ul>
          {joined && !active && cardHost && (lobby.participants.length+lobby.bots<2 || !allOnline || !allConfirmed) && <p className="text-xs text-muted">{lobby.participants.length+lobby.bots<2?"Aguardando mais jogadores.":!allOnline?"Aguardando convidados entrarem na sala.":"Aguardando todos confirmarem a entrada."}</p>}
          <div className="relative z-20 mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-contrast/6 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums" aria-label={`${filled} de ${lobby.capacity} lugares ocupados`}><UsersRound className="size-4 text-muted" aria-hidden="true"/>{filled} / {lobby.capacity}</span>
            {lobby.entryAmount>0 && <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(lobby.entryAmount)} Croins</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {active && <Button size="sm" variant="secondary" onClick={()=>onTestStarted?.(lobby.code)}><Eye className="size-4" aria-hidden="true"/>Visualizar</Button>}
              {canCancel && <MatchExitControl label="Cancelar" match={lobby} onIndividual={active && !lobby.onlyBots?async()=>{await managementRequest(`/matches/${lobby.code}/abandon`,{parse:(v:unknown)=>v},"POST",{commandId:randomUUID(),expectedVersion:lobby.version});}:undefined} onEndTest={()=>cancelTest(lobby.code)}/>}
              {!active && !joined && reserved && <Button size="sm" variant="secondary" disabled={busy || !connected || (!development && !!directory.active)} onClick={()=>void act(lobby,"join")}>Aceitar convite</Button>}
              {!active && !joined && !reserved && <Button size="sm" className="bg-tertiary text-white" disabled={busy || !connected || full || (!development && !!directory.active)} onClick={()=>void act(lobby,"join")}>Entrar</Button>}
              {!active && joined && cardHost && <>
                <Button size="sm" variant="secondary" disabled={busy || !connected} onClick={()=>openEdit(lobby)}>Editar</Button>
                <Button size="sm" variant="secondary" disabled={busy || !connected} onClick={()=>void act(lobby,"leave")}>Cancelar</Button>
              </>}
              {!active && joined && !cardHost && <>
                {lobby.entryAmount>0 && !confirmed
                  ? <Button size="sm" className="bg-tertiary text-white" disabled={busy || !connected} onClick={()=>void confirmEntry(lobby)}>Confirmar entrada de {formatBalance.format(lobby.entryAmount)} Croins</Button>
                  : <Button size="sm" variant="secondary" disabled>Aguardando o host</Button>}
                <Button size="sm" variant="secondary" disabled={busy || !connected} onClick={()=>void act(lobby,"leave")}>Cancelar</Button>
              </>}
            </div>
          </div>
        </Card></li>;
      })}</ul>}
    </>
  </section>;
  const matchesSection=listedMatches.length>0?<section className="min-w-0 space-y-4" aria-label="Partidas em andamento"><Heading variant="section">Partidas em andamento</Heading><ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{listedMatches.map(match=>{
    const playing=!!userId && match.controllerIds.includes(userId);
    return <li key={match.code}><Card className="space-y-4"><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold">Sala de {playerName(match.participants.find(p=>p.userId===match.hostId))}</p>{gameSettingBadges(definition,match.options).map(badge=><Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}{match.entryAmount>0 && <Badge variant="secondary" className="gap-1.5"><CroinIcon className="size-4 text-[0.625rem]"/>{formatBalance.format(match.entryAmount)} Croins</Badge>}</div><p className="text-xs text-muted">Rodada {match.round} · {match.participants.length} jogadores</p><Button size="sm" variant="secondary" onClick={()=>openMatch(match.code)}><Eye className="size-4" aria-hidden="true"/>{playing?"Continuar partida":"Visualizar"}</Button></Card></li>;
  })}</ul></section>:null;

  const editRoom=editCode?listedRooms.find((lobby):lobby is Lobby=>lobby.status==="lobby" && lobby.code===editCode) ?? null:null;
  const setupEditing=setup==="edit" && !!editRoom;
  const editSettings=editRoom?gameOptionsSchema.parse(definition.options.parse(editRoom.options)):newSettings;
  const editCapacity=editRoom?.capacity ?? capacity;
  const editEntry=editRoom?.entryAmount ?? entryAmount;
  return <div className="w-full space-y-4">
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[21rem_minmax(0,1fr)] xl:gap-6">
      <LobbyAside game={game} definition={definition} development={development} settings={settings} ranking={ranking} userId={userId} connected={connected} busy={busy} creationBlocked={creationBlocked} playDisabled={playDisabled} playLoading={busy} showCreate={development && !!editableRoom} rules={rules} onLogin={openLogin} onPlay={play} onCreate={openCreate}/>
      <div className="@container min-w-0 space-y-6">
        {rooms}
        {matchesSection}
      </div>
    </div>
    <LobbyCreateDialog open={setup!==null && (setup!=="edit" || !!editRoom)} onOpenChange={open=>{if(!open){setSetup(null);setEditCode(null);}}} definition={definition} settings={setupEditing?editSettings:newSettings} capacity={setupEditing?editCapacity:capacity} entry={setupEditing?editEntry:entryAmount} bots={bots} onlyBots={onlyBots} development={development} economy={economy} busy={busy} connected={connected} error={setup!==null?error:""} editing={setupEditing} onChange={setupEditing?(options,capacity,entry,choice)=>{void configure(options,capacity,entry,choice);}:configureNew} onBots={setBots} onOnlyBots={setOnlyBots} onCreate={()=>void create()}/>
    {inviteCode && <InvitePlayers key={inviteCode} gameSlug={game.slug} code={inviteCode} open onOpenChange={open=>{if(!open)setInviteCode(null);}}/>}
    {setup===null && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
