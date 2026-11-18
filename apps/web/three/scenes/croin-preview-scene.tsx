"use client";

import { SceneCanvas } from "@/three/canvas/scene-canvas";
import { CroinModel } from "@/three/models/croin-model";
import { StudioLighting } from "@/three/lighting/studio-lighting";
import { PreviewControls } from "@/three/controls/preview-controls";

export default function CroinPreviewScene() {
  return (
    <SceneCanvas>
      <StudioLighting />
      <CroinModel rotation={[0.15, -0.3, 0]} />
      <PreviewControls />
    </SceneCanvas>
  );
}
