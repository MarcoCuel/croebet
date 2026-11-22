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

export function GameEntryHeader({ game, actions, development=false }: { game: Pick<GameRecord, "name" | "description" | "slug" | "averageDurationSeconds">; actions?: ReactNode; development?:boolean }) {
  const { userId, openLogin } = useSession();
  const definition = getGameDefinition(game.slug);
  const durationMinutes = game.averageDurationSeconds == null ? null : Math.max(1, Math.round(game.averageDurationSeconds / 60));
  return <Card aria-label="Apresentação do jogo">
    <div className="flex flex-col items-start gap-6 p-6 relative">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          {(definition || durationMinutes !== null) && <div className="flex flex-wrap gap-2" aria-label="Informações do jogo">
            {definition && <Badge variant="secondary" className="gap-1.5"><UsersRound className="size-4" aria-hidden="true" />{definition.minPlayers}–{maxGamePlayers(definition, definition.defaults)} jogadores</Badge>}
            {durationMinutes !== null && <Badge variant="secondary" className="gap-1.5"><Clock3 className="size-4" aria-hidden="true" />~{durationMinutes} min por partida</Badge>}
          </div>}
          <div className="flex flex-wrap items-center gap-3"><Heading variant="display">{game.name}</Heading>{development && <Badge>Desenvolvimento</Badge>}</div>
        </div>
        <GameModeSwitch slug={game.slug} development={development}/>
      </div>
      {game.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">{game.description}</p>}

      {(actions || !userId) && <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        {!userId && <Button className="w-full shrink-0 sm:w-auto" onClick={openLogin}>Entrar para jogar</Button>}
        {actions}
      </div>}
    </div>
  </Card>;
}
