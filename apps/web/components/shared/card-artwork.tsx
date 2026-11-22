import Image from "next/image";
import type { CardArtwork as Artwork } from "@/three/table/artwork";

export function CardArtwork({ artwork, label }: { artwork: Artwork; label: string }) {
  return <><Image src={artwork.src} alt={label} fill unoptimized sizes="144px" className="object-fill" />{artwork.valueOverride !== undefined && <span aria-hidden className="absolute top-[4%] left-[6%] flex h-[20%] w-[25%] items-center justify-center rounded-full bg-surface text-[1.5em] font-semibold text-foreground">{artwork.valueOverride}</span>}</>;
}
