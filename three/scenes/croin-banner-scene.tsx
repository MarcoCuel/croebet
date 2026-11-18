"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import { CroinModel } from "@/three/models/croin-model";
import { StudioLighting } from "@/three/lighting/studio-lighting";

function SpinningCroin({ animate }: { animate: boolean }) {
  const coin = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (animate) invalidate();
  }, [animate, invalidate]);

  useFrame((_, delta) => {
    if (!animate || !coin.current) return;
    coin.current.rotation.y += Math.min(delta, 0.05) * 0.65;
    invalidate();
  });

  return (
    <group rotation={[0.15, 0, -0.3]}>
      <CroinModel ref={coin} rotation={[0, -0.4, 0]} />
    </group>
  );
}

export default function CroinBannerScene({ animate }: { animate: boolean }) {
  return (
    <SceneCanvas camera={{ position: [0, 0, 3.4], fov: 40 }} fallback={null}>
      <StudioLighting />
      <SpinningCroin animate={animate} />
    </SceneCanvas>
  );
}
