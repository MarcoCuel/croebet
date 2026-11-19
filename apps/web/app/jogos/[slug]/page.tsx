import type { Metadata } from "next";
import { Flip7Loader } from "@/features/games/flip7/flip7-loader";
import { PageShell } from "@/components/layout/page-shell";
import { getPublicGames } from "@/features/games/server-games";
import { ManagementUnavailable } from "@/features/admin/management-shared";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  return { title: `${data?.items[0]?.name ?? "Jogo"} · Croebet` };
}
export default async function Game({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  return <PageShell>{data ? <><h1 className="sr-only">{data.items[0].name}</h1><Flip7Loader /></> : <ManagementUnavailable />}</PageShell>;
}
