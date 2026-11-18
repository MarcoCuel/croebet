"use client";

import Link from "next/link";
import { useSiteConfig } from "@/features/admin/site-config";
import { GameCover } from "@/features/games/game-cover";

export function GameGrid() {
  const { config } = useSiteConfig();
  const games = config.games.filter((game) => game.enabled);
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {games.map(({ slug, name }) => (
        <li key={slug}>
          <Link
            className="group block rounded-panel outline-none focus-visible:outline focus-visible:outline-foreground"
            href={`/jogos/${slug}`}
          >
            <GameCover slug={slug} name={name} />
            <h2 className="mt-3 text-sm font-semibold">{name}</h2>
            <p className="mt-1 text-xs text-muted">Ativo</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
