"use client";

import type { GameRecord } from "@croebet/shared";
import dynamic from "next/dynamic";
import type { InitialMatches } from "./server-matches";
import { Skeleton } from "@/components/ui/skeleton";

const Flip7Game = dynamic(() => import("./flip7-game"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-96 w-full" aria-label="Carregando Flip7" />,
});

export function Flip7Loader({ initial, game }: { initial: InitialMatches; game: GameRecord | null }) { return <Flip7Game game={game} initial={initial} />; }
