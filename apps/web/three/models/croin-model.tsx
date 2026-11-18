"use client";

import { memo, useMemo } from "react";
import { Vector2 } from "three";
import type { ThreeElements } from "@react-three/fiber";
import { BrandMaterial } from "@/three/materials/brand-material";
import { createCroinEmblem } from "@/three/models/croin-emblem";

/** Procedural Croin, shared by previews and decorative scenes. */
export const CroinModel = memo(function CroinModel(
  props: ThreeElements["group"],
) {
  const profile = useMemo(
    () => [
      new Vector2(0, -0.105),
      new Vector2(0.64, -0.105),
      new Vector2(0.67, -0.11),
      new Vector2(0.69, -0.15),
      new Vector2(0.72, -0.17),
      new Vector2(0.85, -0.17),
      new Vector2(0.89, -0.155),
      new Vector2(0.91, -0.12),
      new Vector2(0.91, 0.12),
      new Vector2(0.89, 0.155),
      new Vector2(0.85, 0.17),
      new Vector2(0.72, 0.17),
      new Vector2(0.69, 0.15),
      new Vector2(0.67, 0.11),
      new Vector2(0.64, 0.105),
      new Vector2(0, 0.105),
    ],
    [],
  );
  const emblem = useMemo(createCroinEmblem, []);

  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <latheGeometry args={[profile, 64]} />
        <BrandMaterial roughness={0.4} metalness={0.3} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} rotation={[0, side === -1 ? Math.PI : 0, 0]}>
          <mesh position={[0, 0, 0.105]}>
            <extrudeGeometry args={[emblem, { depth: 0.012, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 2, steps: 1, curveSegments: 32 }]} />
            <meshStandardMaterial roughness={0.4} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
});
