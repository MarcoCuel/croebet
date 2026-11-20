"use client";

import type { ReactNode } from "react";
import type { GameRecord } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { useSession } from "@/features/auth/session-context";

export function GameEntryHeader({ game, actions }: { game: Pick<GameRecord, "name" | "description">; actions?: ReactNode }) {
  const { userId, openLogin } = useSession();
  return <Card aria-label="Apresentação do jogo">
    <div className="flex flex-col items-start gap-6 p-6 sm:flex-row">
      <div className="space-y-4">
        <Heading variant="display">{game.name}</Heading>
        {game.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">{game.description}</p>}
      </div>
      {(actions || !userId) && <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        {actions}
        {!userId && <Button className="w-full shrink-0 sm:w-auto" onClick={openLogin}>Entrar para jogar</Button>}
      </div>}
    </div>
  </Card>;
}
