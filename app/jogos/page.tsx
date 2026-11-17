import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import type { Metadata } from "next";
import { GameGrid } from "@/features/games/game-grid";

export const metadata: Metadata = { title: "Jogos | Croebet" };

export default function Games() {
  return (
    <PageShell>
      <header className="mb-6" data-enter>
        <Heading asChild variant="display">
          <h1>Jogos</h1>
        </Heading>
      </header>
      <GameGrid />
    </PageShell>
  );
}
