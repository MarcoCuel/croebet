import { Html } from "@react-three/drei";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { seatLabelPosition, type SeatPlacement } from "./layout";
export function TableSeat({ seat, name, avatar, count, active, local, compact, scale, onActivate }: {
  seat: SeatPlacement; name: string; avatar?: string; count: number; scale: number; active: boolean; local: boolean; compact: boolean; onActivate: () => void;
}) {
  return <Html position={seatLabelPosition(seat, scale, local)} center zIndexRange={[10, 0]} style={{ pointerEvents: "auto" }}>
    <button onClick={onActivate} aria-label={`Passar vez para ${local ? "você" : name}`} className="flex cursor-pointer items-center gap-2 rounded-xl border border-contrast/6 bg-background/95 px-2 py-1.5 text-left text-xs text-foreground" title={`${name} · ${count} cartas${active ? local ? " · Sua vez" : " · Vez deste jogador" : ""}`}>
      <Avatar className={active ? "size-7 shadow-[0_0_0_2px_var(--color-brand)]" : "size-7"}><AvatarImage src={avatar} /><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar>
      <div className="whitespace-nowrap"><p className={compact ? "sr-only" : "font-medium"}>{local ? "Você" : name}</p><p className="text-muted">{count}{!compact && " cartas"}{active && <span className="ml-1 animate-pulse text-brand motion-reduce:animate-none">●<span className="sr-only"> · {local ? "Sua vez" : "Vez deste jogador"}</span></span>}</p></div>
    </button>
  </Html>;
}
