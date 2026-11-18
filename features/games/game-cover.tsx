import Image from "next/image";

export function GameCover({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-panel bg-control">
      <Image
        src={`/art/${slug}.webp`}
        alt={`Capa de ${name}`}
        width={600}
        height={600}
        sizes="(min-width: 64rem) 22vw, (min-width: 40rem) 30vw, 48vw"
        className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
      />
    </div>
  );
}
