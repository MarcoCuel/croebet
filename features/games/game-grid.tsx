import Image from "next/image";
import Link from "next/link";
import { Heading } from "@/components/shared/heading";
import { games } from "./catalog";

export function GameGrid() {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {games.map(({ slug, coverTitle, cover }) => (
        <li key={slug}>
          <Link
            className={`group relative isolate block aspect-square overflow-hidden rounded-panel bg-(--cover) text-white @container ${cover}`}
            href={`/jogos/${slug}`}
          >
            <Image
              className="absolute inset-0 -z-20 size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
              src={`/art/${slug}.webp`}
              alt=""
              width={600}
              height={600}
              sizes="(min-width: 64rem) 22vw, (min-width: 48rem) 24vw, 48vw"
            />
            <span
              className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-black/20 via-transparent to-transparent"
              aria-hidden="true"
            />
            <Heading
              variant="cover"
              asChild
              className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 xl:p-6"
            >
              <span>
                {coverTitle[0]}
                <br />
                {coverTitle[1]}
              </span>
            </Heading>
          </Link>
        </li>
      ))}
    </ul>
  );
}
