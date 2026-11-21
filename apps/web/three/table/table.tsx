import type { TablePalette } from "./resources";
export function TableSurface({ radius, depth, palette }: { radius: number; depth: number; palette: TablePalette }) {
  return <mesh position={[0, -0.16, 0]} scale={[radius, 1, depth]} receiveShadow>
    <cylinderGeometry args={[1, 1.015, 0.3, 80]} /><meshStandardMaterial color={palette.surface} roughness={0.98} metalness={0} />
  </mesh>;
}
