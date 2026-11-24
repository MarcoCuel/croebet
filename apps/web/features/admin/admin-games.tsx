"use client";

import Link from "next/link";
import { useState } from "react";
import { type GameRecord } from "@croebet/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getGameDefinition } from "@croebet/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { GameCover } from "@/features/games/game-cover";

export function AdminGames({ games }: { games: GameRecord[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const matches = (game: GameRecord, value: string) => value === "all" || game.enabled === (value === "active");
  const visible = games.filter(game => matches(game, status) && normalize(game.name).includes(normalize(search.trim())));
  return <div className="grid min-w-0 gap-4">
    <AdminListHeader create={{ href: "/admin/jogos/novo", label: "Criar jogo" }} filterLabel="Status dos jogos" filters={<>
      {[["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]].map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>
        {label} {status === value && <AdminFilterCount count={games.filter(game => matches(game, value)).length} />}
      </Button>)}
    </>} search={<SearchInput aria-label="Buscar jogos no admin" placeholder="Buscar jogos…" value={search} onChange={event => setSearch(event.target.value)} />} />
    <Card className="overflow-hidden p-0 sm:p-0">
      {visible.length ? <ul aria-label="Jogos" className="divide-y divide-contrast/6">
        {visible.map(game => <li key={game.id}>
          <Link href={`/admin/jogos/${game.id}`} aria-label={game.name} className="flex items-center gap-4 p-5 transition-colors hover:bg-contrast/4 focus-visible:bg-contrast/4 focus-visible:outline-none">
            <div className="size-14 shrink-0">
              <GameCover imageUrl={game.imageUrl} name={game.name} iconClassName="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="break-words font-semibold">{game.name}</span>
              {(getGameDefinition(game.moduleId ?? game.slug)?.developmentOnly ?? true) && <Badge variant="secondary">Em breve</Badge>}
              <Badge variant={game.enabled ? "default" : "secondary"}>{game.enabled ? "Ativo" : "Inativo"}</Badge>
            </div>
          </Link>
        </li>)}
      </ul> : <EmptyState title="Nenhum jogo encontrado." />}
    </Card>
    <Button asChild variant="secondary" className="p-6 pt-16 justify-start">
      <Link href="/admin/jogos/laboratorio">Laboratório 3D</Link>
    </Button>
  </div>;
}
