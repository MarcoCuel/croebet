"use client";

import type { ReactNode } from "react";
import { getGameDefinition, maxGamePlayers, type GameRecord } from "@croebet/shared";
import { Clock3, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GameModeSwitch } from "./mode-switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { useSession } from "@/features/auth/session-context";
import { GameHeroCards } from "./game-hero-cards";

export function GameEntryHeader({ game, actions, development=false }: { game: Pick<GameRecord, "name" | "description" | "slug" | "moduleId" | "averageDurationSeconds">; actions?: ReactNode; development?:boolean }) {
  const { userId, openLogin } = useSession();
  const definition = getGameDefinition(game.moduleId ?? game.slug);
  const durationMinutes = game.averageDurationSeconds == null ? null : Math.max(1, Math.round(game.averageDurationSeconds / 60));
  return <Card aria-label="Apresentação do jogo" className="relative isolate overflow-hidden">
    {definition && <GameHeroCards gameId={game.moduleId ?? game.slug} />}
    <div className="flex flex-col items-start gap-4 p-6 relative">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          {(definition || durationMinutes !== null) && <div className="flex flex-wrap gap-2" aria-label="Informações do jogo">
            {definition && <Badge variant="secondary" className="gap-3"><UsersRound className="size-4" aria-hidden="true" />{definition.minPlayers} / {maxGamePlayers(definition, definition.defaults)}</Badge>}
            {durationMinutes !== null && <Badge variant="secondary" className="gap-3"><Clock3 className="size-4" aria-hidden="true" />{durationMinutes} min.</Badge>}
          </div>}
          <div className="flex flex-wrap items-center gap-3"><Heading variant="display">{game.name}</Heading>{development && <Badge>Desenvolvimento</Badge>}</div>
        </div>
        <GameModeSwitch moduleId={game.moduleId} slug={game.slug} development={development}/>
      </div>
      {game.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base sm:max-w-[60%]">{game.description}</p>}

      {(actions || !userId) && <div className="flex w-full shrink-0 flex-col gap-4 sm:w-auto sm:flex-row sm:items-center">
        {!userId && <Button className="w-full shrink-0 sm:w-auto" onClick={openLogin}>Entrar para jogar</Button>}
        {actions}
      </div>}
    </div>
  </Card>;
}
