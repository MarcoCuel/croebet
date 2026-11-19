import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getInitialSession } from "@/features/auth/server-session";
import { ProfileUnavailable } from "@/features/profile/profile-unavailable";
import { PageShell } from "@/components/layout/page-shell";
import { OwnProfile } from "@/features/profile/own-profile";

export const metadata: Metadata = { title: "Perfil · Croebet" };

export default async function OwnProfilePage() {
  const session = await getInitialSession();
  if (session.user) redirect(`/perfil/${encodeURIComponent(session.user.username)}`);
  if (!session.ready) return <PageShell className="pb-12"><ProfileUnavailable /></PageShell>;
  return <PageShell className="pb-12"><OwnProfile /></PageShell>;
}
