"use client";

import { Suspense, type ReactNode } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";

/** Mount inside a dynamically loaded scene, never in the application layout. */
export function SceneCanvas({
  children,
  ...props
}: CanvasProps & { children: ReactNode }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4], fov: 40 }}
      fallback={
        <p className="p-4 text-sm text-muted" role="status">
          A visualização 3D não está disponível neste navegador.
        </p>
      }
      {...props}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
