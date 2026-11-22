import Image from "next/image";
import type { CardArtwork as Artwork } from "@/three/table/artwork";

export function CardArtwork({ artwork, label }: { artwork: Artwork; label: string }) {
  return <>{artwork.src ? <Image src={artwork.src} alt={label} fill unoptimized sizes="144px" className="object-fill" /> : <span role="img" aria-label={label} className="flex size-full items-center justify-center">{artwork.text ?? label}</span>}{artwork.valueOverride !== undefined && <span aria-hidden className="absolute top-[4%] left-[6%] flex h-[20%] w-[25%] items-center justify-center rounded-full bg-surface text-[1.5em] font-semibold text-foreground">{artwork.valueOverride}</span>}</>;
}
