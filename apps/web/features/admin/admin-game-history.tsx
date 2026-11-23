"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gameSettingLabels, getGameDefinition, matchHistoryListSchema } from "@croebet/shared";
import { resultDuration } from "@/features/games/game-result";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { MatchBadges, MatchPlayerIdentity } from "./admin-match-summary";
import { adminDate } from "./management-shared";
import { managementRequest } from "./management-api";

export function AdminGameHistory({ gameId }: { gameId: string }) {
  const [query, setQuery] = useState("");
  const [source,setSource]=useState("official");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ReturnType<typeof matchHistoryListSchema.parse> | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ source, q: query, status, offset: String(offset) });
      managementRequest(`/admin/games/${gameId}/matches?${params}`, matchHistoryListSchema)
        .then(value => { if (active) setData(value); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as partidas."); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [gameId, source, query, status, offset, retry]);
  function reset() { setData(null); setError(""); setOffset(0); }
  return <Card className="grid min-w-0 gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">Partidas</h2>
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
        <div className="min-w-0 flex-1 sm:w-64"><SearchInput aria-label="Buscar partidas por código ou participante" placeholder="Buscar partida ou participante" maxLength={80} value={query} onChange={event => { reset(); setQuery(event.target.value); }} /></div>
        <Select aria-label="Origem das partidas" value={source} onChange={event=>{reset();setSource(event.target.value);}}><option value="official">Oficiais</option><option value="development">Desenvolvimento</option></Select>
        <Select aria-label="Status das partidas" value={status} onChange={event => { reset(); setStatus(event.target.value); }}>
          <option value="all">Todas</option><option value="playing">Em andamento</option><option value="finished">Concluídas</option><option value="abandoned">Encerradas</option>
        </Select>
      </div>
    </div>
    {source==="development" && data && <div className="grid gap-2 text-sm" aria-label="Médias dos testes"><h3 className="font-medium">Duração média · testes concluídos</h3>{data.averages.length ? data.averages.map((average,index)=><div key={index} className="rounded-lg bg-contrast/6 p-3"><p>{gameSettingLabels(getGameDefinition(average.game)!,average.options).join(" · ")} · {average.players} jogadores · {average.onlyBots?"Só bots":"Com humanos"}</p><p className="mt-1 text-xs text-muted">{average.count} partidas · Total: {resultDuration(Math.round(average.durationSeconds))}{average.activeDurationSeconds != null && ` · Em reprodução: ${resultDuration(Math.round(average.activeDurationSeconds))}`}</p></div>):<p className="text-xs text-muted">Nenhum teste concluído com duração registrada.</p>}</div>}
    {error ? <div role="alert" className="grid justify-items-start gap-4 text-sm">{error}<Button variant="secondary" size="sm" onClick={() => { reset(); setRetry(value => value + 1); }}>Tentar novamente</Button></div>
      : !data ? <p role="status" className="py-5 text-sm text-muted">Carregando partidas…</p>
        : <><ul aria-label="Partidas do jogo" className="divide-y divide-contrast/6">
          {data.items.map(match => {
            const winners = match.players.filter(player => player.winner);
            return <li key={match.id}>
              <Link href={`/admin/jogos/${gameId}/partidas/${match.id}`} aria-label={`Ver histórico da partida ${match.code}`} className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-5 transition-colors hover:bg-contrast/6 focus-visible:outline-foreground">
                <div className="grid min-w-0 flex-1 gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs text-muted">#{match.code}</span><MatchBadges match={match} /></div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{match.players.map(player => <MatchPlayerIdentity key={player.seat} player={player} />)}</div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted"><span>{adminDate(match.startedAt)} · {resultDuration(match.durationSeconds)}</span>{winners.length > 0 && <span className="text-foreground">{winners.length > 1 ? "Vencedores" : "Vencedor"}: {winners.map(player => player.name).join(", ")}</span>}</div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-foreground" aria-hidden="true" />
              </Link>
            </li>;
          })}
        </ul>{!data.items.length && <EmptyState title="Nenhuma partida encontrada." />}
          {(offset > 0 || data.hasMore) && <nav aria-label="Paginação de partidas" className="flex justify-end gap-2 border-t border-contrast/6 pt-4"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => { setData(null); setOffset(value => Math.max(0, value - 20)); }}><ChevronLeft className="size-4" aria-hidden="true" />Anteriores</Button><Button variant="secondary" size="sm" disabled={!data.hasMore} onClick={() => { setData(null); setOffset(value => value + 20); }}>Próximas<ChevronRight className="size-4" aria-hidden="true" /></Button></nav>}</>}
  </Card>;
}
