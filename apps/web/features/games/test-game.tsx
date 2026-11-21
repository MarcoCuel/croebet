"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {gameRoomSchema,gameIdSchema,commandResultSchema,type GameRecord,type GameAction} from "@croebet/shared";
import {randomUUID} from "@/lib/uuid";
import {useSession} from "@/features/auth/session-context";
import {managementRequest} from "@/features/admin/management-api";
import {Button} from "@/components/ui/button";
import {Pause,Play,StepForward} from "lucide-react";
import {gameUrl} from "./game-url";
import {MatchExitControl} from "./match-cancellation";
import {LobbyScreen} from "./lobby";
import {useRoomLive} from "./use-room-live";
import {gamePresentations} from "./registry";
import {sendGameCommand,abandonGame} from "./match-api";

type Room=ReturnType<typeof gameRoomSchema.parse>;
export function TestGame({game}:{game:GameRecord}){
 const {userId,permissions}=useSession(),query=useSearchParams();
 const code=query.get("partida") ?? "";
 const [loadedRoom,setRoom]=useState<Room|null>(null);
 const room=loadedRoom?.code===code && loadedRoom.game===game.slug?loadedRoom:null;
 const [running,setRunning]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const presentation=gamePresentations[gameIdSchema.parse(game.slug)],Table=presentation.Table;
 const admin=permissions.canManageSite;
 useEffect(()=>{if(!code)return;let active=true;void managementRequest(`/matches/${code}`,gameRoomSchema).then(next=>{if(active)setRoom(next);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[code]);
 const watchedCode=userId && room?.status!=="lobby" && !presentation.managesLive?room?.code:undefined;
 const connected=useRoomLive(watchedCode,room?.version ?? 0,!!watchedCode,sync=>setRoom(sync.room),()=>{},message=>{setRunning(false);setError(message);},undefined,()=>setError(""));
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await action();}catch(e){setRunning(false);setError(e instanceof Error?e.message:"Não foi possível concluir.");}finally{setBusy(false);}}
 async function refresh(nextCode=code){setRoom(await managementRequest(`/matches/${nextCode}`,gameRoomSchema));}
 function openTest(nextCode:string){window.history.replaceState(null,"",gameUrl(game.slug,{code:nextCode,development:query.get("teste")==="1"}));void refresh(nextCode).catch(e=>setError(e instanceof Error?e.message:"Não foi possível abrir a partida."));}
 async function step(){await run(async()=>{await managementRequest(`/matches/${code}/test-step`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room!.version});await refresh();});}
 useEffect(()=>{if(!running || busy || room?.status!=="playing" || !room.onlyBots)return;const timer=window.setTimeout(()=>void step(),1000);return()=>window.clearTimeout(timer);});
 async function play(action:GameAction){await run(async()=>{await sendGameCommand(code,{commandId:randomUUID(),expectedVersion:room!.version,action});await refresh();});}
 const canAbandon=room?.status==="playing" && !room.onlyBots && room.participants.some(p=>p.userId===userId && room.state.players[p.seat]?.kind==="human");
 const canEnd=room?.status==="playing" && admin && room.hostId===userId;
 const exit=room?.status==="playing" && (canAbandon || canEnd)?<MatchExitControl match={room} onOpen={()=>setRunning(false)} onIndividual={canAbandon?async()=>{await abandonGame(code,randomUUID(),room.version);await refresh();}:undefined} onEndTest={canEnd?async()=>{await managementRequest(`/matches/${code}/end-test`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:room.version});setRoom(null);window.history.replaceState(null,"",gameUrl(game.slug,{development:admin}));}:undefined}/>:null;
 const controls=admin && room?.hostId===userId && room.status!=="lobby"?<div role="group" aria-label="Controles de desenvolvimento" className="flex items-center gap-1">{room.onlyBots && room.status==="playing" && <><Button size="icon" variant="ghost" disabled={busy} aria-label={running?"Pausar teste":"Reproduzir teste"} title={running?"Pausar teste":"Reproduzir teste"} aria-pressed={running} onClick={()=>setRunning(!running)}>{running?<Pause className="size-4"/>:<Play className="size-4"/>}</Button><Button size="icon" variant="ghost" disabled={busy || running} aria-label="Avançar jogada" title="Avançar jogada" onClick={()=>void step()}><StepForward className="size-4"/></Button></>}</div>:null;
 return <div className="space-y-4">
 {(!room || room.status==="lobby") && <LobbyScreen key={room?.id ?? "new"} development game={game} initial={{revision:code,match:null,lobby:room?.status==="lobby"?room:null,directory:{items:[],joined:[],owned:null,active:null},items:[],error:"",unavailable:false}} onTestOpen={setRoom} onTestStarted={openTest}/>}
 {room?.status==="abandoned" && <p role="status">Teste encerrado.</p>}
 {room && room.status!=="lobby" && <Table game={game} room={room} viewerId={userId} busy={busy || (!presentation.managesLive && !connected)} controls={controls} exit={exit} play={play}/>}
 {error && <p role="alert" className="text-sm text-danger">{error}</p>}
 </div>;
}
