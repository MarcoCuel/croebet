import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
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
      <Link
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        href="/jogos"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Todos os jogos
      </Link>
      <header className="mb-6" data-enter>
        <p className="mb-1 text-sm font-semibold text-accent">{game.type}</p>
        <Heading asChild variant="display">
          <h1>{game.name}</h1>
        </Heading>
      </header>
      <div
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.4fr)]"
        data-enter
      >
        <section
          className={`relative isolate grid min-h-64 place-items-end overflow-hidden rounded-panel bg-(--cover) p-5 sm:aspect-video sm:p-7 ${game.cover}`}
          aria-labelledby="game-state"
        >
          <Image
            className="absolute inset-0 -z-20 size-full object-cover object-center"
            src={`/art/${game.slug}.webp`}
            alt=""
            fill
            preload
            sizes="(min-width: 64rem) 60vw, 100vw"
          />
          <div
            className="absolute inset-0 -z-10 bg-linear-to-t from-image-shade via-image-shade/15 to-transparent"
            aria-hidden="true"
          />
          <p className="w-full font-semibold text-white" id="game-state">
            Versão jogável em adaptação
          </p>
        </section>
        <Card asChild>
          <aside aria-labelledby="game-about">
            <Heading id="game-about">Sobre o jogo</Heading>
            <p className="mt-3 leading-relaxed text-muted">
              {game.description}
            </p>
            <p className="mt-4 border-t-(length:--border-width-hairline) border-border pt-4 text-sm text-muted">
              Os jogos da Croebet usam Croins, a moeda fictícia da casa.
            </p>
          </aside>
        </Card>
      </div>
    </PageShell>
  );
}
