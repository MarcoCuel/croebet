import { getInitialSession } from "@/features/auth/server-session";
import { GameModeSwitch } from "@/features/games/mode-switch";
import { TestGame } from "@/features/games/test-game";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/shared/heading";
import { getGameDefinition, gameIdSchema, matchCodeSchema, type GameRecord } from "@croebet/shared";
import { gameServerLoaders } from "@/features/games/server-registry";
import { publicMetadata } from "@/features/seo/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameScreen } from "@/features/games/game-screen";
import { PageShell } from "@/components/layout/page-shell";
import { getInitialMatches, getInitialTestRoom } from "@/features/games/server-matches";
import { getPublicGames } from "@/features/games/server-games";
import { getRanking } from "@/features/rankings/server-rankings";
import { ManagementUnavailable } from "@/features/admin/management-shared";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ partida?: string; teste?: string }> };
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicGames(slug);
  if ((await searchParams).partida && !data?.items[0]) return { title: "Histórico da partida · Croebet", robots: { index: false, follow: false } };
  return data ? data.items[0] ? await publicMetadata(`/jogos/${data.items[0].slug}`, data.items[0].name, data.items[0].seo, `/jogos/${encodeURIComponent(data.items[0].slug)}/og`) : { title: "Página não encontrada · Croebet", robots: { index: false } } : {};
}
async function renderTestGame(game: GameRecord, code?: string) {
  if (code && !matchCodeSchema.safeParse(code).success) notFound();
  const [room, ranking] = await Promise.all([
    code ? getInitialTestRoom(code) : null,
    getRanking({ category: "wins", period: "all", page: 1, game: game.slug }),
  ]);
  if (code && !room) return <PageShell><ManagementUnavailable /></PageShell>;
  if (room && room.game !== (game.moduleId ?? game.slug)) notFound();
  return <PageShell><TestGame key={code ?? "new"} game={game} initialRoom={room} ranking={ranking}/></PageShell>;
}

export default async function Game({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getPublicGames(slug);
  const moduleId = data?.items[0]?.moduleId ?? slug;
  const definition=getGameDefinition(moduleId);
  const registered=gameIdSchema.safeParse(moduleId);
  const loadInitial=registered.success?gameServerLoaders[registered.data]:undefined;
  let developmentOnlyAdmin=false;
  if(query.teste==="1" || definition?.developmentOnly){
    const session=await getInitialSession();
    if(!session.ready)return <PageShell><ManagementUnavailable /></PageShell>;
    if(query.teste==="1" && session.user?.role!=="admin")notFound();
    developmentOnlyAdmin=!!definition?.developmentOnly && session.user?.role==="admin";
  }
  if(data?.items[0] && (developmentOnlyAdmin || query.teste==="1" || (definition?.developmentOnly && !!query.partida)))return renderTestGame(data.items[0], query.partida);
  const archivedInitial = query.partida ? await (loadInitial ? loadInitial(query.partida) : getInitialMatches(query.partida)) : null;
  if(data?.items[0] && (archivedInitial?.lobby?.development || archivedInitial?.match?.development))return renderTestGame(data.items[0], query.partida);
  if (archivedInitial?.replay) return <PageShell><h1 className="sr-only">{data?.items[0]?.name ?? "Histórico da partida"}</h1><GameScreen slug={archivedInitial.replay.match.game ?? "flip7"} game={data?.items[0] ?? null} initial={archivedInitial} /></PageShell>;
  if (data && data.items.length === 0) notFound();
  if (data && (!loadInitial || definition?.developmentOnly)) {
    const game = data.items[0];
    return <PageShell><Card className="space-y-4 p-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><Badge variant="secondary">Em breve</Badge><GameModeSwitch slug={slug}/></div>
      <Heading variant="display" asChild><h1>{game.name}</h1></Heading>
      {game.description && <p className="whitespace-pre-line text-muted">{game.description}</p>}
      <p>Ainda em desenvolvimento</p>
    </Card></PageShell>;
  }
  const initial = data ? archivedInitial ?? (loadInitial?await loadInitial(query.partida):null) : null;
  const ranking = data && initial && !initial.match && !initial.replay && !initial.unavailable
    ? await getRanking({ category: "wins", period: "all", page: 1, game: data.items[0].slug })
    : null;
  return <PageShell>{data ? <><h1 className="sr-only">{data.items[0].name}</h1><GameScreen slug={slug} game={data.items[0]} initial={initial!} ranking={ranking} /></> : <ManagementUnavailable />}</PageShell>;
}
