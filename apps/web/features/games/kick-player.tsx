"use client";
import { randomUUID } from "@/lib/uuid";
import { useRef, useState } from "react";
import type { KickMatch, GameRoom } from "@croebet/shared";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { kickServerPlayer } from "./match-api";

export function KickPlayer({code,version,userId,name,duringGame=false,withCroins=false,compact=false,disabled,onSuccess}:{code:string;version:number;userId:string;name:string;duringGame?:boolean;withCroins?:boolean;compact?:boolean;disabled?:boolean;onSuccess?:(room:GameRoom)=>void}) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const pending=useRef<KickMatch|null>(null);
  return <Dialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);pending.current=null;}}}>
    <DialogTrigger asChild><Button size={compact?"icon-sm":"sm"} variant="ghost" className={compact?"absolute -top-2 -right-2 rounded-full":undefined} disabled={disabled} aria-label={`Expulsar ${name}`}>{compact?<X className="size-3" aria-hidden="true"/>:"Expulsar"}</Button></DialogTrigger>
    <DialogContent>
      <DialogTitle>Expulsar {name}?</DialogTitle>
      <DialogDescription className="mt-3 text-sm text-muted">{duringGame?"Um bot assumirá as cartas e os pontos desta pessoa. A partida continuará para os demais.":"Esta pessoa será removida do lobby."}{duringGame && withCroins && " A entrada não será devolvida. Se a vaga vencer, o prêmio irá para a casa."}</DialogDescription>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <DialogClose asChild><Button variant="secondary" disabled={busy}>Cancelar</Button></DialogClose>
        <Button loading={busy} disabled={disabled} onClick={async()=>{
          if(busy)return;
          setBusy(true);
          if(!pending.current || pending.current.expectedVersion!==version)pending.current={commandId:randomUUID(),expectedVersion:version,targetUserId:userId};
          try{const room=await kickServerPlayer(code,pending.current);pending.current=null;setOpen(false);onSuccess?.(room);}
          catch(error){toast.error(error instanceof Error?error.message:"Não foi possível expulsar esta pessoa.");}
          finally{setBusy(false);}
        }}>Confirmar expulsão</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
