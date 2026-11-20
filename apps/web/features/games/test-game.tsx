"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { realtimeReplySchema, gameRoomSchema, gameRoomSyncSchema, commandResultSchema, type GameRecord, type LoveAction, type LoveView, type Match } from "@croebet/shared";
import { randomUUID } from "@/lib/uuid";
import { useSession } from "@/features/auth/session-context";
import { managementRequest } from "@/features/admin/management-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { LobbyScreen } from "./flip7/lobby";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, StepForward, X } from "lucide-react";
import { Flip7Loader } from "./flip7/flip7-loader";
import { gameSocket, retainGameSocket } from "./realtime";

type Room=ReturnType<typeof gameRoomSchema.parse>;
export function TestGame({game}:{game:GameRecord}){
 const {userId,permissions}=useSession();const query=useSearchParams();
 const [code,setCode]=useState(query.get("partida") ?? "");const [room,setRoom]=useState<Room|null>(null);
 const [running,setRunning]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");

 const admin=permissions.canManageSite;
 useEffect(()=>{if(!code)return;let active=true;void managementRequest(`/matches/${code}`,gameRoomSchema).then(next=>{if(active)setRoom(next);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[code]);
 const flip=room?.status!=="lobby" && room?.game==="flip7"?room as Match:null;
 useEffect(()=>{
  if(!userId || flip || !room || room.status==="lobby")return;
  const socket=gameSocket();let active=true;
  function receive(value:unknown){const parsed=gameRoomSyncSchema.safeParse(value);if(active && parsed.success && parsed.data.room.code===code)setRoom(parsed.data.room);}
  function watch(){socket.emit("watch",{code:code || undefined,afterVersion:0},(value:unknown)=>{const reply=realtimeReplySchema.safeParse(value);if(active && reply.success && !reply.data.ok)setError(reply.data.error.message);});}
  function closed(value:{message?:string}){if(active){setRunning(false);setError(value.message ?? "A conexão com a sala foi encerrada.");}}
  socket.on("room",receive).on("connect",watch).on("closed",closed).on("room-closed",closed);const release=retainGameSocket(userId);if(socket.connected)watch();
  return()=>{active=false;socket.off("room",receive).off("connect",watch).off("closed",closed).off("room-closed",closed);if(socket.connected)socket.emit("watch",{active:false,afterVersion:0},()=>{});release();};
 },[code,userId,flip,room]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await action();}catch(e){setRunning(false);setError(e instanceof Error?e.message:"Não foi possível concluir.");}finally{setBusy(false);}}
 async function refresh(nextCode=code){setRoom(gameRoomSchema.parse(await managementRequest(`/matches/${nextCode}`,gameRoomSchema)));}
 async function end(){await run(async()=>{await managementRequest(`/matches/${code}/end-test`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});setRunning(false);setRoom(null);setCode("");window.history.replaceState(null,"",`/jogos/${game.slug}?teste=1`);});}
 async function step(){await run(async()=>{await managementRequest(`/matches/${code}/test-step`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});await refresh();});}
 useEffect(()=>{if(!running || busy || room?.status!=="playing" || !room.onlyBots)return;const timer=window.setTimeout(()=>void step(),1000);return()=>window.clearTimeout(timer);});
 async function play(action:LoveAction){await run(async()=>{await managementRequest(`/matches/${code}/love-command`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version,action});await refresh();});}
 const state=room && room.status!=="lobby" && "legalActions" in room.state?room.state:null;
 const testControls=admin && room?.hostId===userId && room.status!=="lobby"?<div role="group" aria-label="Controles de desenvolvimento" className="flex items-center gap-1">
 {room.onlyBots && room.status==="playing" && <><Button size="icon" variant="ghost" disabled={busy} aria-label={running?"Pausar teste":"Reproduzir teste"} title={running?"Pausar teste":"Reproduzir teste"} aria-pressed={running} onClick={()=>setRunning(!running)}>{running?<Pause className="size-4"/>:<Play className="size-4"/>}</Button><Button size="icon" variant="ghost" disabled={busy || running} aria-label="Avançar jogada" title="Avançar jogada" onClick={()=>void step()}><StepForward className="size-4"/></Button></>}
 <Button size="icon" variant="ghost" disabled={busy} aria-label="Encerrar teste" title="Encerrar teste" onClick={()=>void end()}><X className="size-4"/></Button></div>:null;
 return <div className="space-y-4">
 {flip?<Flip7Loader testControls={testControls} game={game} initial={{revision:code,match:flip,lobby:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}}/>: <>
 {(!room || room.status==="lobby") && <LobbyScreen key={room?.id ?? "new"} development game={game} rules={()=>null} initial={{revision:code,match:null,lobby:room?.status==="lobby"?room:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}} onTestOpen={next=>{setRoom(next);setCode(next.code);}} onTestStarted={next=>{setCode(next);void refresh(next);}}/>}
 {room?.status==="abandoned" && <p role="status">Teste encerrado.</p>}
 {state && <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{state.mode==="classic"?"Clássico":"Moderno"}</Badge><Badge>Desenvolvimento</Badge><div className="ml-auto">{testControls}</div></div>}
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
