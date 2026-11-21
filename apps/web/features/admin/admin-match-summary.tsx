import {getGameDefinition,gameSettingBadges,legacyGameIdentity, type MatchHistoryItem} from "@croebet/shared";
import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const matchStatusLabels = { playing: "Em andamento", finished: "Concluída", abandoned: "Encerrada sem vencedor" };
export type HistoryPlayer = MatchHistoryItem["players"][number];

export function MatchPlayerAvatar({ player, className }: { player: Pick<HistoryPlayer, "name" | "avatarUrl">; className?: string }) {
  return <Avatar className={cn("size-8", className)} aria-hidden="true">
    <AvatarImage src={player.avatarUrl ?? undefined} alt="" />
    <AvatarFallback>{Array.from(player.name)[0]?.toLocaleUpperCase("pt-BR") ?? "?"}</AvatarFallback>
  </Avatar>;
}

export function MatchBadges({ match }: { match: Pick<MatchHistoryItem, "status" | "options" | "game"> }) {
  return <div className="flex flex-wrap items-center gap-1.5">
    <Badge variant="secondary" className={match.status === "playing" ? "bg-prediction-yes/10 text-prediction-yes" : undefined}>{matchStatusLabels[match.status]}</Badge>
    {gameSettingBadges(getGameDefinition(match.game ?? legacyGameIdentity.id)!,match.options).map(badge=><Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}
  </div>;
}

export function MatchPlayerIdentity({ player }: { player: HistoryPlayer }) {
  return <span className="inline-flex min-w-0 items-center gap-2">
    <MatchPlayerAvatar player={player} />
    <span className="truncate text-sm">{player.name}</span>
    {player.winner && <Trophy className="size-3.5 shrink-0 text-brand" aria-label="Vencedor" />}
    {player.bot && <Badge variant="secondary">Bot</Badge>}
  </span>;
}
