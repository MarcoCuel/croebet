"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { GameCover } from "@/features/games/game-cover";
import { useSiteConfig } from "@/features/admin/site-config";

export function AdminGames() {
  const { config, save } = useSiteConfig();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const games = config.games.filter(game =>
    (status === "all" || game.enabled === (status === "active")) &&
    normalize(game.name).includes(normalize(search.trim())),
  );
  return (
    <div className="grid min-w-0 gap-4">
      <h1 className="sr-only">Jogos</h1>
      <AdminListHeader
        filterLabel="Status dos jogos"
        filters={<>
          {[["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]].map(([value, label]) => (
            <Button key={value} size="sm" variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>
              {label} {status === value && <AdminFilterCount count={config.games.filter(game => value === "all" || game.enabled === (value === "active")).length} />}
            </Button>
          ))}
        </>}
        search={<SearchInput aria-label="Buscar jogos no admin" placeholder="Buscar jogos…" value={search} onChange={event => setSearch(event.target.value)} />}
      />
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {games.map((game) => (
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
      {!games.length && <Card className="text-sm text-muted">Nenhum jogo encontrado.</Card>}
    </div>
  );
}
