import { getInitialMatches } from "@/features/games/flip7/server-matches";
import { publicMetadata } from "@/features/seo/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flip7Loader } from "@/features/games/flip7/flip7-loader";
import { PageShell } from "@/components/layout/page-shell";
import { getPublicGames } from "@/features/games/server-games";
import { ManagementUnavailable } from "@/features/admin/management-shared";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ partida?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  return data ? data.items[0] ? await publicMetadata(`/jogos/${slug}`, data.items[0].name, data.items[0].seo) : { title: "Página não encontrada · Croebet", robots: { index: false } } : {};
}
export default async function Game({ params, searchParams }: Props) {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  if (data && data.items.length === 0) notFound();
  const initial = data ? await getInitialMatches((await searchParams).partida) : null;
  return <PageShell>{data ? <><h1 className="sr-only">{data.items[0].name}</h1><Flip7Loader initial={initial!} /></> : <ManagementUnavailable />}</PageShell>;
}
