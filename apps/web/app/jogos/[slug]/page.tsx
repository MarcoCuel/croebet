import { TestGame } from "@/features/games/test-game";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/shared/heading";
import { getInitialMatches } from "@/features/games/flip7/server-matches";
import { publicMetadata } from "@/features/seo/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flip7Loader } from "@/features/games/flip7/flip7-loader";
import { PageShell } from "@/components/layout/page-shell";
import { getPublicGames } from "@/features/games/server-games";
import { ManagementUnavailable } from "@/features/admin/management-shared";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ partida?: string; teste?: string }> };
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  if (slug === "flip7" && (await searchParams).partida && !data?.items[0]) return { title: "Histórico da partida · Croebet", robots: { index: false, follow: false } };
  return data ? data.items[0] ? await publicMetadata(`/jogos/${slug}`, data.items[0].name, data.items[0].seo) : { title: "Página não encontrada · Croebet", robots: { index: false } } : {};
}
export default async function Game({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getPublicGames(slug);
  if(data?.items[0] && (query.teste==="1" || slug==="love-letter"))return <PageShell><TestGame key={query.partida ?? "new"} game={data.items[0]}/></PageShell>;
  const archivedInitial = slug === "flip7" && query.partida ? await getInitialMatches(query.partida) : null;
  if(data?.items[0] && (archivedInitial?.lobby?.development || archivedInitial?.match?.development))return <PageShell><TestGame key={query.partida ?? "new"} game={data.items[0]}/></PageShell>;
  if (archivedInitial?.replay) return <PageShell><h1 className="sr-only">{data?.items[0]?.name ?? "Histórico da partida"}</h1><Flip7Loader game={data?.items[0] ?? null} initial={archivedInitial} /></PageShell>;
  if (data && data.items.length === 0) notFound();
  if (data && slug !== "flip7") {
    const game = data.items[0];
    return <PageShell><Card className="space-y-4 p-10">
      <Badge variant="secondary">Em breve</Badge>
      <Heading variant="display" asChild><h1>{game.name}</h1></Heading>
      {game.description && <p className="whitespace-pre-line text-muted">{game.description}</p>}
      <p className="text-sm text-muted">Este jogo está em desenvolvimento.</p>
    </Card></PageShell>;
  }
  const initial = data ? archivedInitial ?? await getInitialMatches(query.partida) : null;
  return <PageShell>{data ? <><h1 className="sr-only">{data.items[0].name}</h1><Flip7Loader game={data.items[0]} initial={initial!} /></> : <ManagementUnavailable />}</PageShell>;
}
