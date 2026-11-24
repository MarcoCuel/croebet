"use client";
import type { ComponentProps } from "react";
import { gameIdSchema, type GameRecord, type GameRoom } from "@croebet/shared";
import { useRouter } from "next/navigation";
import { LobbyScreen } from "./lobby";
import { TestGame } from "./test-game";
import { TestReplay } from "./test-replay";
import { gameUrl } from "./game-url";
import type { GamePresentation } from "./game-module";
import type { InitialMatches } from "./server-matches";

function Archive({
  archive,
  game,
}: {
  archive: NonNullable<InitialMatches["replay"]>;
  game: GameRecord;
}) {
  const router = useRouter(),
    m = archive.match,
    state = archive.finalState ?? archive.frames[0]?.state;
  if (!state) return <p>Nenhuma jogada registrada.</p>;
  // Archived seats may have a deleted account. The table only needs the surviving identities for display.
  const participants = m.players.flatMap((p) =>
    p.userId
      ? [
          {
            userId: p.userId,
            seat: p.seat,
            username: p.name,
            displayName: p.name,
            avatarUrl: p.avatarUrl,
          },
        ]
      : [],
  );
  const room: Exclude<GameRoom, { status: "lobby" }> = {
    ...m,
    game: gameIdSchema.parse(m.game ?? game.moduleId),
    version: m.frameCount + 1,
    status: m.status === "abandoned" ? "abandoned" : "finished",
    state,
    capacity: m.players.length,
    hostId: "",
    participants,
    bots: m.players.filter((p) => p.bot).length,
    onlyBots: m.players.every((p) => p.bot),
  };
  return (
    <TestReplay
      game={game}
      room={room}
      onClose={() => router.push(gameUrl(game.slug))}
    />
  );
}
export function PublicEntry({
  game,
  initial,
}: ComponentProps<NonNullable<GamePresentation["Entry"]>>) {
  const m = initial.replay?.match;
  const record =
    game ??
    (m
      ? {
          id: m.gameId,
          slug: m.game ?? "",
          moduleId: m.game,
          name: m.game ?? "Partida",
          description: "",
          enabled: false,
          imageUrl: null,
          version: 1,
          seo: {
            title: "",
            description: "",
            image: "",
            imageAlt: "",
            index: false,
          },
          averageDurationSeconds: null,
        }
      : null);
  if (!record) return <p>Jogo indisponível.</p>;
  if (initial.replay) return <Archive game={record} archive={initial.replay} />;
  if (initial.match)
    return (
      <TestGame
        key={initial.match.code}
        game={record}
        initialRoom={initial.match}
      />
    );
  return <LobbyScreen game={record} initial={initial} />;
}
