import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { loadProfile } from "@/features/profile/profile-request";
import { publicMetadata } from "@/features/seo/metadata";
import { ProfileUnavailable } from "@/features/profile/profile-unavailable";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileView } from "@/features/profile/profile-view";

const getProfile = cache((username: string) => loadProfile(username, process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"));

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const result = await getProfile((await params).username);
  if (result.status !== "ready") return { title: "Perfil · Croebet", robots: { index: false, follow: false } };
  return publicMetadata(`/perfil/${encodeURIComponent(result.profile.username)}`, result.profile.displayName);
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const result = await getProfile(username);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable") return <PageShell className="pb-12"><ProfileUnavailable /></PageShell>;
  if (username !== result.profile.username) redirect(`/perfil/${encodeURIComponent(result.profile.username)}`);
  return (
    <PageShell className="pb-12">
      <ProfileView profile={result.profile} />
    </PageShell>
  );
}
