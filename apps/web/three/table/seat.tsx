import { Html } from "@react-three/drei";
import { seatLabelPosition, type SeatPlacement } from "./layout";
import { TableSeatBadge } from "./seat-badge";
export function TableSeat({ seat, name, avatar, count, active, local, compact, scale, onActivate }: {
  seat: SeatPlacement; name: string; avatar?: string; count: number; scale: number; active: boolean; local: boolean; compact: boolean; onActivate: () => void;
}) {
  return <Html position={seatLabelPosition(seat, scale, local)} center zIndexRange={[10, 0]} style={{ pointerEvents: "auto" }}>
    <TableSeatBadge name={name} avatar={avatar} count={count} active={active} local={local} compact={compact} onActivate={onActivate} />
  </Html>;
}
