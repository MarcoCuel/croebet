import { PageShell } from "@/components/layout/page-shell";
import type { Metadata } from "next";
import { GameGrid } from "@/features/games/game-grid";

export const metadata: Metadata = { title: "Jogos | Croebet" };

export default function Games() {
  return (
    <PageShell>
      <h1 className="sr-only">Jogos</h1>
      <GameGrid />
    </PageShell>
  );
}
