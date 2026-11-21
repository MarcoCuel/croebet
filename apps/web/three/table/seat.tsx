import { Html } from "@react-three/drei";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SeatPlacement } from "./layout";
export function TableSeat({ seat, name, avatar, count, active, local, compact }: {
  seat: SeatPlacement; name: string; avatar?: string; count: number; active: boolean; local: boolean; compact: boolean;
}) {
  return <Html position={[seat.position[0], 1.65, seat.position[2]]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
    <div className="flex items-center gap-2 rounded-xl border border-contrast/6 bg-background/95 px-2 py-1.5 text-xs text-foreground" title={`${name} · ${count} cartas${active ? " · Sua vez" : ""}`}>
      <Avatar className={active ? "size-7 shadow-[0_0_0_2px_var(--color-brand)]" : "size-7"}><AvatarImage src={avatar} /><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar>
      <div className="whitespace-nowrap"><p className={compact ? "sr-only" : "font-medium"}>{local ? "Você" : name}</p><p className="text-muted">{count}{!compact && " cartas"}{active && <span className="ml-1 text-brand">●<span className="sr-only"> · Sua vez</span></span>}</p></div>
    </div>
  </Html>;
}
