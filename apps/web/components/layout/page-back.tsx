"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type BackHandler = (href: string) => void;
const PageBackContext = createContext<{
  registerBackHandler: (handler: BackHandler) => () => void;
  requestBack: (href: string) => boolean;
} | null>(null);

export function PageBackProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<BackHandler | null>(null);
  const registerBackHandler = useCallback((handler: BackHandler) => {
    handlerRef.current = handler;
    return () => { if (handlerRef.current === handler) handlerRef.current = null; };
  }, []);
  const requestBack = useCallback((href: string) => {
    if (!handlerRef.current) return false;
    handlerRef.current(href);
    return true;
  }, []);
  const value = useMemo(() => ({ registerBackHandler, requestBack }), [registerBackHandler, requestBack]);
  return <PageBackContext.Provider value={value}>{children}</PageBackContext.Provider>;
}

export function usePageBack() {
  const context = useContext(PageBackContext);
  if (!context) throw new Error("usePageBack requires PageBackProvider");
  return context;
}
