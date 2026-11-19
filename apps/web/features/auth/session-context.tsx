"use client";

import { createContext, useContext } from "react";
import type { SessionPermissions } from "@/features/auth/permissions";
import type { Economy, DailyStatus } from "@croebet/shared";

export type SessionValue = {
  userId: string | null;
  balance: number;
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
};

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession requires SessionProvider");
  return session;
}
