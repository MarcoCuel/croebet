"use client";

import type { ReactNode } from "react";
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
  pageSlug,
  userId,
  couponId,
  content,
}: {
  content?: ReactNode;
  section?: AdminSection;
  gameSlug?: string;
  marketId?: string;
  pageSlug?: string;
  userId?: string;
  couponId?: string;
}) {
  const { sessionReady, permissions } = useDemoSession();
  if (!sessionReady) return null;
  if (!permissions.canManageSite) notFound();
  return (
    <AdminPanel
      content={content}
      section={section}
      gameSlug={gameSlug}
      marketId={marketId}
      pageSlug={pageSlug}
      userId={userId}
      couponId={couponId}
    />
  );
}
