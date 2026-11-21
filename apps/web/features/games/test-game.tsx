"use client";
import { gameUrl } from "./game-url";
import {CancellationNotice,MatchExitControl} from "./match-cancellation";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gameRoomSchema, commandResultSchema, type GameRecord, type LoveAction, type Match } from "@croebet/shared";
import { randomUUID } from "@/lib/uuid";
import { useSession } from "@/features/auth/session-context";
import { managementRequest } from "@/features/admin/management-api";
import { Button } from "@/components/ui/button";
import { LobbyScreen } from "./flip7/lobby";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, StepForward } from "lucide-react";
import { Flip7Loader } from "./flip7/flip7-loader";
import { useMatchLive } from "./flip7/live";
import { LoveTable } from "./love-letter/love-table";

type Room=ReturnType<typeof gameRoomSchema.parse>;
export function TestGame({game}:{game:GameRecord}){
 const {userId,permissions}=useSession();const query=useSearchParams();
 const code=query.get("partida") ?? "";
 const [loadedRoom,setRoom]=useState<Room|null>(null);
 const room=loadedRoom?.code===code?loadedRoom:null;
 const [running,setRunning]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");

 const admin=permissions.canManageSite;
 useEffect(()=>{if(!code)return;let active=true;void managementRequest(`/matches/${code}`,gameRoomSchema).then(next=>{if(active)setRoom(next);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[code]);
 const flip=room?.status!=="lobby" && room?.game==="flip7"?room as Match:null;
 const watchedCode=userId && room && room.game!=="flip7" && room.status!=="lobby"?room.code:undefined;
 useMatchLive(watchedCode,room?.version ?? 0,!!watchedCode,()=>{},()=>{},message=>{
  setRunning(false);setError(message);
 },undefined,(_code,sync)=>setRoom(sync.room),()=>setError(""));

 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await action();}catch(e){setRunning(false);setError(e instanceof Error?e.message:"Não foi possível concluir.");}finally{setBusy(false);}}
 async function refresh(nextCode=code){setRoom(gameRoomSchema.parse(await managementRequest(`/matches/${nextCode}`,gameRoomSchema)));}
 function openTest(nextCode:string){
  window.history.replaceState(null,"",gameUrl(game.slug,{code:nextCode,development:query.get("teste")==="1"}));
  void refresh(nextCode).catch(e=>setError(e instanceof Error?e.message:"Não foi possível abrir a partida."));
 }
 async function step(){await run(async()=>{await managementRequest(`/matches/${code}/test-step`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});await refresh();});}
 useEffect(()=>{if(!running || busy || room?.status!=="playing" || !room.onlyBots)return;const timer=window.setTimeout(()=>void step(),1000);return()=>window.clearTimeout(timer);});
 async function play(action:LoveAction){await run(async()=>{await managementRequest(`/matches/${code}/love-command`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version,action});await refresh();});}
 const state=room && room.status!=="lobby" && "legalActions" in room.state?room.state:null;
 const observerExit=room && room.status!=="lobby" && room.status==="playing" && room.onlyBots && admin && room.hostId===userId?<MatchExitControl match={room} onOpen={()=>setRunning(false)} onEndTest={async()=>{await managementRequest(`/matches/${code}/end-test`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room.version});setRoom(null);window.history.replaceState(null,"",gameUrl(game.slug,{development:admin}));}}/>:undefined;
 const testControls=admin && room?.hostId===userId && room.status!=="lobby"?<div role="group" aria-label="Controles de desenvolvimento" className="flex items-center gap-1">
 {room.onlyBots && room.status==="playing" && <><Button size="icon" variant="ghost" disabled={busy} aria-label={running?"Pausar teste":"Reproduzir teste"} title={running?"Pausar teste":"Reproduzir teste"} aria-pressed={running} onClick={()=>setRunning(!running)}>{running?<Pause className="size-4"/>:<Play className="size-4"/>}</Button><Button size="icon" variant="ghost" disabled={busy || running} aria-label="Avançar jogada" title="Avançar jogada" onClick={()=>void step()}><StepForward className="size-4"/></Button></>}
</div>:null;
 return <div className="space-y-4">
 {flip?<Flip7Loader exitControl={observerExit} testControls={testControls} game={game} initial={{revision:code,match:flip,lobby:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}}/>: <>
 {(!room || room.status==="lobby") && <LobbyScreen key={room?.id ?? "new"} development game={game} rules={()=>null} initial={{revision:code,match:null,lobby:room?.status==="lobby"?room:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}} onTestOpen={setRoom} onTestStarted={openTest}/>}
 {room?.status==="abandoned" && <p role="status">Teste encerrado.</p>}
 {state && <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{state.mode==="classic"?"Clássico":"Moderno"}</Badge><Badge>Desenvolvimento</Badge><div className="ml-auto flex items-center gap-1">{testControls}{observerExit}{!observerExit && room && room.status==="playing" && room.participants.some(p=>p.userId===userId && state.players[p.seat]?.kind==="human") && <MatchExitControl match={room} onIndividual={async()=>{await managementRequest(`/matches/${code}/love-abandon`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room.version});await refresh();}}/>}</div></div>}
 {state && room && <CancellationNotice match={room}/>}
 {state && room && <LoveTable state={room.status==="playing"?state:{...state,legalActions:[]}} busy={busy} play={play} participants={room.participants} viewerSeat={room.participants.find(p=>p.userId===userId)?.seat}/>}
 </>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}
