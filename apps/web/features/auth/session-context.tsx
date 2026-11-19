"use client";

import { createContext, useContext } from "react";
import type { Prediction } from "@/features/betting/types";
import type { SessionPermissions } from "@/features/auth/permissions";
import type { Economy, DailyStatus } from "@croebet/shared";
import type { Wallet } from "@/features/wallet/wallet";

export type DemoSessionValue = Wallet & {
  username: string | null;
  displayName: string | null;
  usernameChangeAvailableAt: string | null;
  updateUsername: (username: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  sessionReady: boolean;
  permissions: SessionPermissions;
  avatar: string | null;
  updateAvatar: (avatar: File | null) => Promise<void>;
  openLogin: () => void;
  openRegister: () => void;
  signOut: () => void;
  deleteAccount: (password: string) => Promise<void>;
  economy: Economy | null;
  daily: DailyStatus | null;
  walletReady: boolean;
  claimingDaily: boolean;
  refreshAccount: () => Promise<void>;
  refreshWallet: () => Promise<void>;
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
