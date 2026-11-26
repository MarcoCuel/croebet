"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GameRoom } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { GameResult, GameResultActions, type GameResultSummary } from "./game-result";
import { gameUrl } from "./game-url";

export function MatchResult({ room, result, onReplay }: { onReplay?: () => void; room: Exclude<GameRoom, { status: "lobby" }>; result: GameResultSummary }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  if (room.status !== "finished") return null;
  return <Dialog open={!dismissed} onOpenChange={open => setDismissed(!open)}>
      <DialogTrigger asChild><Button variant="secondary">Ver resultado</Button></DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] w-[min(36rem,calc(100%-2rem))]"
        data-lenis-prevent
        footer={<GameResultActions leaving={false} onReplay={onReplay} onPlayAgain={() => router.push(gameUrl(room.game, { development: room.development }), { scroll: false })} />}
      >
        <GameResult result={result} match={room} />
      </DialogContent>
    </Dialog>;
}
