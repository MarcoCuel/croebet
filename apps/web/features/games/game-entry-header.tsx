"use client";

import type { ReactNode } from "react";
import type { GameRecord } from "@croebet/shared";
import { Badge } from "@/components/ui/badge";
import { GameModeSwitch } from "./mode-switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { useSession } from "@/features/auth/session-context";

export function GameEntryHeader({ game, actions, development=false }: { game: Pick<GameRecord, "name" | "description" | "slug">; actions?: ReactNode; development?:boolean }) {
  const { userId, openLogin } = useSession();
  return <Card aria-label="Apresentação do jogo">
    <div className="flex flex-col items-start gap-6 p-6 relative">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3"><Heading variant="display">{game.name}</Heading>{development && <Badge>Desenvolvimento</Badge>}</div>
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
