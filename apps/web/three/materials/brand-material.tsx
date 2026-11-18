"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree, type ThreeElements } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";

/** Read the brand token once per mount; never update React state on a frame. */
export function BrandMaterial(
  props: Omit<ThreeElements["meshStandardMaterial"], "color" | "ref">,
) {
  const material = useRef<MeshStandardMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const brand = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-brand")
      .trim();
    if (brand && material.current) {
      material.current.color.set(brand);
      invalidate();
    }
  }, [invalidate]);
  return (
    <meshStandardMaterial
      ref={material}
      roughness={0.3}
      metalness={0.55}
      {...props}
    />
  );
}
