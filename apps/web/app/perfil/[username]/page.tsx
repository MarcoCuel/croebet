import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadProfile } from "@/features/profile/profile-request";
import { ProfileUnavailable } from "@/features/profile/profile-unavailable";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileView } from "@/features/profile/profile-view";

export const metadata: Metadata = { title: "Perfil · Croebet" };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const result = await loadProfile(username, process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001");
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <PageShell className="pb-12"><ProfileUnavailable /></PageShell>;
  if (username !== result.profile.username) redirect(`/perfil/${encodeURIComponent(result.profile.username)}`);
  return (
    <PageShell className="pb-12">
      <ProfileView profile={result.profile} />
    </PageShell>
  );
}
