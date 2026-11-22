import { useMemo } from "react";
import { Color, type MeshStandardMaterial } from "three";
import type { AdaptiveTableLayout } from "./adaptive-layout";
import type { TablePalette } from "./resources";

export function TableFloor({ fit, angle, palette }: { fit: AdaptiveTableLayout["fit"]; angle: number; palette: TablePalette }) {
  const pitch = angle * Math.PI / 180;
  const height = -0.08;
  // Intersect the camera's center ray with the floor; keep the pool of light
  // centered and proportional to the viewport, including ultrawide screens.
  const centerZ = fit.target[2] + (height - fit.target[1]) / Math.tan(pitch);
  const radiusX = (fit.right - fit.left) * 0.55;
  const radiusZ = (fit.top - fit.bottom) * 0.55 / Math.sin(pitch);
  const color = useMemo(() => new Color(palette.background).lerp(new Color(palette.foreground), 0.12), [palette.background, palette.foreground]);
  const shade: MeshStandardMaterial["onBeforeCompile"] = useMemo(() => shader => {
    shader.uniforms.floorRadius = { value: [radiusX, radiusZ] };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vFloorPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFloorPosition = position.xy;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vFloorPosition;\nuniform vec2 floorRadius;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 floorOffset = vFloorPosition / floorRadius;
        float fade = 1.0 - smoothstep(0.05, 0.9, length(floorOffset));
        diffuseColor.a *= 0.18 * fade * fade;`);
  }, [radiusX, radiusZ]);

  return <mesh name="table-floor" position={[fit.target[0], height, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => {}}>
    {/* The plane extends beyond every camera ray; its edges never frame the game. */}
    <planeGeometry args={[2000, 2000]} />
    <meshStandardMaterial key={`${radiusX}:${radiusZ}`} color={color} transparent depthWrite={false} roughness={1} metalness={0} onBeforeCompile={shade} />
  </mesh>;
}
