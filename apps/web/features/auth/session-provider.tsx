"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { InitialSession } from "@/features/auth/initial-session";
import type { PublicUser } from "@croebet/shared";
import { DemoSession } from "@/features/auth/session-context";
import { AuthDialog } from "@/features/auth/auth-dialog";
import { authRequest } from "@/features/auth/api";

// The context's existing name is retained to avoid a visual/component rewrite.
// Account identity now comes exclusively from the API; local wallets are never loaded.
export function DemoSessionProvider({ children, initialSession }: { children: ReactNode; initialSession: InitialSession }) {
  const [user, setUser] = useState<PublicUser | null>(initialSession.user);
  const [ready, setReady] = useState(initialSession.ready);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    let mounted = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(retry);
      const version = ++revision.current;
      void authRequest("/me").then(next => {
        if (mounted && revision.current === version) { setUser(next); setReady(true); }
      }).catch(() => {
        // Retain the confirmed session, or the loading state until a successful retry.
        if (mounted && revision.current === version) retry = setTimeout(refresh, 15000);
      });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { mounted = false; clearTimeout(retry); window.removeEventListener("focus", refresh); };
  }, []);
  function openAuth(mode: "login" | "register") {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAuthMode(mode);
  }
  const unavailable = () => { toast.info("Este recurso ainda não está disponível."); };
  return <DemoSession.Provider value={{
    username: user?.username ?? null,
    displayName: user?.displayName ?? null,
    usernameChangeAvailableAt: user?.usernameChangeAvailableAt ?? null,
    updateUsername: async username => {
      ++revision.current;
      const next = await authRequest("/me/username", "PATCH", { username }); ++revision.current; setUser(next);
    },
    sessionReady: ready,
    permissions: { canManageSite: user?.role === "admin" },
    avatar: user?.avatarUrl ?? null,
    balance: 0, transactions: [], predictions: [], lastClaim: "", dailyClaimed: false,
    openLogin: () => openAuth("login"), openRegister: () => openAuth("register"),
    signOut: async () => {
      ++revision.current;
      try { await authRequest("/auth/logout", "POST"); ++revision.current; setUser(null); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair."); }
    },
    deleteAccount: async password => {
      ++revision.current;
      await authRequest("/me", "DELETE", { password });
      ++revision.current; setUser(null);
    },
    updateDisplayName: async displayName => {
      ++revision.current;
      const next = await authRequest("/me/profile", "PATCH", { displayName }); ++revision.current; setUser(next);
    },
    updateAvatar: async file => {
      const accountId = user?.id;
      ++revision.current;
      const next = await authRequest("/me/avatar", file ? "PUT" : "DELETE", file ?? undefined);
      ++revision.current;
      setUser(current => current?.id === accountId && next?.id === accountId ? next : current);
    },
    claimDaily: unavailable, addBalance: unavailable, clearPredictions: unavailable,
    placePrediction: async () => { unavailable(); return false; },
  }}>{children}<AuthDialog
    open={authMode !== null} isRegistering={authMode === "register"}
    onOpenChange={open => { if (!open) setAuthMode(null); }}
    setIsRegistering={value => setAuthMode(value ? "register" : "login")}
    onSignIn={async (username, password) => {
      ++revision.current;
      const next = await authRequest(authMode === "register" ? "/auth/register" : "/auth/login", "POST", { username, password });
      ++revision.current; setUser(next); setReady(true); setAuthMode(null);
    }}
    onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
  /></DemoSession.Provider>;
}
