"use client";

import { ActivityHistoryPanel } from "@/components/shared/activity-history";

export function AccountHistoryPanel({ onNavigate }: { onNavigate?: () => void }) {
  return <ActivityHistoryPanel endpoint="/api/v1/me/history" title="Seu histórico" onNavigate={onNavigate} />;
}
