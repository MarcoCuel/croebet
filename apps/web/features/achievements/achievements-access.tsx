"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoSession } from "@/features/auth/session-context";

export function AchievementsAccess({ children }: { children: ReactNode }) {
  const { sessionReady, username } = useDemoSession();
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && !username) router.replace("/");
  }, [router, sessionReady, username]);

  if (!sessionReady || !username) return null;

  return children;
}
