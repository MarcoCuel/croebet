"use client";

import type { ReactNode } from "react";
import { Clock3, UsersRound } from "lucide-react";
import { maxGamePlayers, type GameDefinition, type GameRecord, type Lobby, type Ranking } from "@croebet/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
import { GameCover } from "./game-cover";
import { GameRanking } from "./game-ranking";
import { GameModeSwitch } from "./mode-switch";

export function LobbyAside({
  game,
  definition,
  development,
  settings,
  userId,
  connected,
  busy,
  creationBlocked,
  showCreate = false,
  playDisabled,
  playLoading = false,
  rules,
  ranking,
  onLogin,
  onPlay,
  onCreate,
}: {
  game: Pick<GameRecord, "name" | "description" | "slug" | "moduleId" | "imageUrl" | "averageDurationSeconds">;
  definition: GameDefinition;
  development: boolean;
  settings: Lobby["options"];
  userId: string | null;
  connected: boolean;
  busy: boolean;
  creationBlocked: boolean;
  showCreate?: boolean;
  playDisabled: boolean;
  playLoading?: boolean;
  rules?: (options: Lobby["options"]) => ReactNode;
  ranking?: Ranking | null;
  onLogin: () => void;
  onPlay: () => void;
  onCreate: () => void;
}) {
  const durationMinutes = game.averageDurationSeconds == null ? null : Math.max(1, Math.round(game.averageDurationSeconds / 60));
  return <aside aria-label="Apresentação do jogo" className="min-w-0 space-y-4 xl:sticky xl:top-[calc(var(--header-height)+1rem)]">
    <Card className="relative isolate aspect-square overflow-hidden p-0">
      <GameCover imageUrl={game.imageUrl} name={game.name} />
      {game.imageUrl && <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" aria-hidden="true" />}
      <div className={cn("absolute inset-0 flex flex-col justify-between gap-10 p-4", game.imageUrl && "text-white")}>
        <div className="flex min-h-6 items-start justify-between gap-3">
          <div>{development && <Badge>Desenvolvimento</Badge>}</div>
          <GameModeSwitch moduleId={game.moduleId} slug={game.slug} development={development} />
        </div>
        <Heading className={cn("relative max-w-full text-4xl leading-tight tracking-tight text-balance", game.imageUrl && "text-white text-shadow-cover")}>{game.name}</Heading>
      </div>
    </Card>
    {!userId ? <Button className="w-full" onClick={onLogin}>Entrar para jogar</Button> : <>
      <Button className="w-full bg-tertiary text-white" loading={playLoading} disabled={playDisabled} onClick={onPlay}>Jogar</Button>
      {showCreate && <Button className="w-full" variant="secondary" disabled={creationBlocked || busy || !connected} onClick={onCreate}>Criar sala</Button>}
    </>}
    <Card className="space-y-4" aria-label="Sobre o jogo">
      <div className="flex flex-wrap gap-2" aria-label="Informações do jogo">
        <Badge variant="secondary" className="gap-2"><UsersRound className="size-4" aria-hidden="true" />{definition.minPlayers} / {maxGamePlayers(definition, definition.defaults)}</Badge>
        {durationMinutes !== null && <Badge variant="secondary" className="gap-2"><Clock3 className="size-4" aria-hidden="true" />{durationMinutes} min.</Badge>}
      </div>
      {game.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{game.description}</p>}
      {rules?.(settings)}
    </Card>
    <GameRanking gameName={game.name} data={ranking ?? null} />
  </aside>;
}
