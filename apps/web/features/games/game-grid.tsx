import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Heading } from "@/components/shared/heading";
import { GameCover } from "@/features/games/game-cover";
import { getPublicGames } from "@/features/games/server-games";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export async function GameGrid() {
  const data = await getPublicGames();
  if (!data) return <ManagementUnavailable />;
  if (!data.items.length) return <EmptyState title="Nenhum jogo disponível." />;
  return <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
    {data.items.map(game => <li key={game.slug}>
      <Link className="group relative isolate block aspect-square overflow-hidden rounded-panel @container" href={`/jogos/${game.slug}`}>
        {(game.moduleId ?? game.slug) !== "flip7" && <Badge variant="secondary" className="absolute top-3 right-3 z-10">Em breve</Badge>}
        <GameCover imageUrl={game.imageUrl} name={game.name} />
        {game.imageUrl && <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" aria-hidden="true" />}
        <Heading variant="cover" asChild className={`absolute inset-x-0 bottom-0 p-3.5 sm:p-4 xl:p-6 ${game.imageUrl ? "text-white" : "text-foreground"}`}><span>{game.name}</span></Heading>
      </Link>
    </li>)}
  </ul>;
}
