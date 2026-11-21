"use client";
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { fitCamera, type Vec3 } from "./layout";
export function TableCamera({ angle, bounds }: { angle: number; bounds: Vec3[] }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const fit = fitCamera(bounds, size.width / Math.max(1, size.height), angle);
    camera.position.fromArray(fit.position); camera.lookAt(...fit.target); camera.updateProjectionMatrix(); invalidate();
  }, [angle, bounds, camera, size.width, size.height, invalidate]);
  return null;
}
