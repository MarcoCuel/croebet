"use client";
import { randomUUID } from "@/lib/uuid";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InitialSession } from "@/features/auth/initial-session";
import type { Economy, DailyStatus, PublicUser } from "@croebet/shared";
import { SessionContext } from "@/features/auth/session-context";
import { AuthDialog } from "@/features/auth/auth-dialog";
import { ProfileOnboarding } from "@/features/auth/profile-onboarding";
import { loadEconomy, loadDailyStatus, requestDailyClaim } from "@/features/wallet/economy-api";
import { authRequest } from "@/features/auth/api";
import { subscribeRealtimeFailure } from "@/lib/realtime";

// Account identity now comes exclusively from the API; local wallets are never loaded.
export function SessionProvider({ children, initialSession }: { children: ReactNode; initialSession: InitialSession }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(initialSession.user);
  const [economy, setEconomy] = useState<Economy | null>(initialSession.economy ?? null);
  const [wallet, setWallet] = useState<{ userId: string; daily: DailyStatus } | null>(initialSession.user && initialSession.daily ? { userId: initialSession.user.id, daily: initialSession.daily } : null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const pendingClaim = useRef(false);
  const claimRequest = useRef<{ userId: string; id: string } | null>(null);
  const daily = wallet?.userId === user?.id ? wallet?.daily ?? null : null;
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
      void authRequest("/me").then(async next => {
        const [nextEconomy, nextDaily] = await Promise.all([loadEconomy(), next ? loadDailyStatus() : Promise.resolve(null)]);
        if (mounted && revision.current === version) {
          setUser(next); setReady(true);
          if (nextEconomy) setEconomy(nextEconomy);
          if (!next) setWallet(null);
          else if (nextDaily) setWallet({ userId: next.id, daily: nextDaily });
        }
      }).catch(() => {
        // Retain the confirmed session, or the loading state until a successful retry.
        if (mounted && revision.current === version) retry = setTimeout(refresh, 15000);
      });
    };
    refresh(); window.addEventListener("focus", refresh);
    return () => { mounted = false; clearTimeout(retry); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => subscribeRealtimeFailure(failure => {
    toast.error(failure.message);
    if (failure.code === "UNAUTHENTICATED") {
      void authRequest("/me").then(next => {
        if (!next) { setUser(null); setWallet(null); }
      }).catch(() => {});
    }
  }), []);
  function openAuth(mode: "login" | "register") {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAuthMode(mode);
  }
  return <SessionContext.Provider value={{
    userId: user?.id ?? null,
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
    balance: daily?.balance ?? 0,
    refreshAccount: async () => {
      const version = ++revision.current;
      const next = await authRequest("/me");
      if (version !== revision.current) return;
      setUser(next); setReady(true);
      if (!next) setWallet(null);
    },
    refreshWallet: async () => {
      const accountId = user?.id;
      const version = revision.current;
      const [nextEconomy, nextDaily] = await Promise.all([loadEconomy(), accountId ? loadDailyStatus() : Promise.resolve(null)]);
      if (revision.current !== version) return;
      if (nextEconomy) setEconomy(nextEconomy);
      if (accountId && nextDaily) setWallet({ userId: accountId, daily: nextDaily });
      if (!nextEconomy || (accountId && !nextDaily)) toast.error("Carteira temporariamente indisponível.");
    },
    economy, daily, walletReady: daily !== null, claimingDaily,
    dailyClaimed: daily !== null && !daily.eligible,
    openLogin: () => openAuth("login"), openRegister: () => openAuth("register"),
    signOut: async () => {
      ++revision.current;
      try { await authRequest("/auth/logout", "POST"); ++revision.current; setUser(null); setWallet(null); router.refresh(); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair."); }
    },
    deleteAccount: async password => {
      ++revision.current;
      await authRequest("/me", "DELETE", { password });
      ++revision.current; setUser(null); setWallet(null); router.refresh();
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
    claimDaily: async () => {
      if (!user) { openAuth("login"); return; }
      if (pendingClaim.current) return;
      pendingClaim.current = true; setClaimingDaily(true);
      const accountId = user.id;
      const version = revision.current;
      if (claimRequest.current?.userId !== accountId) claimRequest.current = { userId: accountId, id: randomUUID() };
      try {
        const next = await requestDailyClaim(claimRequest.current.id);
        if (revision.current === version) {
          setWallet({ userId: accountId, daily: next });
          claimRequest.current = null;
          toast.success("Croins resgatados."); router.refresh();
        }
      } catch (error) {
        if (revision.current === version) {
          toast.error(error instanceof Error ? error.message : "Não foi possível resgatar.");
          const next = await loadDailyStatus();
          if (next && revision.current === version) setWallet({ userId: accountId, daily: next });
        }
      } finally { pendingClaim.current = false; setClaimingDaily(false); }
    },
  }}>{children}<AuthDialog
    open={authMode !== null} isRegistering={authMode === "register"}
    onOpenChange={open => { if (!open) setAuthMode(null); }}
    setIsRegistering={value => setAuthMode(value ? "register" : "login")}
    onSignIn={async (username, password) => {
      const registering = authMode === "register";
      ++revision.current;
      const next = await authRequest(registering ? "/auth/register" : "/auth/login", "POST", { username, password });
      const nextDaily = next ? await loadDailyStatus() : null;
      ++revision.current; setUser(next); setWallet(next && nextDaily ? { userId: next.id, daily: nextDaily } : null);
      setReady(true); setAuthMode(null);
      router.refresh();
    }}
    onCloseAutoFocus={event => {
      event.preventDefault();
      if (!user?.onboarding || (user.onboarding.nameProvided && user.avatarUrl) || (user.onboarding.remindAt && Date.parse(user.onboarding.remindAt) > Date.now())) trigger.current?.focus();
    }}
  />{user?.onboarding && (!user.onboarding.nameProvided || !user.avatarUrl) && <ProfileOnboarding
    key={`${user.id}:${user.onboarding.remindAt}`}
    remindAt={user.onboarding.remindAt}
    onDefer={async () => {
      const accountId = user.id;
      ++revision.current;
      const next = await authRequest("/me/onboarding/defer", "POST");
      ++revision.current;
      setUser(current => current?.id === accountId && next?.id === accountId ? next : current);
      router.refresh();
    }} onComplete={() => {
    router.refresh();
  }} />}</SessionContext.Provider>;
}
