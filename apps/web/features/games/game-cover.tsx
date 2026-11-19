import Image from "next/image";
import { ImageIcon } from "lucide-react";

export function GameCover({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return <div className="relative grid aspect-square place-items-center overflow-hidden rounded-panel bg-contrast/6">
    {imageUrl ? <Image src={imageUrl} unoptimized alt={`Capa de ${name}`} width={600} height={600} className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105" /> : <ImageIcon className="size-8 text-muted" aria-hidden="true" />}
  </div>;
}
