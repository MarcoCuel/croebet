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
      <h1 className="sr-only">{game.name}</h1>
      {slug === "flip7" ? (
        <Flip7Loader />
      ) : (
        <section
          className={`relative isolate grid min-h-64 place-items-end overflow-hidden rounded-panel bg-(--cover) p-5 sm:aspect-video sm:p-7 ${game.cover}`}
          aria-labelledby="game-state"
        >
          <div
            className="absolute inset-0 -z-10 bg-linear-to-t from-image-shade via-image-shade/15 to-transparent"
            aria-hidden="true"
          />
        </section>
      )}
    </PageShell>
  );
}
