import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { getInitialSession } from "@/features/auth/server-session";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export const metadata: Metadata = {
  title: "Admin · Croebet",
  description: null,
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getInitialSession();
  if (!session.ready) return <PageShell><ManagementUnavailable /></PageShell>;
  if (session.user?.role !== "admin") notFound();
  return <PageShell>{children}</PageShell>;
}
