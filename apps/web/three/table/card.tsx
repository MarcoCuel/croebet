"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, type Group, type Texture } from "three";
import type { CardPlacement } from "./layout";

export function TableCard({ placement, face, back, hidden = false, selected = false, reducedMotion = false, onSelect, origin }: {
  placement: CardPlacement; face: Texture; back: Texture; hidden?: boolean;
  selected?: boolean; reducedMotion?: boolean; onSelect?: () => void;
  origin?: [number, number, number];
}) {
  const ref = useRef<Group>(null);
  const invalidate = useThree(state => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const raised = selected || hovered;
  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const targetY = placement.y + (raised ? 0.32 : 0);
    const amount = reducedMotion ? 1 : 1 - Math.exp(-14 * Math.min(delta, 0.1));
    group.position.x = MathUtils.lerp(group.position.x, placement.x, amount);
    group.position.y = MathUtils.lerp(group.position.y, targetY, amount);
    group.position.z = MathUtils.lerp(group.position.z, placement.z, amount);
    group.rotation.y = MathUtils.lerp(group.rotation.y, placement.rotation, amount);
    if (Math.abs(group.position.x - placement.x) + Math.abs(group.position.y - targetY) + Math.abs(group.position.z - placement.z) + Math.abs(group.rotation.y - placement.rotation) > 0.001) invalidate();
  });
  return <group ref={ref} position={origin ?? [placement.x, placement.y, placement.z]} rotation={[0, placement.rotation, 0]}
    onClick={onSelect ? event => { event.stopPropagation(); onSelect(); } : undefined}
    onPointerOver={onSelect ? event => { event.stopPropagation(); setHovered(true); } : undefined}
    onPointerOut={() => setHovered(false)}>
    <mesh castShadow receiveShadow><boxGeometry args={[0.72, 0.025, 1.05]} /><meshStandardMaterial color="white" roughness={0.7} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} receiveShadow>
      <planeGeometry args={[0.71, 1.04]} /><meshStandardMaterial map={hidden ? back : face} roughness={0.65} />
    </mesh>
  </group>;
}
