"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { gameSchema, type GameRecord } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { managementRequest } from "@/features/admin/management-api";

export function AdminGames({ games }: { games: GameRecord[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const matches = (game: GameRecord, value: string) => value === "all" || game.enabled === (value === "active");
  const visible = games.filter(game => matches(game, status) && normalize(game.name).includes(normalize(search.trim())));
  return <div className="grid min-w-0 gap-4">
    <h1 className="sr-only">Jogos</h1>
    <AdminListHeader filterLabel="Status dos jogos" filters={<>
      {[["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]].map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "secondary" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>
        {label} {status === value && <AdminFilterCount count={games.filter(game => matches(game, value)).length} />}
      </Button>)}
    </>} search={<SearchInput aria-label="Buscar jogos no admin" placeholder="Buscar jogos…" value={search} onChange={event => setSearch(event.target.value)} />} />
    <Card className="overflow-hidden p-0 sm:p-0">
      {visible.length ? <ul aria-label="Jogos" className="divide-y divide-contrast/6">
        {visible.map(game => <li key={game.slug} className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <Link className="break-words font-semibold hover:underline" href={`/admin/jogos/${game.slug}`}>{game.name}</Link>
              <Badge variant={game.enabled ? "default" : "secondary"}>{game.enabled ? "Ativo" : "Inativo"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">/jogos/{game.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><Link href={`/admin/jogos/${game.slug}`}>Editar</Link></Button>
            <Button size="sm" variant="outline" loading={pending === game.slug} disabled={!!pending} onClick={async () => {
              if (pending) return;
              setPending(game.slug);
              try {
                await managementRequest(`/admin/games/${game.slug}`, gameSchema, "PATCH", { name: game.name, imageUrl: game.imageUrl, enabled: !game.enabled, version: game.version });
                toast.success(game.enabled ? "Jogo pausado." : "Jogo ativado."); router.refresh();
              } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o jogo."); }
              finally { setPending(null); }
            }}>{game.enabled ? "Pausar" : "Ativar"}</Button>
          </div>
        </li>)}
      </ul> : <p className="p-5 text-sm text-muted">Nenhum jogo encontrado.</p>}
    </Card>
  </div>;
}
