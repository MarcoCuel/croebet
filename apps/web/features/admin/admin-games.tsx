"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GameCover } from "@/features/games/game-cover";
import { useSiteConfig } from "@/features/admin/site-config";

export function AdminGames() {
  const { config, save } = useSiteConfig();
  return (
    <>
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {config.games.map((game) => (
          <li key={game.slug} className="min-w-0">
            <Card className="h-full p-3 sm:p-3">
              <Link
                href={`/admin/jogos/${game.slug}`}
                aria-label={`Editar ${game.name}`}
                className="group block rounded-panel outline-none focus-visible:outline focus-visible:outline-foreground"
              >
                <GameCover slug={game.slug} name={game.name} />
                <h3 className="mt-3 text-sm font-semibold">{game.name}</h3>
              </Link>
              <p className="mt-1 text-xs text-muted">
                {game.enabled ? "Ativo" : "Inativo"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/jogos/${game.slug}`}>Editar</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    save({
                      ...config,
                      games: config.games.map((g) =>
                        g.slug === game.slug
                          ? { ...g, enabled: !g.enabled }
                          : g,
                      ),
                    })
                  }
                >
                  {game.enabled ? "Pausar" : "Ativar"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
