import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function TableSeatBadge({ name, avatar, count, active, local, compact, onActivate }: {
  name: string; avatar?: string; count: number; active: boolean; local: boolean; compact: boolean; onActivate: () => void;
}) {
  return <Button variant="ghost" onClick={onActivate} aria-label={`Passar vez para ${local ? "você" : name}`} className="h-auto min-h-0 justify-start gap-2 rounded-xl border border-contrast/6 bg-background/95 px-2 py-1.5 text-left text-xs font-normal text-foreground" title={`${name} · ${count} cartas${active ? local ? " · Sua vez" : " · Vez deste jogador" : ""}`}>
    <Avatar className={active ? "size-7 shadow-[0_0_0_2px_var(--color-brand)]" : "size-7"}><AvatarImage src={avatar} /><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar>
    <span className="whitespace-nowrap"><span className={compact ? "sr-only" : "block font-medium"}>{local ? "Você" : name}</span><span className="block text-muted">{count}{!compact && " cartas"}{active && <span className="ml-1 animate-pulse text-brand motion-reduce:animate-none">●<span className="sr-only"> · {local ? "Sua vez" : "Vez deste jogador"}</span></span>}</span></span>
  </Button>;
}
