"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import type { DailyStatus } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";

export function DailyBonusButton() {
  const { daily, username, claimDaily, claimingDaily } = useSession();
  const [availableSnapshot, setAvailableSnapshot] = useState<DailyStatus | null>(null);

  useEffect(() => {
    if (!daily || daily.eligible || !daily.nextClaimAt) return;
    const remaining = Math.max(0, Date.parse(daily.nextClaimAt) - Date.parse(daily.serverNow));
    const timer = window.setTimeout(() => setAvailableSnapshot(daily), remaining);
    return () => window.clearTimeout(timer);
  }, [daily]);

  if (!username || !daily || (!daily.eligible && availableSnapshot !== daily)) return null;

  return (
    <Button
      variant="default"
      aria-label="Resgatar bônus diário"
      title="Resgatar bônus diário"
      disabled={claimingDaily}
      aria-busy={claimingDaily || undefined}
      onClick={claimDaily}
    >
      <Gift className="size-4" aria-hidden="true" />
      Bônus diário
    </Button>
  );
}
