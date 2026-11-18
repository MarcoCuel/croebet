"use client";

import { createContext, useContext } from "react";
import type { Prediction } from "@/features/betting/types";
import type { SessionPermissions } from "@/features/auth/permissions";
import type { Wallet } from "@/features/wallet/wallet";

export type DemoSessionValue = Wallet & {
  username: string | null;
  sessionReady: boolean;
  permissions: SessionPermissions;
  avatar: string | null;
  updateAvatar: (avatar: string | null) => void;
  openLogin: () => void;
  openRegister: () => void;
  signOut: () => void;
  dailyClaimed: boolean;
  claimDaily: () => void;
  addBalance: (amount: number) => void;
  clearPredictions: () => void;
  placePrediction: (prediction: Prediction) => Promise<boolean>;
};

export const DemoSession = createContext<DemoSessionValue | null>(null);

export function useDemoSession() {
  const session = useContext(DemoSession);
  if (!session) throw new Error("useDemoSession requires DemoSessionProvider");
  return session;
}
