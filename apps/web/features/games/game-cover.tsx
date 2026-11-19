import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function GameCover({ imageUrl, name, iconClassName }: { imageUrl: string | null; name: string; iconClassName?: string }) {
  return <div className="relative grid aspect-square place-items-center overflow-hidden rounded-panel bg-contrast/6">
    {imageUrl ? <Image src={imageUrl} unoptimized alt={`Capa de ${name}`} width={600} height={600} className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105" /> : <ImageIcon className={cn("size-8 text-muted", iconClassName)} aria-hidden="true" />}
  </div>;
}
