"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const Flip7Game = dynamic(() => import("./flip7-game"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-96 w-full" aria-label="Carregando Flip7" />,
});

export function Flip7Loader() { return <Flip7Game />; }
