"use client";

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, ExtrudeGeometry, Shape, ShapeGeometry, SRGBColorSpace } from "three";
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
function texture(value: number | null, palette: TablePalette) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = value === null ? palette.brand : palette.surface; ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = value === null ? palette.surface : palette.brand; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(14, 14, 228, 356, 18); ctx.stroke();
  ctx.fillStyle = value === null ? palette.surface : palette.foreground;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "500 136px sans-serif";
  ctx.fillText(value === null ? "✦" : String(value), 128, 192);
  if (value !== null) { ctx.font = "600 34px sans-serif"; ctx.fillText(String(value), 42, 47); ctx.save(); ctx.translate(214, 337); ctx.rotate(Math.PI); ctx.fillText(String(value), 0, 0); ctx.restore(); }
  const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; return result;
}
function roundedCard() {
  const x = -0.36, y = -0.525, w = 0.72, h = 1.05, r = 0.045;
  const shape = new Shape(); shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r); shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const face = new ShapeGeometry(shape, 4);
  const positions = face.getAttribute("position"); const uv = face.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + 0.36) / w, (positions.getY(i) + 0.525) / h);
  const edge = new ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.002, bevelSegments: 1, steps: 1, curveSegments: 4 });
  edge.translate(0, 0, -0.01);
  return { face, edge };
}
export function useCardResources(palette: TablePalette) {
  const geometry = useMemo(() => roundedCard(), []);
  const maps = useMemo(() => [...Array.from({ length: 10 }, (_, n) => texture(n, palette)), texture(null, palette)], [palette]);
  useEffect(() => () => maps.forEach(map => map.dispose()), [maps]);
  useEffect(() => () => { geometry.face.dispose(); geometry.edge.dispose(); }, [geometry]);
  return { ...geometry, maps, palette };
}
export type CardResources = ReturnType<typeof useCardResources>;
