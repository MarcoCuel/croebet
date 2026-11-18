"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { readAvatar, persistAvatar } from "@/features/auth/avatar-storage";
import { demoPermissions } from "@/features/auth/permissions";
import { DemoSession } from "@/features/auth/session-context";
import { AuthDialog } from "@/features/auth/auth-dialog";
import {
  persistUsername,
  readUsername,
  readWallet,
  writeWalletStrict,
} from "@/features/auth/session-storage";
import {
  commitWallet,
  placeLocalPrediction,
} from "@/features/betting/betting-storage";
import {
  readDisplayName,
  persistDisplayName,
} from "@/features/auth/profile-storage";
import { demoDataEvent, announceDemoData } from "@/lib/demo-storage";
import {
  addCroins,
  claimReward,
  dailyReward,
  initialWallet,
  today,
  type Wallet,
} from "@/features/wallet/wallet";

type SessionState = {
  username: string | null;
  displayName: string | null;
  wallet: Wallet;
  avatar: string | null;
  ready: boolean;
};
export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    username: null,
    displayName: null,
    wallet: initialWallet,
    avatar: null,
    ready: false,
  });
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [date, setDate] = useState("");
  const authTrigger = useRef<HTMLElement | null>(null);
  const { username, wallet } = state;
  const permissions = demoPermissions(
    username,
    process.env.NEXT_PUBLIC_DEMO_ADMIN_USERS,
    process.env.NODE_ENV === "development",
  );
  function loadSession(name: string | null) {
    const wallet = name ? readWallet(name) : initialWallet;
    if (name)
      try {
        if (!localStorage.getItem(`croebet:demo-wallet:${name.toLowerCase()}`))
          writeWalletStrict(name, wallet);
      } catch {
        toast.error("Não foi possível preparar a carteira neste navegador.");
      }
    return {
      username: name,
      displayName: name ? readDisplayName(name) : null,
      wallet,
      avatar: name ? readAvatar(name) : null,
      ready: true,
    };
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadSession(readUsername()));
    setDate(today());
    const timer = window.setInterval(() => setDate(today()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    function refresh(event: Event) {
      if (
        event instanceof StorageEvent &&
        event.key === "croebet:demo-username"
      ) {
        setState(loadSession(readUsername()));
        return;
      }
      if (username)
        setState((current) => ({
          ...current,
          wallet: readWallet(username),
          displayName: readDisplayName(username),
        }));
    }
    window.addEventListener(demoDataEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(demoDataEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [username]);
  function openAuth(mode: "login" | "register") {
    authTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setAuthMode(mode);
  }
  function signIn(name: string | null) {
    persistUsername(name);
    setState(loadSession(name));
    setAuthMode(null);
  }
  async function mutate(update: (wallet: Wallet) => Wallet) {
    if (!username) return false;
    try {
      return await commitWallet(username, update);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a carteira.",
      );
      return false;
    }
  }
  async function claimDaily() {
    if (!username) {
      openAuth("login");
      return;
    }
    const claimDate = today();
    setDate(claimDate);
    if (await mutate((wallet) => claimReward(wallet, claimDate)))
      toast.success(`${dailyReward} Croins resgatados.`);
  }
  return (
    <DemoSession.Provider
      value={{
        username,
        displayName: state.displayName,
        updateDisplayName: (value) => {
          if (
            !username ||
            readUsername()?.toLowerCase() !== username.toLowerCase()
          )
            throw new Error("A sessão mudou. Atualize a página.");
          const displayName = persistDisplayName(username, value);
          setState((current) => ({ ...current, displayName }));
          announceDemoData();
        },
        sessionReady: state.ready,
        permissions,
        avatar: state.avatar,
        updateAvatar: (avatar) => {
          if (!username) return;
          persistAvatar(username, avatar);
          setState((s) => ({ ...s, avatar }));
        },
        ...wallet,
        openLogin: () => openAuth("login"),
        openRegister: () => openAuth("register"),
        signOut: () => signIn(null),
        dailyClaimed: Boolean(username && wallet.lastClaim === date),
        claimDaily,
        addBalance: (amount) => {
          if (permissions.canManageSite)
            void mutate((wallet) => addCroins(wallet, amount));
        },
        clearPredictions: () => {
          if (process.env.NODE_ENV === "development")
            void mutate((wallet) => ({
              ...wallet,
              predictions: wallet.predictions.filter((p) => p.id),
            }));
        },
        placePrediction: async (prediction) => {
          if (!username) return false;
          try {
            return await placeLocalPrediction(username, prediction);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Não foi possível registrar a aposta.",
            );
            return false;
          }
        },
      }}
    >
      {children}
      <AuthDialog
        open={authMode !== null}
        isRegistering={authMode === "register"}
        onOpenChange={(open) => {
          if (!open) setAuthMode(null);
        }}
        setIsRegistering={(register) =>
          setAuthMode(register ? "register" : "login")
        }
        onSignIn={signIn}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          authTrigger.current?.focus();
        }}
      />
    </DemoSession.Provider>
  );
}
