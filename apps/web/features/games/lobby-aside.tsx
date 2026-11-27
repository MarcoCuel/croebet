"use client";

import type { ReactNode } from "react";
import { Clock3, UsersRound } from "lucide-react";
import {
  maxGamePlayers,
  type GameDefinition,
  type GameRecord,
  type Lobby,
} from "@croebet/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
import { GameCover } from "./game-cover";
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
  hasLobby,
  playDisabled,
  playLoading = false,
  rules,
  onLogin,
  onPlay,
  onCreate,
}: {
  game: Pick<
    GameRecord,
    | "name"
    | "description"
    | "slug"
    | "moduleId"
    | "imageUrl"
    | "averageDurationSeconds"
  >;
  definition: GameDefinition;
  development: boolean;
  settings: Lobby["options"];
  userId: string | null;
  connected: boolean;
  busy: boolean;
  creationBlocked: boolean;
  hasLobby: boolean;
  playDisabled: boolean;
  playLoading?: boolean;
  rules?: (options: Lobby["options"]) => ReactNode;
  onLogin: () => void;
  onPlay: () => void;
  onCreate: () => void;
}) {
  const durationMinutes =
    game.averageDurationSeconds == null
      ? null
      : Math.max(1, Math.round(game.averageDurationSeconds / 60));

  return (
    <aside
      aria-label="Apresentação do jogo"
      className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-(--header-height) xl:min-h-[var(--column-height)]"
    >
      <Card className="relative isolate aspect-square shrink-0 overflow-hidden p-0">
        <GameCover imageUrl={game.imageUrl} name={game.name} />

        {game.imageUrl && (
          <span
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
            aria-hidden="true"
          />
        )}

        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between gap-10 p-4",
            game.imageUrl && "text-white"
          )}
        >
          <div className="flex min-h-6 items-start justify-between gap-3">
            <div>
              {development && <Badge>Desenvolvimento</Badge>}
            </div>

            <GameModeSwitch
              moduleId={game.moduleId}
              slug={game.slug}
              development={development}
            />
          </div>

          <Heading
            className={cn(
              "relative max-w-full text-4xl leading-tight tracking-tight text-balance",
              game.imageUrl && "text-white text-shadow-cover"
            )}
          >
            {game.name}
          </Heading>
        </div>
      </Card>

      {!userId ? (
        <Button className="w-full" onClick={onLogin}>
          Entrar para jogar
        </Button>
      ) : !hasLobby ? (
        <Button
          className="w-full bg-brand text-white"
          loading={busy}
          disabled={creationBlocked || busy || !connected}
          onClick={onCreate}
        >
          Criar sala
        </Button>
      ) : (
        <Button
          className={cn(
            "w-full",
            !playDisabled && "bg-tertiary text-white"
          )}
          variant={playDisabled ? "secondary" : "default"}
          loading={playLoading}
          disabled={playDisabled || busy || !connected}
          onClick={onPlay}
        >
          {playDisabled && !playLoading
            ? "Esperando jogadores"
            : "Jogar"}
        </Button>
      )}

      <Card
        className="flex flex-1 flex-col gap-4"
        aria-label="Sobre o jogo"
      >
        <div
          className="flex flex-wrap gap-2"
          aria-label="Informações do jogo"
        >
          <Badge variant="secondary" className="gap-2">
            <UsersRound className="size-4" aria-hidden="true" />
            {definition.minPlayers} /{" "}
            {maxGamePlayers(definition, definition.defaults)}
          </Badge>

          {durationMinutes !== null && (
            <Badge variant="secondary" className="gap-2">
              <Clock3 className="size-4" aria-hidden="true" />
              {durationMinutes} min.
            </Badge>
          )}
        </div>

        {game.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted my-auto">
            {game.description}
          </p>
        )}

        {rules?.(settings)}
      </Card>
    </aside>
  );
}