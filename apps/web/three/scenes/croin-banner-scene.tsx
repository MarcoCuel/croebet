"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import { CroinModel } from "@/three/models/croin-model";
import { StudioLighting } from "@/three/lighting/studio-lighting";

/** Static pose keeps the emblem visible, and reduced motion stops at it. */
const REST = { x: 0.12, y: -0.35, z: 0 };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function FloatingCroin() {
  const coin = useRef<Group>(null);
  const onScreen = useRef(true);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry?.isIntersecting ?? false;
        // Demand rendering has no frames while the banner is away.
        if (entry?.isIntersecting) invalidate();
      },
      { threshold: 0.01 },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvas, invalidate]);
  useEffect(() => {
    if (!reduced || !coin.current) return;
    coin.current.rotation.set(REST.x, REST.y, REST.z);
    coin.current.position.y = 0;
    invalidate();
  }, [reduced, invalidate]);
  useFrame((state) => {
    if (!coin.current || reduced || !onScreen.current) return;
    const time = state.clock.elapsedTime;
    coin.current.rotation.set(
      REST.x + Math.sin(time * 0.35) * 0.06,
      REST.y + Math.sin(time * 0.45) * 0.45,
      Math.sin(time * 0.3) * 0.04,
    );
    coin.current.position.y = Math.sin(time * 0.7) * 0.045;
    // Demand rendering: each frame schedules the next gentle frame.
    invalidate();
  });
  return (
    <group ref={coin} rotation={[REST.x, REST.y, REST.z]}>
      <CroinModel />
    </group>
  );
}

export default function CroinBannerScene() {
  return (
    <SceneCanvas camera={{ position: [0, 0, 3.7], fov: 38 }} fallback={null}>
      <StudioLighting />
      <FloatingCroin />
    </SceneCanvas>
  );
}
