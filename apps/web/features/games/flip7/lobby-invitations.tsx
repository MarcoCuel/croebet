"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { commandResultSchema, lobbyInvitationsSchema, type LobbyInvitations } from "@croebet/shared";
import { changeLobby } from "./api";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";
import { managementRequest } from "@/features/admin/management-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export function useLobbyInvitations() {
  const {userId}=useSession();
  const [inbox,setInbox]=useState<{userId:string;data:LobbyInvitations}|null>(null);
  useEffect(()=>{
    if(!userId)return;
    let active=true,pending=false;
    const shown=new Map<string,string|number>();
    async function refresh(){
      if(document.visibilityState!=="visible" || pending)return;
      pending=true;
      try{
        const data=await managementRequest("/matches/presence",lobbyInvitationsSchema,"POST");
        if(active){
          setInbox({userId:userId!,data});
          for(const [code,id] of shown)if(!data.items.some(i=>i.code===code)){toast.dismiss(id);shown.delete(code);}
          for(const invite of data.items)if(!shown.has(invite.code)){
            const id=toast.custom(()=> <div role="alert" className="w-80 rounded-xl border border-contrast/6 bg-surface p-4 shadow-lg"><Invitation invite={invite} onRespond={()=>{toast.dismiss(id);void refresh();}}/></div>,{duration:Infinity});
            shown.set(invite.code,id);
          }
        }
      }catch{/* Retain confirmed invitations until the connection recovers. */}
      finally{pending=false;}
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),5000);
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("lobby-invitation-response",refresh);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("lobby-invitation-response",refresh);for(const id of shown.values())toast.dismiss(id);};
  },[userId]);
  const items=inbox?.userId===userId?inbox.data.items:[];
  return items;
}

type Invite=LobbyInvitations["items"][number];
function Invitation({invite,onRespond}:{invite:Invite;onRespond?:()=>void}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  async function respond(accept:boolean){
    if(busy)return;
    setBusy(true);
    try{
      if(accept){await changeLobby(invite.code,"join",crypto.randomUUID());router.push(`/jogos/flip7?partida=${invite.code}`);}
      else await managementRequest(`/matches/${invite.code}/decline`,commandResultSchema,"POST");
      onRespond?.();window.dispatchEvent(new Event("lobby-invitation-response"));
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível responder ao convite.");}
    finally{setBusy(false);}
  }
  return <div className="flex items-start gap-3">
    <Avatar className="size-10"><AvatarImage src={invite.avatarUrl ?? undefined}/><AvatarFallback>{invite.username[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback></Avatar>
    <div><p className="text-sm font-medium">{invite.username} convidou você para jogar Flip 7</p>
      <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={()=>void respond(true)}>Aceitar</Button><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void respond(false)}>Recusar</Button></div>
    </div>
  </div>;
}
export function LobbyInvitationItems({items}:{items:LobbyInvitations["items"]}) {
  return items.map(invite=><div key={invite.code} className="rounded-xl px-3 py-3.5"><Invitation invite={invite}/></div>);
}
