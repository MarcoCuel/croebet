"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, MoreHorizontal, Send, X } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@croebet/shared";
import { cn } from "@/lib/utils";
import { randomUUID } from "@/lib/uuid";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteChat, muteChat, sendChat } from "./api";
import { useGeneralChat } from "./chat-context";

const messageError=(error:unknown)=>error instanceof Error?error.message:"Não foi possível concluir. Tente novamente.";
const time=(value:string)=>new Date(value).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
export function GeneralChat() {
  const state = useGeneralChat();
  if (!state) return null;
  const { chat, open, changeOpen, triggerRef } = state;
  return <Button ref={triggerRef} variant="secondary" size="icon" className="relative" aria-controls="general-chat-sidebar" aria-expanded={open} aria-label={chat.unread ? `Chat geral, ${chat.unread} mensagens não lidas` : "Chat geral"} onClick={() => changeOpen(!open)}>
    <MessageCircle className="size-4" aria-hidden="true" />
    {chat.unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-brand px-1 text-[0.625rem] leading-4 text-white">{chat.unread > 99 ? "99+" : chat.unread}</span>}
  </Button>;
}

export function ChatSidebar() {
  const state = useGeneralChat();
  return state ? <ChatPanel /> : null;
}

function ChatPanel() {
  const { chat, open, changeOpen } = useGeneralChat()!;
  const { permissions } = useSession();
  const heading = useRef<HTMLHeadingElement>(null);
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
  useLayoutEffect(() => {
    if (open) {
      bottom.current = true;
      heading.current?.focus({ preventScroll: true });
    }
  }, [open]);
  useLayoutEffect(()=>{
    const element=list.current;
    if(!open || !element)return;
    if(previousHeight.current!==null) {
      element.scrollTop+=element.scrollHeight-previousHeight.current;previousHeight.current=null;
    } else if(bottom.current)element.scrollTop=element.scrollHeight;
  },[open,chat.items]);
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
  function close() {
    setAway(false);
    changeOpen(false, true);
  }
  return <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
    <aside id="general-chat-sidebar" inert={!open} aria-hidden={!open} aria-labelledby="general-chat-title" onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); }
  }} className={cn("pointer-events-auto absolute inset-y-0 right-0 flex w-full flex-col border-l border-contrast/6 bg-background transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none md:w-80", !open && "pointer-events-none invisible translate-x-full")} data-lenis-prevent>
      <div className="flex min-h-(--header-height) shrink-0 items-center justify-between px-4">
        <h2 ref={heading} tabIndex={-1} id="general-chat-title" className="text-sm font-semibold outline-none">Chat geral</h2>
        <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Fechar chat"><X className="size-4" aria-hidden="true" /></Button>
      </div>
      <div ref={list} onScroll={readBottom} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2" data-lenis-prevent aria-label="Mensagens do chat">
        {chat.hasMore && <Button variant="ghost" size="sm" className="mb-3 w-full" loading={loadingOlder} onClick={()=>void older()}>Carregar anteriores</Button>}
        {!chat.ready && !chat.error && <p className="py-8 text-center text-sm text-muted" role="status">Carregando conversa…</p>}
        {chat.ready && chat.items.length===0 && <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem.</p>}
        <ol className="space-y-3">{chat.items.map(message=><Message key={message.id} message={message} admin={permissions.canManageSite} refresh={chat.refresh} close={()=>changeOpen(false)}/>)}</ol>
      </div>
      {away && <Button variant="secondary" size="sm" className="mx-auto my-2" onClick={jump}>{chat.unread?`Novas mensagens (${chat.unread})`:"Ir para o final"}</Button>}
      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {chat.error && <div className="mb-3 text-sm text-muted" role="alert">{chat.error} <Button variant="link" size="sm" onClick={chat.refresh}>Tentar novamente</Button></div>}
        {chat.mutedUntil && <p className="mb-3 text-sm text-muted" role="status">Você está silenciado até {new Date(chat.mutedUntil).toLocaleString("pt-BR")}.</p>}
        <form onSubmit={event=>{event.preventDefault();void submit();}} className="flex items-end gap-2">
          <label htmlFor="general-chat-message" className="sr-only">Mensagem</label>
          <Textarea ref={input} id="general-chat-message" placeholder="Escreva uma mensagem…" maxLength={500} rows={1} className="min-h-11 max-h-32 resize-none text-sm" value={text} disabled={sending || !!chat.mutedUntil} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void submit();}}}/>
          <Button type="submit" size="icon" loading={sending} disabled={!text.trim() || !chat.ready || !chat.connected || !!chat.mutedUntil} aria-label="Enviar mensagem"><Send className="size-4" aria-hidden="true"/></Button>
        </form>
        {mutationError && <p className="mt-2 text-xs text-muted" role="alert">{mutationError}</p>}
        {!chat.connected && !chat.error && <p className="mt-2 text-xs text-muted" role="status">Reconectando…</p>}
      </div>
    </aside>
  </div>;
}
function Message({message,admin,refresh,close}:{message:ChatMessage;admin:boolean;refresh:()=>void;close:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  async function moderate(action:()=>Promise<unknown>) {
    setBusy(true);
    try{await action();refresh();}catch(error){toast.error(messageError(error));}finally{setBusy(false);}
  }
  return <li className="group/message relative flex gap-2" data-message-id={message.id} data-menu-open={menuOpen} tabIndex={admin ? 0 : undefined}>
    <Avatar className="mt-0.5 size-7"><AvatarImage src={message.avatarUrl??undefined}/><AvatarFallback>{message.name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2"><span className="truncate text-sm font-semibold">{message.username?<Link href={`/perfil/${encodeURIComponent(message.username)}`} onClick={close}>{message.name}</Link>:message.name}</span><time className="shrink-0 text-[0.625rem] text-muted" dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString("pt-BR")}>{time(message.createdAt)}</time></div>
      <p className={message.deleted?"mt-0.5 text-sm italic text-muted":"mt-0.5 whitespace-pre-wrap text-sm wrap-anywhere"}>{message.deleted?"Mensagem removida":message.text}</p>
    </div>
    {admin && <DropdownMenu onOpenChange={setMenuOpen}><DropdownMenuTrigger asChild><Button variant="secondary" size="icon-sm" className="absolute top-0 right-0 size-7 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 group-data-[menu-open=true]/message:opacity-100 data-[state=open]:opacity-100 motion-reduce:transition-none" disabled={busy} aria-label={`Moderar mensagem de ${message.name}`}><MoreHorizontal className="size-4" aria-hidden="true"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {!message.deleted && <DropdownMenuItem onSelect={()=>void moderate(()=>deleteChat(message.id))}>Remover mensagem</DropdownMenuItem>}
      {message.userId && <>{([10,60,1440] as const).map(minutes=><DropdownMenuItem key={minutes} onSelect={()=>void moderate(()=>muteChat(message.userId!,minutes))}>Silenciar por {minutes===10?"10 minutos":minutes===60?"1 hora":"24 horas"}</DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>void moderate(()=>muteChat(message.userId!,0))}>Remover silenciamento</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>}
  </li>;
}
