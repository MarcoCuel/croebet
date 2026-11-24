"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { useSession } from "@/features/auth/session-context";
import { useChat } from "./use-chat";

type ChatContextValue = {
  chat: ReturnType<typeof useChat>;
  open: boolean;
  text: string;
  setText: (text: string) => void;
  pendingRef: RefObject<{ requestId: string; text: string } | null>;
  changeOpen: (open: boolean, restoreFocus?: boolean, trigger?: HTMLElement | null) => void;
};
const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  return userId
    ? <AccountChatProvider key={userId} userId={userId}>{children}</AccountChatProvider>
    : <ChatContext.Provider value={null}>{children}</ChatContext.Provider>;
}

function AccountChatProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const chat = useChat(userId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const pendingRef = useRef<{ requestId: string; text: string } | null>(null);
  const triggerRef = useRef<HTMLElement>(null);

  function changeOpen(value: boolean, restoreFocus = false, trigger?: HTMLElement | null) {
    if (trigger) triggerRef.current = trigger;
    setOpen(value);
    chat.setViewing(value);
    if (value) {
      chat.markRead();
      chat.refresh();
    } else if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  return <ChatContext.Provider value={{ chat, open, changeOpen, text, setText, pendingRef }}>{children}</ChatContext.Provider>;
}

export function useGeneralChat() {
  return useContext(ChatContext);
}
