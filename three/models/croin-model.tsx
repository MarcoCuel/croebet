"use client";

import { memo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import { BrandMaterial } from "@/three/materials/brand-material";

/** Procedural placeholder; replace with a GLTF when the product needs a real asset. */
export const CroinModel = memo(function CroinModel(
  props: ThreeElements["group"],
) {
  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.16, 48]} />
        <BrandMaterial />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <torusGeometry args={[0.72, 0.035, 8, 48]} />
        <BrandMaterial roughness={0.2} />
      </mesh>
    </group>
  );
});
