"use client";

import { useThree } from "@react-three/fiber";
import { fitCamera, surfacePlacement, type Vec3 } from "./layout";
import type { TablePalette } from "./resources";

export function TableSurface({ radius, depth, angle, bounds, palette }: {
  radius: number; depth: number; angle: number; bounds: Vec3[]; palette: TablePalette;
}) {
  const size = useThree(state => state.size);
  const aspect = size.width / Math.max(1, size.height);
  const surface = surfacePlacement(fitCamera(bounds, aspect, angle), aspect, radius, depth);
  return <mesh position={[0, -0.16, surface.centerZ]} scale={[surface.radius, 1, surface.depth]} receiveShadow>
    <cylinderGeometry args={[1, 1.015, 0.3, 80]} /><meshStandardMaterial color={palette.surface} roughness={0.98} metalness={0} />
  </mesh>;
}
