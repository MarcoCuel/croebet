"use client";

import { OrbitControls } from "@react-three/drei";

export function PreviewControls() {
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping={false}
    />
  );
}
