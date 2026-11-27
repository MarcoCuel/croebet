"use client";

import type { ReactNode } from "react";
import { Clock3, UsersRound } from "lucide-react";
import { maxGamePlayers, type GameDefinition, type GameRecord, type Lobby } from "@croebet/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
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
  onLogin,
  onPlay,
  onCreate,
}: {
  game: Pick<GameRecord, "name" | "description" | "slug" | "moduleId" | "averageDurationSeconds">;
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
  onLogin: () => void;
  onPlay: () => void;
  onCreate: () => void;
}) {
  const durationMinutes = game.averageDurationSeconds == null ? null : Math.max(1, Math.round(game.averageDurationSeconds / 60));
  return <aside aria-label="Apresentação do jogo" className="min-w-0 space-y-4 xl:sticky xl:top-[calc(var(--header-height)+1rem)]">
    <Card className="relative isolate flex min-h-52 flex-col justify-between gap-10 overflow-hidden">
      <div className="flex min-h-6 items-start justify-between gap-3">
        <div>{development && <Badge>Desenvolvimento</Badge>}</div>
        <GameModeSwitch moduleId={game.moduleId} slug={game.slug} development={development} />
      </div>
      <Heading className="relative max-w-full text-4xl leading-tight tracking-tight text-balance">{game.name}</Heading>
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
  </aside>;
}
