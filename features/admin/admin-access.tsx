"use client";

import type { AdminSection } from "@/features/admin/routes";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { useDemoSession } from "@/features/auth/session-context";

// Do not mount the administration UI or load its bundle before authorization.
const AdminPanel = dynamic(() =>
  import("@/features/admin/admin-panel").then((module) => module.AdminPanel),
);

export function AdminAccess({
  section = "overview",
  gameSlug,
  marketId,
}: {
  section?: AdminSection;
  gameSlug?: string;
  marketId?: string;
}) {
  const { sessionReady, permissions } = useDemoSession();
  if (!sessionReady) return null;
  if (!permissions.canManageSite) notFound();
  return (
    <AdminPanel section={section} gameSlug={gameSlug} marketId={marketId} />
  );
}
