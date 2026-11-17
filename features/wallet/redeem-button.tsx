"use client";

import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/features/auth/session-context";

export function RedeemButton() {
  const { claimDaily, dailyClaimed } = useDemoSession();
  return (
    <Button size="sm" onClick={claimDaily} disabled={dailyClaimed}>
      {dailyClaimed ? "Resgatado" : "Resgatar"}
    </Button>
  );
}
