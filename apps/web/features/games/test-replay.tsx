"use client";

import { useEffect, useState } from "react";
import { gameReplaySchema, type GameRecord, type GameRoom } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";
import { Button } from "@/components/ui/button";
import { ReplayControls } from "./replay-controls";
import { gamePresentations } from "./registry";

type Replay = ReturnType<typeof gameReplaySchema.parse>;
/** Replay consumes spectator frames only and never connects to the game executor. */
export function TestReplay({ game, room, onClose }: { game: GameRecord; room: Exclude<GameRoom,{status:"lobby"}>; onClose:()=>void }) {
 const [initial,setInitial]=useState<Replay|null>(null),[page,setPage]=useState<Replay|null>(null);
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[delay,setDelay]=useState(1000),[error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const offset=Math.floor(index/100)*100;
 const visible=offset===0?initial:page;
 const loading=!visible || visible.offset!==offset;
 const frame=loading?null:visible.frames[index-offset];
 useEffect(()=>{
  let active=true;
  managementRequest(`/me/matches/${room.code}?offset=${offset}&limit=100`,gameReplaySchema).then(value=>{if(active){if(!offset)setInitial(value);else setPage(value);setError("");}}).catch(e=>{if(active){setError(e.message);setPlaying(false);}});
  return()=>{active=false;};
 },[room.code,offset,retry]);
 useEffect(()=>{
  if(!playing || loading || error || !initial || index>=initial.match.frameCount-1)return;
  const timer=setTimeout(()=>setIndex(i=>i+1),delay);
  return()=>clearTimeout(timer);
 },[playing,loading,error,initial,index,delay]);
 const Table=gamePresentations[room.game].Table;
 return <div className="grid gap-4"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Replay da partida {room.code}</h2><Button variant="secondary" onClick={onClose}>Voltar ao resultado</Button></div>
 <ReplayControls index={index} count={initial?.match.frameCount ?? 0} playing={playing} delay={delay} loading={loading} error={error} seek={value=>{setPlaying(false);setIndex(value);}} toggle={()=>setPlaying(p=>!p)} setDelay={setDelay}/>
 {error?<div role="alert">{error}<Button variant="secondary" onClick={()=>setRetry(r=>r+1)}>Tentar novamente</Button></div>:loading?<p role="status">Carregando jogadas…</p>:frame?<Table game={game} room={{...room,state:frame.state,status:"finished"}} viewerId={null} busy controls={null} exit={null} play={async()=>{}}/>:<p>Nenhuma jogada disponível.</p>}
 </div>;
}
