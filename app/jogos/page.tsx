import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import type { Metadata } from "next";
import { upcoming } from "@/features/games/catalog";
import { GameGrid } from "@/features/games/game-grid";

export const metadata: Metadata = { title: "Jogos | Croebet" };

export default function Games() {
  return (
    <PageShell>
      <header className="mb-6" data-enter>
        <Heading asChild variant="display">
          <h1>Jogos</h1>
        </Heading>
        <p className="mt-2 text-muted">Escolha sua próxima superstição.</p>
      </header>
      <GameGrid />
      <section className="mt-9" aria-labelledby="upcoming-title">
        <Heading id="upcoming-title">Em breve</Heading>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((name) => (
            <li
              className="rounded-lg bg-surface p-3.5 text-sm text-muted"
              key={name}
            >
              {name}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
