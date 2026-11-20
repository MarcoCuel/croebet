"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { realtimeReplySchema, lobbyListSchema, gameRoomSchema, gameRoomSyncSchema, lobbySchema, commandResultSchema, type GameRecord, type LoveAction, type LoveView, type Match } from "@croebet/shared";
import { randomUUID } from "@/lib/uuid";
import { useSession } from "@/features/auth/session-context";
import { managementRequest } from "@/features/admin/management-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { KickPlayer } from "./flip7/kick-player";
import { InvitePlayers } from "./flip7/invite-players";
import { GameEntryHeader } from "./game-entry-header";
import { Flip7Loader } from "./flip7/flip7-loader";
import { gameSocket, retainGameSocket } from "./realtime";

type Room=ReturnType<typeof gameRoomSchema.parse>;
export function TestGame({game}:{game:GameRecord}){
 const {userId,permissions}=useSession();const query=useSearchParams();
 const [code,setCode]=useState(query.get("partida") ?? "");const [room,setRoom]=useState<Room|null>(null);
 const [brutal,setBrutal]=useState(false);
 const [mode,setMode]=useState("classic"),[capacity,setCapacity]=useState(2),[bots,setBots]=useState(1),[onlyBots,setOnlyBots]=useState(false);
 const [tests,setTests]=useState<NonNullable<ReturnType<typeof lobbyListSchema.parse>["tests"]>>([]);
 useEffect(()=>{if(code || !userId)return;let active=true;void managementRequest("/matches/lobbies",lobbyListSchema).then(data=>{if(active)setTests(data.tests ?? []);}).catch(()=>{});return()=>{active=false;};},[code,userId]);
 const [running,setRunning]=useState(false);
 const [inviting,setInviting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const creation=useRef<{key:string;requestId:string}|null>(null);
 const isLove=game.slug==="love-letter",admin=permissions.canManageSite;
 const flip=room?.status!=="lobby" && room?.game==="flip7"?room as Match:null;
 useEffect(()=>{
  if(!userId || flip)return;
  const socket=gameSocket();let active=true;
  function receive(value:unknown){const parsed=gameRoomSyncSchema.safeParse(value);if(active && parsed.success && parsed.data.room.code===code)setRoom(parsed.data.room);}
  function watch(){socket.emit("watch",{code:code || undefined,afterVersion:0},(value:unknown)=>{const reply=realtimeReplySchema.safeParse(value);if(active && reply.success && !reply.data.ok)setError(reply.data.error.message);});}
  function closed(value:{message?:string}){if(active){setRunning(false);setError(value.message ?? "A conexão com a sala foi encerrada.");}}
  socket.on("room",receive).on("connect",watch).on("closed",closed).on("room-closed",closed);const release=retainGameSocket(userId);if(socket.connected)watch();
  return()=>{active=false;socket.off("room",receive).off("connect",watch).off("closed",closed).off("room-closed",closed);if(socket.connected)socket.emit("watch",{active:false,afterVersion:0},()=>{});release();};
 },[code,userId,flip]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await action();}catch(e){setRunning(false);setError(e instanceof Error?e.message:"Não foi possível concluir.");}finally{setBusy(false);}}
 async function refresh(nextCode=code){setRoom(gameRoomSchema.parse(await managementRequest(`/matches/${nextCode}`,gameRoomSchema)));}
 async function create(){await run(async()=>{const payload={game:game.slug,capacity,options:{mode,brutal:!isLove && mode==="vengeance" && brutal},development:true,bots,onlyBots,entryAmount:0};const key=JSON.stringify(payload);if(creation.current?.key!==key)creation.current={key,requestId:randomUUID()};const next=await managementRequest("/matches",lobbySchema,"POST",{...payload,requestId:creation.current.requestId});creation.current=null;setRoom(next);setCode(next.code);window.history.replaceState(null,"",`/jogos/${game.slug}?teste=1&partida=${next.code}`);});}
 async function lobbyAction(action:"start"|"leave"){await run(async()=>{await managementRequest(`/matches/${code}/${action}`,{parse:(value:unknown)=>value},"POST",{commandId:randomUUID(),...(action==="start"?{expectedVersion:room!.version}:{})});if(action==="leave"){setRoom(null);setCode("");window.history.replaceState(null,"",`/jogos/${game.slug}?teste=1`);}else await refresh();});}
 async function end(){await run(async()=>{await managementRequest(`/matches/${code}/end-test`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});setRunning(false);setRoom(null);setCode("");window.history.replaceState(null,"",`/jogos/${game.slug}?teste=1`);});}
 async function step(){await run(async()=>{await managementRequest(`/matches/${code}/test-step`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});await refresh();});}
 useEffect(()=>{if(!running || busy || room?.status!=="playing" || !room.onlyBots)return;const timer=window.setTimeout(()=>void step(),1000);return()=>window.clearTimeout(timer);});
 async function play(action:LoveAction){await run(async()=>{await managementRequest(`/matches/${code}/love-command`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version,action});await refresh();});}
 const state=room && room.status!=="lobby" && "legalActions" in room.state?room.state:null;
 return <div className="space-y-4"><GameEntryHeader game={game}/>{!admin && !code && <Badge variant="secondary">Em breve</Badge>}<div className="flex flex-wrap items-center gap-3"><Badge>Partida de teste</Badge><p className="text-sm text-muted">Sem Croins, estatísticas ou conquistas.</p></div>
 {room && room.status!=="lobby" && admin && room.hostId===userId && <Button variant="ghost" disabled={busy} onClick={()=>void end()}>Encerrar teste</Button>}
 {room?.onlyBots && admin && room.hostId===userId && room.status==="playing" && <div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={()=>setRunning(!running)}>{running?"Pausar":"Reproduzir"}</Button><Button variant="secondary" disabled={busy || running} onClick={()=>void step()}>Avançar jogada</Button></div>}
 {!code && tests.filter(t=>t.game===game.slug).map(t=><Button key={t.code} variant="secondary" onClick={()=>{setCode(t.code);window.history.replaceState(null,"",`/jogos/${game.slug}?teste=1&partida=${t.code}`);}}>Retomar teste · {t.code}</Button>)}
 {flip?<Flip7Loader game={game} initial={{revision:code,match:flip,lobby:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}}/>: <>
 {!room && !code && (admin?<Card className="max-w-lg space-y-4"><Field>Modo<Select value={mode} onChange={e=>{setMode(e.target.value);setCapacity(2);setBots(onlyBots?2:1);}}><option value="classic">Clássico</option><option value={isLove?"modern":"vengeance"}>{isLove?"Moderno":"A vingança nunca é plena"}</option></Select></Field>{!isLove && mode==="vengeance" && <Field className="flex items-center justify-between">Modo Brutal<Switch checked={brutal} onCheckedChange={setBrutal}/></Field>}<Field>Jogadores<Select value={capacity} onChange={e=>{setCapacity(Number(e.target.value));setBots(Math.min(bots,Number(e.target.value)-(onlyBots?0:1)));}}>{Array.from({length:(isLove?(mode==="classic"?4:6):12)-1},(_,i)=>i+2).map(n=><option key={n}>{n}</option>)}</Select></Field><Field>Bots<Select value={bots} onChange={e=>setBots(Number(e.target.value))}>{Array.from({length:capacity+(onlyBots?1:0)},(_,i)=>i).filter(n=>!onlyBots || n>=2).map(n=><option key={n}>{n}</option>)}</Select></Field><Field className="flex items-center justify-between">Somente bots<Switch checked={onlyBots} onCheckedChange={v=>{setOnlyBots(v);setBots(v?capacity:Math.min(bots,capacity-1));}}/></Field><Button loading={busy} onClick={()=>void create()}>Criar partida de teste</Button></Card>:<p className="text-sm text-muted">Você precisa de um convite para participar de uma partida de teste.</p>)}
 {room?.status==="lobby" && <Card className="space-y-4"><p className="font-medium">Lobby · {room.options.mode==="classic"?"Clássico":isLove?"Moderno":"Vingança"}</p><ul className="space-y-2">{room.participants.map(p=><li key={p.userId}>{p.displayName || p.username}{!room.onlineUserIds.includes(p.userId)?" · Aguardando conexão":""}{admin && room.hostId===userId && p.userId!==userId && <KickPlayer code={code} version={room.version} userId={p.userId} name={p.displayName || p.username} compact disabled={busy} onSuccess={setRoom}/>}</li>)}{Array.from({length:room.bots},(_,i)=><li key={`bot-${i}`}>Bot {i+1}</li>)}{room.pendingInvitations.map(p=><li key={p.userId} className="text-muted">{p.displayName || p.username} · Convite pendente{admin && room.hostId===userId && <KickPlayer code={code} version={room.version} userId={p.userId} name={p.displayName || p.username} compact disabled={busy} onSuccess={setRoom}/>}</li>)}</ul><div className="flex flex-wrap gap-2">{admin && room.hostId===userId && <><Button variant="secondary" disabled={busy || room.onlyBots} onClick={()=>setInviting(true)}>Convidar jogadores</Button><Button loading={busy} disabled={room.participants.length+room.bots<2 || room.pendingInvitations.length>0 || room.participants.some(p=>!room.onlineUserIds.includes(p.userId))} onClick={()=>void lobbyAction("start")}>Iniciar teste</Button></>}<Button variant="ghost" disabled={busy} onClick={()=>void lobbyAction("leave")}>Sair</Button></div><InvitePlayers code={code} open={inviting} onOpenChange={setInviting}/></Card>}
 {room?.status==="abandoned" && <p role="status">Teste encerrado.</p>}
 {state && <LoveTable state={room?.status==="playing"?state:{...state,legalActions:[]}} busy={busy} play={play}/>}
 </>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}
const namesClassic=["","Guarda","Sacerdote","Barão","Aia","Príncipe","Rei","Condessa","Princesa"];
const namesModern=["Espiã","Guarda","Sacerdote","Barão","Aia","Príncipe","Chanceler","Rei","Condessa","Princesa"];
function LoveTable({state,busy,play}:{state:LoveView;busy:boolean;play:(action:LoveAction)=>Promise<void>}){
 const names=state.mode==="classic"?namesClassic:namesModern;
 const label=(n:number)=>`${n} · ${names[n]}`;
 return <div className="space-y-4"><p className="text-sm">Rodada {state.round} · {state.deckCount} cartas no baralho · {state.phase==="over"?`Vitória: ${state.winners.map(i=>state.players[i].name).join(", ")}`:`Vez de ${state.players[state.turn].name}`}</p>{state.removed.length>0 && <p className="text-sm text-muted">Fora da rodada: {state.removed.map(label).join(", ")}</p>}<div className="grid gap-4 sm:grid-cols-2">{state.players.map((p,i)=><Card key={i} className="space-y-3"><p className="font-medium">{p.name} · {p.tokens} fichas {p.out?"· Eliminado":p.protected?"· Protegido":""}</p><div className="flex flex-wrap gap-2">{p.hand?.map((c,j)=><span key={j} className="rounded-lg bg-contrast/6 px-4 py-5 text-sm">{label(c)}</span>) ?? <span className="text-sm text-muted">{p.handCount} carta oculta</span>}</div><p className="text-xs text-muted">Descartes: {p.discard.map(label).join(", ") || "Nenhum"}</p></Card>)}</div>{state.privateInfo.map((n,i)=><p key={i} className="text-sm">{n}</p>)}{state.legalActions.length>0 && <LoveControls key={`${state.round}:${state.turn}:${state.pending}:${state.log.length}`} state={state} busy={busy} play={play}/>}<Card className="space-y-2"><p className="font-medium">Histórico</p><div className="max-h-64 space-y-1 overflow-auto text-sm text-muted">{state.log.map((line,i)=><p key={i}>{line}</p>)}</div></Card></div>;
}

function LoveControls({state,busy,play}:{state:LoveView;busy:boolean;play:(action:LoveAction)=>Promise<void>}){
 const [card,setCard]=useState<number|null>(null),[target,setTarget]=useState<number|null>(null),[guess,setGuess]=useState<number|null>(null),[keep,setKeep]=useState(0);
 const names=state.mode==="classic"?namesClassic:namesModern,label=(n:number)=>`${n} · ${names[n]}`;
 const plays=state.legalActions.filter(a=>a.type==="play"),keeps=state.legalActions.filter(a=>a.type==="keep");
 const cards=[...new Set(plays.map(a=>a.card))],selected=card!==null && cards.includes(card)?card:cards[0];
 const targets=[...new Set(plays.filter(a=>a.card===selected).flatMap(a=>a.target===undefined?[]:[a.target]))];
 const selectedTarget=target!==null && targets.includes(target)?target:targets[0];
 const guesses=[...new Set(plays.filter(a=>a.card===selected && a.target===selectedTarget).flatMap(a=>a.guess===undefined?[]:[a.guess]))];
 const selectedGuess=guess!==null && guesses.includes(guess)?guess:guesses[0];
 const action=keeps.at(keep) ?? plays.find(a=>a.card===selected && a.target===selectedTarget && a.guess===selectedGuess) ?? state.legalActions.find(a=>a.type==="next");
 return <Card className="max-w-lg space-y-4"><p className="font-medium">Sua ação</p>{cards.length>0 && <Field>Carta<Select value={selected} onChange={e=>{setCard(Number(e.target.value));setTarget(null);setGuess(null);}}>{cards.map(c=><option key={c} value={c}>{label(c)}</option>)}</Select></Field>}{targets.length>0 && <Field>Jogador<Select value={selectedTarget} onChange={e=>setTarget(Number(e.target.value))}>{targets.map(t=><option key={t} value={t}>{state.players[t].name}</option>)}</Select></Field>}{guesses.length>0 && <Field>Palpite<Select value={selectedGuess} onChange={e=>setGuess(Number(e.target.value))}>{guesses.map(g=><option key={g} value={g}>{label(g)}</option>)}</Select></Field>}{keeps.length>0 && <Field>Carta para manter e ordem no fundo<Select value={keep} onChange={e=>setKeep(Number(e.target.value))}>{keeps.map((a,i)=><option key={i} value={i}>Manter {label(a.cards[0])}; fundo: {a.cards.slice(1).map(label).join(", ")}</option>)}</Select></Field>}<Button disabled={busy || !action} onClick={()=>{if(action)void play(action);}}>{action?.type==="next"?"Próxima rodada":action?.type==="keep"?"Confirmar escolha":"Jogar carta"}</Button></Card>;
}
