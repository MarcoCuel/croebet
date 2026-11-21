"use client";

import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { SceneCanvas } from "@/three/canvas/scene-canvas";
import { StudioLighting } from "@/three/lighting/studio-lighting";
import type { LaboratorySettings, LabCard } from "@/features/games/laboratory/model";
import { TableHand, TablePile } from "./hand";

export type LaboratorySceneProps = {
  settings: LaboratorySettings; hands: LabCard[][]; selected: string | null;
  offset: number; deck: number; discard: LabCard[]; reducedMotion: boolean;
  onSelect: (id: string) => void;
};
type Palette = { brand: string; surface: string; background: string; foreground: string };
function usePalette() {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const update = () => {
      const read = (name: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(--color-${name})`;
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      setPalette({ brand: read("brand"), surface: read("surface"), background: read("background"), foreground: read("foreground") });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  return palette;
}
function makeTexture(value: number | null, palette: Palette) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = value === null ? palette.brand : palette.surface;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = value === null ? palette.surface : palette.brand;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 356);
  ctx.fillStyle = value === null ? palette.surface : palette.foreground;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 148px sans-serif";
  ctx.fillText(value === null ? "✦" : String(value), 128, 198);
  if (value !== null) { ctx.font = "bold 36px sans-serif"; ctx.fillText(String(value), 42, 48); ctx.fillText(String(value), 214, 336); }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
function Camera({ angle }: { angle: number }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const radians = angle * Math.PI / 180;
    const distance = size.width / size.height < 1 ? 19 : 13;
    camera.position.set(0, Math.sin(radians) * distance, Math.cos(radians) * distance);
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); invalidate();
  }, [angle, camera, size.width, size.height, invalidate]);
  return null;
}
function Contents({ palette, settings, hands, selected, offset, deck, discard, reducedMotion, onSelect }: LaboratorySceneProps & { palette: Palette }) {
  const textures = useMemo(() => [...Array.from({ length: 10 }, (_, value) => makeTexture(value, palette)), makeTexture(null, palette)], [palette]);
  useEffect(() => () => textures.forEach(texture => texture.dispose()), [textures]);
  const back = textures[10];
  return <>
    <Camera angle={settings.angle} />
    <StudioLighting />
    <directionalLight castShadow={settings.shadows} position={[-3, 7, 3]} intensity={settings.light}
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={0.03} />
    <mesh position={[0, -0.18, 0]} receiveShadow><cylinderGeometry args={[6.2, 6.3, 0.3, 80]} /><meshStandardMaterial color={palette.background} roughness={0.95} /></mesh>
    {Array.from({ length: settings.players }, (_, place) => {
      const seat = (settings.viewer + place) % settings.players;
      const angle = place / settings.players * Math.PI * 2;
      const x = Math.sin(angle) * 4.3; const z = Math.cos(angle) * 3.45;
      const cards = hands[seat].slice(place === 0 ? offset : 0, (place === 0 ? offset : 0) + 20);
      // Convert the deck's world position into this hand's local coordinates.
      const dx = -0.65 - x; const dz = -z;
      const drawOrigin: [number, number, number] = [Math.cos(angle) * dx - Math.sin(angle) * dz, 0.3, Math.sin(angle) * dx + Math.cos(angle) * dz];
      return <group key={seat} position={[x, 0.08, z]} rotation={[0, angle, 0]}>
        <Html position={[0, 0.05, 1.05]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}><span className="rounded-lg bg-background/90 px-2 py-1 text-xs text-foreground">{place === 0 ? "Você" : `Jogador ${seat + 1}`} · {hands[seat].length}</span></Html>
        <TableHand cards={cards} textures={textures} back={back} hidden={place !== 0 && !settings.reveal}
          layout={settings.layout} spread={place === 0 ? settings.spread : Math.min(settings.spread, 2.7)} curve={settings.curve}
          selected={place === 0 ? selected : null} reducedMotion={reducedMotion} onSelect={place === 0 ? onSelect : undefined} drawOrigin={drawOrigin} />
        <mesh position={[0, -0.01, 0.9]}><boxGeometry args={[place === 0 ? 1.2 : 0.65, 0.025, 0.06]} /><meshStandardMaterial color={place === 0 ? palette.brand : palette.foreground} /></mesh>
      </group>;
    })}
    <group position={[-0.65, 0.02, 0]}><TablePile count={deck} textures={textures} back={back} reducedMotion={reducedMotion} /></group>
    <group position={[0.65, 0.02, 0]}><TablePile count={discard.length} value={discard.at(-1)?.value} faceUp textures={textures} back={back} reducedMotion={reducedMotion} /></group>
  </>;
}
export default function LaboratoryScene(props: LaboratorySceneProps) {
  const palette = usePalette();
  return palette ? <SceneCanvas shadows={props.settings.shadows} camera={{ fov: 48, near: 0.1, far: 60 }}><Contents {...props} palette={palette} /></SceneCanvas> : null;
}
