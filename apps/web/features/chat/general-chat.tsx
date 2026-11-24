"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize, MessageCircle, MoreHorizontal, X } from "lucide-react";
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
  const pathname = usePathname();
  if (!state || pathname === "/chat") return null;
  const { chat, open, changeOpen } = state;
  return <Button variant="ghost" size="icon" className="relative" aria-controls="general-chat-sidebar" aria-expanded={open} aria-label={chat.unread ? `Chat geral, ${chat.unread} mensagens não lidas` : "Chat geral"} onClick={event => {
    changeOpen(!open, false, event.currentTarget);
  }}>
    <MessageCircle className="size-4" aria-hidden="true" />
    {chat.unread > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-brand px-1 text-[0.625rem] leading-4 text-white">{chat.unread > 99 ? "99+" : chat.unread}</span>}
  </Button>;
}

export function ChatSidebar() {
  const state = useGeneralChat();
  const pathname = usePathname();
  return state && pathname !== "/chat" ? <ChatPanel /> : null;
}

export function ChatPage() {
  const state = useGeneralChat();
  return state ? <ChatPanel page /> : <div className="mx-auto w-full max-w-3xl px-(--page-gap) py-8"><p className="text-sm text-muted">Entre na sua conta para participar da conversa.</p></div>;
}

function ChatPanel({ page = false }: { page?: boolean }) {
  const { chat, open: floatingOpen, changeOpen, text, setText, pendingRef } = useGeneralChat()!;
  const open = page || floatingOpen;
  const { permissions, userId } = useSession();
  const heading = useRef<HTMLHeadingElement>(null);
  const [sending,setSending]=useState(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [mutationError,setMutationError]=useState<string|null>(null);
  const [away,setAway]=useState(false);
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
  useEffect(() => {
    if (!page) return;
    chat.setViewing(true);
    chat.markRead();
    chat.refresh();
    return () => chat.setViewing(false);
    // The chat methods use stable state and refs; only route entry changes this lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  useLayoutEffect(() => {
    if (open) {
      bottom.current = true;
      if (!page) heading.current?.focus({ preventScroll: true });
    }
  }, [open, page]);
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
    const command=pendingRef.current?.text===value?pendingRef.current:{requestId:randomUUID(),text:value};
    pendingRef.current=command;setSending(true);setMutationError(null);
    try {await sendChat(command.requestId,command.text);pendingRef.current=null;setText("");bottom.current=true;chat.refresh();input.current?.focus();}
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
  const content = <aside id={page ? "general-chat-page" : "general-chat-sidebar"} inert={!open} aria-hidden={!open} aria-label={page ? "Chat geral" : undefined} aria-labelledby={page ? undefined : "general-chat-title"} onKeyDown={event => {
    if (!page && event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(); }
  }} className={cn("flex flex-col overflow-hidden bg-surface", page ? "h-[min(44rem,calc(100dvh-10rem))] min-h-96 w-full rounded-panel" : "pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] h-[min(32rem,calc(100dvh-6rem))] w-[min(22.5rem,calc(100vw-1.5rem))] rounded-panel shadow-xl transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none sm:right-6 sm:bottom-6", !page && !open && "pointer-events-none invisible translate-y-4 opacity-0")} data-lenis-prevent>
      {!page && <div className="flex shrink-0 items-center justify-between p-2 pl-4">
        <h2 ref={heading} tabIndex={-1} id="general-chat-title" className="text-sm font-semibold outline-none">Chat geral</h2>
        {!page && <div className="flex items-center gap-1"><Button asChild variant="ghost" size="icon-sm"><Link href="/chat" aria-label="Expandir chat" onClick={() => changeOpen(false)}><Maximize className="size-4" aria-hidden="true" /></Link></Button><Button variant="ghost" size="icon-sm" onClick={close} aria-label="Fechar chat"><X className="size-4" aria-hidden="true" /></Button></div>}
      </div>}
      <div ref={list} onScroll={readBottom} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2" data-lenis-prevent aria-label="Mensagens do chat">
        {chat.hasMore && <Button variant="ghost" size="sm" className="mb-3 w-full" loading={loadingOlder} onClick={()=>void older()}>Carregar anteriores</Button>}
        {!chat.ready && !chat.error && <p className="py-8 text-center text-sm text-muted" role="status">Carregando conversa…</p>}
        {chat.ready && chat.items.length===0 && <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem.</p>}
        <div className="space-y-3">{chat.items.reduce<ChatMessage[][]>((groups, message) => {
          const group = groups.at(-1);
          if (group && message.userId && group[0].userId === message.userId) group.push(message);
          else groups.push([message]);
          return groups;
        }, []).map(group => {
          const first = group[0];
          const own = !!userId && first.userId === userId;
          return <div key={first.id} className="flex items-stretch gap-2" data-chat-group>
            {!own && <Avatar className="sticky bottom-0 size-8 shrink-0 self-end"><AvatarImage src={first.avatarUrl??undefined}/><AvatarFallback>{first.name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>}
            <ol className="min-w-0 flex-1">{group.map((message, index) => <Message key={message.id} message={message} grouped={index > 0} admin={permissions.canManageSite} own={own} refresh={chat.refresh} close={()=>changeOpen(false)}/>)}</ol>
          </div>;
        })}</div>
      </div>
      {away && <Button variant="secondary" size="sm" className="mx-auto my-2" onClick={jump}>{chat.unread?`Novas mensagens (${chat.unread})`:"Ir para o final"}</Button>}
      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {chat.error && <div className="mb-3 text-sm text-muted" role="alert">{chat.error} <Button variant="link" size="sm" onClick={chat.refresh}>Tentar novamente</Button></div>}
        {chat.mutedUntil && <p className="mb-3 text-sm text-muted" role="status">Você está silenciado até {new Date(chat.mutedUntil).toLocaleString("pt-BR")}.</p>}
        <form onSubmit={event=>{event.preventDefault();void submit();}} className="flex items-end gap-2">
          <label htmlFor="general-chat-message" className="sr-only">Mensagem</label>
          <Textarea ref={input} id="general-chat-message" placeholder="Mensagem…" enterKeyHint="send" maxLength={500} rows={1} className="min-h-11 max-h-32 resize-none rounded-2xl text-sm" value={text} disabled={sending || !!chat.mutedUntil} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();void submit();}}}/>
        </form>
        {mutationError && <p className="mt-2 text-xs text-muted" role="alert">{mutationError}</p>}
        {!chat.connected && !chat.error && <p className="mt-2 text-xs text-muted" role="status">Reconectando…</p>}
      </div>
    </aside>;
  return page ? <div className="mx-auto flex w-full flex-1 px-(--page-gap)">{content}</div> : <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">{content}</div>;
}
function Message({message,grouped,admin,own,refresh,close}:{message:ChatMessage;grouped:boolean;admin:boolean;own:boolean;refresh:()=>void;close:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  async function moderate(action:()=>Promise<unknown>) {
    setBusy(true);
    try{await action();refresh();}catch(error){toast.error(messageError(error));}finally{setBusy(false);}
  }
  return <li className={cn("group/message relative flex items-start gap-2", grouped ? "mt-1" : "mt-3 first:mt-0", own && "flex-row-reverse")} data-message-id={message.id} data-menu-open={menuOpen} tabIndex={0}>
    <div className={cn("flex min-w-0 max-w-full flex-col items-start", own && "items-end")}>
      {!grouped && <div className="mb-1 truncate px-1 text-xs font-medium text-muted">{message.username?<Link href={`/perfil/${encodeURIComponent(message.username)}`} onClick={close}>{message.name}</Link>:message.name}</div>}
      <div className={cn("flex min-w-0 items-center gap-2", own && "flex-row-reverse")}>
        <p className={cn("min-w-0 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap wrap-anywhere", own ? "bg-brand text-white" : "bg-contrast/6", message.deleted && "italic opacity-70")}>{message.deleted?"Mensagem removida":message.text}</p>
        <time className="shrink-0 text-[0.625rem] text-muted opacity-0 transition-opacity group-hover/message:opacity-100 group-focus/message:opacity-100 group-focus-within/message:opacity-100 motion-reduce:transition-none" dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString("pt-BR")}>{time(message.createdAt)}</time>
      </div>
    </div>
    {admin && <DropdownMenu onOpenChange={setMenuOpen}><DropdownMenuTrigger asChild><Button variant="secondary" size="icon-sm" className={cn("absolute top-0 size-7 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 group-data-[menu-open=true]/message:opacity-100 data-[state=open]:opacity-100 motion-reduce:transition-none", own ? "left-0" : "right-0")} disabled={busy} aria-label={`Moderar mensagem de ${message.name}`}><MoreHorizontal className="size-4" aria-hidden="true"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      {!message.deleted && <DropdownMenuItem onSelect={()=>void moderate(()=>deleteChat(message.id))}>Remover mensagem</DropdownMenuItem>}
      {message.userId && <>{([10,60,1440] as const).map(minutes=><DropdownMenuItem key={minutes} onSelect={()=>void moderate(()=>muteChat(message.userId!,minutes))}>Silenciar por {minutes===10?"10 minutos":minutes===60?"1 hora":"24 horas"}</DropdownMenuItem>)}<DropdownMenuItem onSelect={()=>void moderate(()=>muteChat(message.userId!,0))}>Remover silenciamento</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>}
  </li>;
}
