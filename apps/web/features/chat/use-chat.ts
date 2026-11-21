"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@croebet/shared";
import { realtimeSocket, retainRealtimeSocket } from "@/lib/realtime";
import { loadChat, syncChat } from "./api";

export function mergeMessages(current:ChatMessage[],incoming:ChatMessage[]) {
  const items=new Map(current.map(item=>[item.id,item]));
  for(const item of incoming) items.set(item.id,item);
  return [...items.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
}
export function useChat(userId:string) {
  const [items,setItems]=useState<ChatMessage[]>([]);
  const [ready,setReady]=useState(false);
  const [connected,setConnected]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [mutedUntil,setMutedUntil]=useState<string|null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [unread,setUnread]=useState(0);
  const viewing=useRef(false);
  const unseen=useRef(new Set<string>());
  const refreshRef=useRef(()=>{});
  const refresh=()=>refreshRef.current();
  const setViewing=(value:boolean)=>{viewing.current=value;};
  const markRead=()=>{ unseen.current.clear();setUnread(0); };
  useEffect(()=>{
    const socket=realtimeSocket();
    const controller=new AbortController();
    let active=true, running=false, pending=false, cursor:string|undefined;
    async function refresh() {
      pending=true;
      if(running)return;
      running=true;
      try {
        do {
          pending=false;
          if(cursor===undefined) {
            const page=await loadChat(undefined,controller.signal);
            if(!active)return;
            setItems(page.items);setHasMore(page.hasMore);setMutedUntil(page.mutedUntil);setReady(true);cursor=page.cursor;
            pending=true; // Recover events committed while the initial page was in flight.
          } else {
            const page=await syncChat(cursor,controller.signal);
            if(!active)return;
            const messages=page.events.flatMap(event=>event.message?[event.message]:[]);
            setItems(current=>mergeMessages(current,messages));
            for(const event of page.events) {
              const message=event.message;
              if(!message)continue;
              if(message.deleted)unseen.current.delete(message.id);
              else if(event.kind==="message" && message.userId!==userId && (!viewing.current || document.visibilityState!=="visible"))unseen.current.add(message.id);
            }
            if(viewing.current && document.visibilityState==="visible")unseen.current.clear();
            setUnread(unseen.current.size);setMutedUntil(page.mutedUntil);cursor=page.cursor;
            pending ||= page.hasMore;
          }
          setError(null);
        } while(pending && active);
      } catch(error) { if(active)setError(error instanceof Error?error.message:"Chat indisponível."); }
      finally { running=false; }
    }
    refreshRef.current=()=>{void refresh();};
    const online=()=>{setConnected(true);void refresh();};
    const offline=()=>{setConnected(false);};
    const changed=()=>{void refresh();};
    const visible=()=>{if(document.visibilityState==="visible")void refresh();};
    socket.on("connect",online).on("disconnect",offline).on("chat:changed",changed);
    document.addEventListener("visibilitychange",visible);
    const release=retainRealtimeSocket(userId);
    if(socket.connected)online();else void refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},15000);
    return ()=>{active=false;controller.abort();refreshRef.current=()=>{};window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);socket.off("connect",online).off("disconnect",offline).off("chat:changed",changed);release();};
  },[userId]);
  async function older(beforeMerge:()=>void) {
    const page=await loadChat(items[0]?.id);
    beforeMerge();
    // An event already received wins over an older HTTP snapshot.
    setItems(current=>mergeMessages(page.items,current));setHasMore(page.hasMore);refresh();
  }
  return {items,ready,connected,error,mutedUntil,hasMore,unread,setViewing,markRead,refresh,older};
}
