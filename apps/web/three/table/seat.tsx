import { Html } from "@react-three/drei";
import { seatLabelPosition, type SeatPlacement } from "./layout";
import { TableSeatBadge, type TableSeatSummary } from "./seat-badge";
export function TableSeat({ seat, name, avatar, active, local, compact, scale, onActivate, summary, label, disabled, selected }: {
  seat: SeatPlacement; name: string; avatar?: string; scale: number; active: boolean; local: boolean; compact: boolean; onActivate: () => void; summary?: TableSeatSummary; label?: string; disabled?: boolean; selected?: boolean;
}) {
  return <Html position={seatLabelPosition(seat, scale, local)} center zIndexRange={[10, 0]} style={{ pointerEvents: "auto" }}>
    <TableSeatBadge name={name} avatar={avatar} active={active} local={local} compact={compact} onActivate={onActivate} summary={summary} label={label} disabled={disabled} selected={selected} />
  </Html>;
}
