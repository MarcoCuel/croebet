"use client";
import { useRef, useState } from "react";
import type { KickMatch, Room } from "@croebet/shared";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { kickServerPlayer } from "./api";

export function KickPlayer({code,version,userId,name,duringGame=false,compact=false,disabled,onSuccess}:{code:string;version:number;userId:string;name:string;duringGame?:boolean;compact?:boolean;disabled?:boolean;onSuccess?:(room:Room)=>void}) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const pending=useRef<KickMatch|null>(null);
  return <Dialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);pending.current=null;}}}>
    <DialogTrigger asChild><Button size={compact?"icon-sm":"sm"} variant="ghost" className={compact?"absolute -top-2 right-0 rounded-full":undefined} disabled={disabled} aria-label={`Expulsar ${name}`}>{compact?<X className="size-3" aria-hidden="true"/>:"Expulsar"}</Button></DialogTrigger>
    <DialogContent>
      <DialogTitle>Expulsar {name}?</DialogTitle>
      <DialogDescription className="mt-3 text-sm text-muted">{duringGame?"Um bot assumirá as cartas e os pontos desta pessoa. A partida continuará para os demais.":"Esta pessoa será removida do lobby."}</DialogDescription>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <DialogClose asChild><Button variant="secondary" disabled={busy}>Cancelar</Button></DialogClose>
        <Button loading={busy} disabled={disabled} onClick={async()=>{
          if(busy)return;
          setBusy(true);
          if(!pending.current || pending.current.expectedVersion!==version)pending.current={commandId:crypto.randomUUID(),expectedVersion:version,targetUserId:userId};
          try{const room=await kickServerPlayer(code,pending.current);pending.current=null;setOpen(false);onSuccess?.(room);}
          catch(error){toast.error(error instanceof Error?error.message:"Não foi possível expulsar esta pessoa.");}
          finally{setBusy(false);}
        }}>Confirmar expulsão</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
