"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { readAvatar, persistAvatar } from "@/features/auth/avatar-storage";
import { demoPermissions } from "@/features/auth/permissions";
import { DemoSession } from "./session-context";
import { AuthDialog } from "./auth-dialog";
import {
  persistUsername,
  persistWallet,
  readUsername,
  readWallet,
} from "./session-storage";
import {
  addCroins,
  claimReward,
  dailyReward,
  initialWallet,
  registerPrediction,
  today,
  type Wallet,
} from "@/features/wallet/wallet";
import type { Prediction } from "@/features/betting/types";

type SessionState = {
  username: string | null;
  wallet: Wallet;
  avatar: string | null;
  ready: boolean;
};
type Action =
  | {
      type: "session";
      username: string | null;
      wallet: Wallet;
      avatar: string | null;
    }
  | { type: "avatar"; avatar: string | null }
  | { type: "clear-predictions" }
  | { type: "predict"; prediction: Prediction }
  | { type: "claim"; date: string }
  | { type: "add"; amount: number };

function sessionReducer(state: SessionState, action: Action): SessionState {
  if (action.type === "session")
    return {
      username: action.username,
      wallet: action.wallet,
      avatar: action.avatar,
      ready: true,
    };
  if (!state.username) return state;
  if (action.type === "avatar") return { ...state, avatar: action.avatar };
  if (action.type === "clear-predictions")
    return process.env.NODE_ENV === "development"
      ? { ...state, wallet: { ...state.wallet, predictions: [] } }
      : state;
  if (action.type === "predict")
    return {
      ...state,
      wallet: registerPrediction(state.wallet, action.prediction),
    };
  if (action.type === "claim")
    return { ...state, wallet: claimReward(state.wallet, action.date) };
  if (
    !demoPermissions(
      state.username,
      process.env.NEXT_PUBLIC_DEMO_ADMIN_USERS,
      process.env.NODE_ENV === "development",
    ).canManageSite
  )
    return state;
  return { ...state, wallet: addCroins(state.wallet, action.amount) };
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, {
    username: null,
    avatar: null,
    wallet: initialWallet,
    ready: false,
  });
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [date, setDate] = useState("");
  const authTrigger = useRef<HTMLElement | null>(null);
  const { username, wallet } = state;

  useEffect(() => {
    const name = readUsername();
    dispatch({
      type: "session",
      username: name,
      avatar: name ? readAvatar(name) : null,
      wallet: name ? readWallet(name) : initialWallet,
    });
    // Hydrate the browser date after SSR; storage must load before persistence runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(today());
    const timer = window.setInterval(() => setDate(today()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.ready && username) persistWallet(username, wallet);
  }, [state.ready, username, wallet]);

  function openAuth(mode: "login" | "register") {
    authTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setAuthMode(mode);
  }

  function signIn(name: string | null) {
    persistUsername(name);
    dispatch({
      type: "session",
      username: name,
      avatar: name ? readAvatar(name) : null,
      wallet: name ? readWallet(name) : initialWallet,
    });
    setAuthMode(null);
  }

  function claimDaily() {
    if (!username) {
      openAuth("login");
      return;
    }
    const claimDate = today();
    setDate(claimDate);
    if (
      wallet.lastClaim === claimDate ||
      readWallet(username).lastClaim === claimDate
    )
      return;
    dispatch({ type: "claim", date: claimDate });
    toast.success(`${dailyReward} Croins resgatados.`);
  }

  return (
    <DemoSession.Provider
      value={{
        username,
        sessionReady: state.ready,
        permissions: demoPermissions(
          username,
          process.env.NEXT_PUBLIC_DEMO_ADMIN_USERS,
          process.env.NODE_ENV === "development",
        ),
        avatar: state.avatar,
        updateAvatar: (avatar) => {
          if (!username) return;
          persistAvatar(username, avatar);
          dispatch({ type: "avatar", avatar });
        },
        ...wallet,
        openLogin: () => openAuth("login"),
        openRegister: () => openAuth("register"),
        signOut: () => signIn(null),
        dailyClaimed: Boolean(username && wallet.lastClaim === date),
        claimDaily,
        addBalance: (amount) => dispatch({ type: "add", amount }),
        clearPredictions: () => dispatch({ type: "clear-predictions" }),
        placePrediction: (prediction) =>
          dispatch({ type: "predict", prediction }),
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
