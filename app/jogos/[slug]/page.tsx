import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { games } from "../catalogo";

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
    <main className="shell inner">
      <Link className="mb-4 inline-flex items-center gap-2 text-muted hover:text-accent" href="/jogos">
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Todos os jogos
      </Link>
      <article className="grid grid-cols-2 items-center gap-[clamp(1.25rem,5vw,4.75rem)] rounded-panel bg-surface p-[clamp(1rem,3vw,2.5rem)] max-[45rem]:grid-cols-1" data-enter>
        <div className={`game-cover max-[45rem]:aspect-4/3 ${game.cover}`} aria-hidden="true">
          <game.Icon weight="fill" />
        </div>
        <div className="text-muted">
          <p className="text-accent">{game.type}</p>
          <h1 className="display-heading mt-2 mb-4 text-[clamp(2rem,5vw,4rem)] text-foreground">{game.name}</h1>
          <p>{game.description}</p>
          <p className="mt-6 text-sm">Versão jogável em adaptação</p>
        </div>
      </article>
    </main>
  );
}
