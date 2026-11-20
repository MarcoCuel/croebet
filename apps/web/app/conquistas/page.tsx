import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { getOwnAchievements } from "@/features/achievements/server-achievements";
import { AchievementsView } from "@/features/achievements/achievements-view";
import { AchievementsUnavailable } from "@/features/achievements/achievements-unavailable";
export const metadata: Metadata = { title: "Conquistas · Croebet" };
export default async function Conquistas() {
  const result = await getOwnAchievements();
  if (result.status === "unauthenticated") redirect("/");
  return <PageShell>{result.status === "ok" ? <AchievementsView data={result.data} /> : <AchievementsUnavailable />}</PageShell>;
}
