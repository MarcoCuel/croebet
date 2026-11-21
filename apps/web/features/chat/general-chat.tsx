"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@croebet/shared";
import { randomUUID } from "@/lib/uuid";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteChat, muteChat, sendChat } from "./api";
import { useChat } from "./use-chat";

const messageError=(error:unknown)=>error instanceof Error?error.message:"Não foi possível concluir. Tente novamente.";
const time=(value:string)=>new Date(value).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
export function GeneralChat() {
  const {userId}=useSession();
  return userId ? <ChatPanel key={userId} userId={userId}/> : null;
}
function ChatPanel({userId}:{userId:string}) {
  const chat=useChat(userId);
  const {permissions}=useSession();
  const [open,setOpen]=useState(false);
  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [mutationError,setMutationError]=useState<string|null>(null);
  const [away,setAway]=useState(false);
  const pending=useRef<{requestId:string;text:string}|null>(null);
  const list=useRef<HTMLDivElement>(null);
  const bottom=useRef(true);
  const previousHeight=useRef<number|null>(null);
  const input=useRef<HTMLTextAreaElement>(null);
  function readBottom() {
    const element=list.current;
    if(!element)return;
    const near=element.scrollHeight-element.scrollTop-element.clientHeight<64;
    bottom.current=near;chat.setViewing(open && near);setAway(!near);
    if(open && near && document.visibilityState==="visible")chat.markRead();
  }
  useLayoutEffect(()=>{
    const element=list.current;
    if(!open || !element)return;
    if(previousHeight.current!==null) {
      element.scrollTop+=element.scrollHeight-previousHeight.current;previousHeight.current=null;
    } else if(bottom.current)element.scrollTop=element.scrollHeight;
  },[open,chat.items]);
  function changeOpen(value:boolean) {
    setOpen(value);chat.setViewing(value);bottom.current=true;setAway(false);
    if(value){chat.markRead();chat.refresh();}else chat.setViewing(false);
  }
  function jump() { if(list.current)list.current.scrollTop=list.current.scrollHeight;bottom.current=true;chat.setViewing(true);setAway(false);chat.markRead(); }
  async function submit() {
    const value=text.trim();
    if(!value || sending || !chat.ready || !chat.connected || chat.mutedUntil)return;
    const command=pending.current?.text===value?pending.current:{requestId:randomUUID(),text:value};
    pending.current=command;setSending(true);setMutationError(null);
    try {await sendChat(command.requestId,command.text);pending.current=null;setText("");bottom.current=true;chat.refresh();input.current?.focus();}
    catch(error){setMutationError(messageError(error));chat.refresh();}
    finally{setSending(false);}
  }
  async function older() {
    if(loadingOlder)return;
    setLoadingOlder(true);
    try {await chat.older(()=>{previousHeight.current=list.current?.scrollHeight??null;});}
    catch(error){previousHeight.current=null;toast.error(messageError(error));}
    finally{setLoadingOlder(false);}
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="secondary" size="icon" className="relative" aria-label={chat.unread?`Chat geral, ${chat.unread} mensagens não lidas`:"Chat geral"}>
      <MessageCircle className="size-4" aria-hidden="true"/>
      {chat.unread>0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-brand px-1 text-[0.625rem] leading-4 text-white">{chat.unread>99?"99+":chat.unread}</span>}
    </Button></DialogTrigger>
    <DialogContent variant="drawer-right" aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus();}}>
      <div className="shrink-0 border-b border-contrast/6 p-5"><DialogTitle>Chat geral</DialogTitle><p className="mt-1 text-xs text-muted" role="status">{chat.connected?"Conversa da comunidade":"Reconectando…"}</p></div>
      <div ref={list} onScroll={readBottom} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3" data-lenis-prevent aria-label="Mensagens do chat">
        {chat.hasMore && <Button variant="ghost" size="sm" className="mb-3 w-full" loading={loadingOlder} onClick={()=>void older()}>Carregar anteriores</Button>}
        {!chat.ready && !chat.error && <p className="py-8 text-center text-sm text-muted" role="status">Carregando conversa…</p>}
        {chat.ready && chat.items.length===0 && <p className="py-8 text-center text-sm text-muted">A conversa começa por aqui.</p>}
        <ol className="space-y-4">{chat.items.map(message=><Message key={message.id} message={message} admin={permissions.canManageSite} refresh={chat.refresh} close={()=>changeOpen(false)}/>)}</ol>
      </div>
      {away && <Button variant="secondary" size="sm" className="mx-auto my-2" onClick={jump}>{chat.unread?`Novas mensagens (${chat.unread})`:"Ir para o final"}</Button>}
      <div className="shrink-0 border-t border-contrast/6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {chat.error && <div className="mb-3 text-sm text-muted" role="alert">{chat.error} <Button variant="link" size="sm" onClick={chat.refresh}>Tentar novamente</Button></div>}
        {chat.mutedUntil && <p className="mb-3 text-sm text-muted" role="status">Você está silenciado até {new Date(chat.mutedUntil).toLocaleString("pt-BR")}.</p>}
        <form onSubmit={event=>{event.preventDefault();void submit();}} className="flex items-end gap-2">
          <label htmlFor="general-chat-message" className="sr-only">Mensagem</label>
          <Textarea ref={input} id="general-chat-message" placeholder="Escreva uma mensagem…" maxLength={500} rows={2} className="min-h-20 resize-none text-sm" value={text} disabled={sending || !!chat.mutedUntil} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void submit();}}}/>
          <Button type="submit" size="icon" loading={sending} disabled={!text.trim() || !chat.ready || !chat.connected || !!chat.mutedUntil} aria-label="Enviar mensagem"><Send className="size-4" aria-hidden="true"/></Button>
        </form>
        <div className="mt-2 flex justify-between gap-2 text-xs text-muted"><span>{mutationError?<span role="alert">{mutationError}</span>:"Enter envia · Shift + Enter quebra a linha"}</span><span>{text.length}/500</span></div>
      </div>
    </DialogContent>
  </Dialog>;
}
function Message({message,admin,refresh,close}:{message:ChatMessage;admin:boolean;refresh:()=>void;close:()=>void}) {
  const [busy,setBusy]=useState(false);
  async function moderate(action:()=>Promise<unknown>) {
    setBusy(true);
    try{await action();refresh();}catch(error){toast.error(messageError(error));}finally{setBusy(false);}
  }
  return <li className="flex gap-3" data-message-id={message.id}>
    <Avatar className="mt-0.5 size-8"><AvatarImage src={message.avatarUrl??undefined}/><AvatarFallback>{message.name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2"><span className="truncate text-sm font-semibold">{message.username?<Link href={`/perfil/${encodeURIComponent(message.username)}`} onClick={close}>{message.name}</Link>:message.name}</span><time className="shrink-0 text-[0.625rem] text-muted" dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString("pt-BR")}>{time(message.createdAt)}</time></div>
      <p className={message.deleted?"mt-0.5 text-sm italic text-muted":"mt-0.5 whitespace-pre-wrap text-sm wrap-anywhere"}>{message.deleted?"Mensagem removida":message.text}</p>
    </div>
    {admin && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`Moderar mensagem de ${message.name}`}><MoreHorizontal className="size-4" aria-hidden="true"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {!message.deleted && <DropdownMenuItem onSelect={()=>void moderate(()=>deleteChat(message.id))}>Remover mensagem</DropdownMenuItem>}
      {message.userId && <>{([10,60,1440] as const).map(minutes=><DropdownMenuItem key={minutes} onSelect={()=>void moderate(()=>muteChat(message.userId!,minutes))}>Silenciar por {minutes===10?"10 minutos":minutes===60?"1 hora":"24 horas"}</DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>void moderate(()=>muteChat(message.userId!,0))}>Remover silenciamento</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>}
  </li>;
}
