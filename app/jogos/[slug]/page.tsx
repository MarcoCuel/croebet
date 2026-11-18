import { ManagedGame } from "@/features/games/managed-game";
import { Flip7Loader } from "@/features/games/flip7/flip7-loader";
import { PageShell } from "@/components/layout/page-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { games } from "@/features/games/catalog";
import { Gamepad2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/shared/heading";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return games.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find((entry) => entry.slug === slug);
  if (!game) notFound();
  return { title: `${game.name} · Croebet`, description: game.description };
}

export default async function Game({ params }: Props) {
  const { slug } = await params;
  const game = games.find((entry) => entry.slug === slug);
  if (!game) notFound();

  return (
    <PageShell>
      <ManagedGame slug={slug}>
        {slug === "flip7" ? (
          <Flip7Loader />
        ) : (
          <Card asChild className="flex min-h-80 flex-col items-center justify-center border border-dashed border-border py-16 text-center">
            <section aria-labelledby="game-state">
              <div className="mb-5 grid size-16 place-items-center rounded-full bg-brand/10 text-brand">
                <Gamepad2 className="size-8" aria-hidden="true" />
              </div>
              <Heading id="game-state">Em breve</Heading>
              <p className="mt-2 max-w-xs text-sm text-muted">
                A casa está preparando a próxima rodada.
              </p>
            </section>
          </Card>
        )}
      </ManagedGame>
    </PageShell>
  );
}
