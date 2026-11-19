"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { PublicUser } from "@croebet/shared";
import { DemoSession } from "@/features/auth/session-context";
import { AuthDialog } from "@/features/auth/auth-dialog";
import { authRequest } from "@/features/auth/api";

// The context's existing name is retained to avoid a visual/component rewrite.
// Account identity now comes exclusively from the API; local wallets are never loaded.
export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      const version = ++revision.current;
      void authRequest("/me").then(next => { if (mounted && revision.current === version) setUser(next); })
        .catch(() => { /* Keep the last confirmed identity; never fall back to local data. */ })
        .finally(() => { if (mounted) setReady(true); });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { mounted = false; window.removeEventListener("focus", refresh); };
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
    avatar: null,
    balance: 0, transactions: [], predictions: [], lastClaim: "", dailyClaimed: false,
    openLogin: () => openAuth("login"), openRegister: () => openAuth("register"),
    signOut: async () => {
      ++revision.current;
      try { await authRequest("/auth/logout", "POST"); ++revision.current; setUser(null); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair."); }
    },
    updateDisplayName: async displayName => {
      ++revision.current;
      const next = await authRequest("/me/profile", "PATCH", { displayName }); ++revision.current; setUser(next);
    },
    updateAvatar: () => { throw new Error("O envio de avatar estará disponível após a integração de arquivos."); },
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
