import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { OwnProfile } from "@/features/profile/own-profile";

export const metadata: Metadata = { title: "Perfil · Croebet" };

export default function OwnProfilePage() {
  return <PageShell className="pb-12"><OwnProfile /></PageShell>;
}
