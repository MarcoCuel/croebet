"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import { useSession } from "@/features/auth/session-context";
import { useChat } from "./use-chat";

type ChatContextValue = {
  chat: ReturnType<typeof useChat>;
  open: boolean;
  changeOpen: (open: boolean, restoreFocus?: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  function changeOpen(value: boolean, restoreFocus = false) {
    setOpen(value);
    chat.setViewing(value);
    if (value) {
      chat.markRead();
      chat.refresh();
    } else if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  return <ChatContext.Provider value={{ chat, open, changeOpen, triggerRef }}>{children}</ChatContext.Provider>;
}

export function useGeneralChat() {
  return useContext(ChatContext);
}
