import { ManagedGame } from "@/features/games/managed-game";
import { Flip7Loader } from "@/features/games/flip7/flip7-loader";
import { PageShell } from "@/components/layout/page-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { games } from "@/features/games/catalog";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return games.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find((entry) => entry.slug === slug);
  if (!game) notFound();
  return { title: `${game.name} | Croebet`, description: game.description };
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
          <section
            className={`relative isolate grid min-h-64 place-items-center border overflow-hidden rounded-panel bg-(--cover) p-5`}
            aria-labelledby="game-state"
          >
            <h3>Em breve</h3>
          </section>
        )}
      </ManagedGame>
    </PageShell>
  );
}
