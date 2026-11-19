import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileView } from "@/features/profile/profile-view";

export const metadata: Metadata = { title: "Perfil · Croebet" };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <PageShell className="pb-12">
      <ProfileView key={username} username={username} />
    </PageShell>
  );
}
