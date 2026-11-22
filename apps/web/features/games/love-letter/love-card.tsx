import { Crown, Eye, Feather, Heart, Mail, Search, Shield, Swords, UserRound, type LucideIcon } from "lucide-react";
import type { LoveView } from "@croebet/shared";
import { cn } from "@/lib/utils";
import { CardArtwork } from "@/components/shared/card-artwork";
import { loveArtwork } from "./artwork";

export const loveRoles: Record<string, { icon: LucideIcon; effect: string }> = {
  Espiã: { icon: Eye, effect: "Sobreviva para disputar uma ficha extra." },
  Guarda: { icon: Search, effect: "Adivinhe a carta de outro jogador." },
  Sacerdote: { icon: Eye, effect: "Veja a mão de outro jogador." },
  Barão: { icon: Swords, effect: "Compare mãos. A menor é eliminada." },
  Aia: { icon: Shield, effect: "Proteja-se até seu próximo turno." },
  Príncipe: { icon: UserRound, effect: "Escolha quem descarta e compra outra carta." },
  Chanceler: { icon: Feather, effect: "Compre duas cartas e escolha uma para manter." },
  Rei: { icon: Crown, effect: "Troque sua mão com outro jogador." },
  Condessa: { icon: Crown, effect: "Descarte se tiver o Rei ou o Príncipe." },
  Princesa: { icon: Heart, effect: "Se descartar esta carta, você é eliminado." },
};
export const classic = ["", "Guarda", "Sacerdote", "Barão", "Aia", "Príncipe", "Rei", "Condessa", "Princesa"];
export const modern = ["Espiã", "Guarda", "Sacerdote", "Barão", "Aia", "Príncipe", "Chanceler", "Rei", "Condessa", "Princesa"];
export function LoveCard({ value, mode, small = false, compact = false, className }: { value?: number; mode: LoveView["mode"]; small?: boolean; compact?: boolean; className?: string }) {
  const name = value === undefined ? undefined : (mode === "classic" ? classic : modern)[value];
  const Icon = name ? loveRoles[name].icon : Mail;
  const artwork = value === undefined ? loveArtwork[mode].back : loveArtwork[mode].faces[value];
  if (artwork) return <span className={cn("relative block shrink-0 aspect-[232/346] overflow-hidden rounded-xl", small ? "w-16" : "w-32 sm:w-36", compact && "w-11", className)}><CardArtwork artwork={artwork} label={name ? `${value} · ${name}` : "Verso da carta"} /></span>;
  return (
    <span className={cn("relative flex shrink-0 flex-col items-center justify-between rounded-xl border border-contrast/10 p-3", small ? "h-24 w-16" : "h-44 w-32 sm:h-48 sm:w-36", compact && "h-16 w-11 p-2 [&>span:first-child]:text-sm", name ? "bg-surface text-foreground" : "bg-brand/10 text-brand", className)}>
      {name ? <><span className={cn("self-start font-semibold leading-none text-brand", small ? "text-lg" : "text-3xl")}>{value}</span><Icon aria-hidden className={small ? "size-5 text-brand" : "size-10 text-brand sm:size-12"} /><span className={cn("font-medium", small ? "sr-only" : "text-xs sm:text-sm")}>{name}</span></> : <><span /><Icon aria-hidden className={small ? "size-5" : "size-10"} /><span className="h-3" /></>}
    </span>
  );
}

