"use client";

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } from "three";
import { useThree } from "@react-three/fiber";
import { createCardGeometry } from "./card-geometry";
export type TablePalette = { brand: string; surface: string; background: string; foreground: string };
export function useTablePalette() {
  const [palette, setPalette] = useState<TablePalette | null>(null);
  useEffect(() => {
    const update = () => {
      const probe = document.createElement("span"); document.body.appendChild(probe);
      const read = (name: string) => { probe.style.color = `var(--color-${name})`; return getComputedStyle(probe).color; };
      setPalette({ brand: read("brand"), surface: read("surface"), background: read("background"), foreground: read("foreground") });
      probe.remove();
    };
    update(); const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  return palette;
}
function texture(value: number | null, anisotropy: number) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 768;
  const ctx = canvas.getContext("2d")!; ctx.scale(2, 2);
  ctx.fillStyle = value === null ? "#343638" : "#f2f1ed"; ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = value === null ? "#646668" : "#d5d4cf"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(14, 14, 228, 356, 18); ctx.stroke();
  ctx.fillStyle = value === null ? "#b9bab8" : "#282a2b";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "500 136px sans-serif";
  ctx.fillText(value === null ? "·" : String(value), 128, 192);
  if (value !== null) { ctx.font = "600 34px sans-serif"; ctx.fillText(String(value), 42, 47); ctx.save(); ctx.translate(214, 337); ctx.rotate(Math.PI); ctx.fillText(String(value), 0, 0); ctx.restore(); }
  const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; result.anisotropy = anisotropy; result.minFilter = LinearMipmapLinearFilter; result.magFilter = LinearFilter; return result;
}
export function useCardResources(palette: TablePalette) {
  const anisotropy = useThree(state => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const geometry = useMemo(() => ({ flat: createCardGeometry(), fan: createCardGeometry(0.004), curved: createCardGeometry(0.018) }), []);
  const maps = useMemo(() => [...Array.from({ length: 10 }, (_, n) => texture(n, anisotropy)), texture(null, anisotropy)], [anisotropy]);
  useEffect(() => () => maps.forEach(map => map.dispose()), [maps]);
  useEffect(() => () => { Object.values(geometry).forEach(({ face, backFace, edge }) => { face.dispose(); backFace.dispose(); edge.dispose(); }); }, [geometry]);
  return { ...geometry, maps, palette };
}
export type CardResources = ReturnType<typeof useCardResources>;
