"use client";

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter } from "three";
import { useThree } from "@react-three/fiber";
import { createCardGeometry } from "./card-geometry";
import { numberNames, type CardArtwork, type TableArtwork } from "./artwork";
export type TablePalette = { brand: string; surface: string; background: string; foreground: string; card: string; font: string };
export function useTablePalette() {
  const [palette, setPalette] = useState<TablePalette | null>(null);
  useEffect(() => {
    const update = () => {
      const probe = document.createElement("span"); document.body.appendChild(probe);
      const read = (name: string) => { probe.style.color = `var(--color-${name})`; return getComputedStyle(probe).color; };
      setPalette({ brand: read("brand"), surface: read("surface"), background: read("background"), foreground: read("foreground"), card: read("flip-card"), font: getComputedStyle(document.body).fontFamily });
      probe.remove();
    };
    update(); void document.fonts.ready.then(update); const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  return palette;
}
function texture(value: number | null, anisotropy: number, palette: TablePalette, color: string, asset?: CardArtwork, background?: string | null) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 768;
  const ctx = canvas.getContext("2d")!; ctx.scale(2, 2);
  const probe = document.createElement("span");
  probe.style.color = asset?.color ?? color; document.body.appendChild(probe);
  const ink = getComputedStyle(probe).color; probe.remove();
  ctx.fillStyle = asset?.backgroundColor ?? (value === null ? "#343638" : background ?? palette.card); ctx.fillRect(0, 0, 256, 384);
  const numeric = value !== null && (asset?.layout === "numeric" || !asset?.text);
  if (asset?.finish === "orbit") {
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 3;
    for (const radius of [76, 88, 100])
      { ctx.beginPath(); ctx.ellipse(132, 197, radius, 178, 0.52, 0, 2 * Math.PI); ctx.stroke(); }
    ctx.globalAlpha = 0.54; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(13, 13, 230, 358, 14); ctx.stroke();
    ctx.restore();
  }
  if (numeric) {
    ctx.fillStyle = asset?.textColor ?? palette.foreground;
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = `400 41px ${palette.font}`;
    ctx.fillText(asset?.caption ?? numberNames[value!] ?? String(value), 31, 31, 166);
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(211, 45, 14, 0, Math.PI * 2); ctx.fill();
    // Match the 100 × 150 artwork: oversized baseline below the lower edge.
    ctx.save(); ctx.scale(2.56, 2.56); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = `400 126px ${palette.font}`; ctx.letterSpacing = "-6.3px";
    ctx.fillText(asset?.text ?? String(value), 50, 155); ctx.restore();
  } else {
    ctx.fillStyle = asset?.color ? ink : value === null ? "#b9bab8" : palette.foreground;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `500 ${asset?.text && asset.text.length > 2 ? 76 : 136}px ${palette.font}`;
    ctx.fillText(asset?.text ?? (value === null ? "·" : String(value)), 128, 192);
    if (asset?.caption) { ctx.font = `500 20px ${palette.font}`; ctx.fillText(asset.caption, 128, 300, 220); }
  }
  // Subtle inset edge, following the physical rounded corners instead of a frame.
  ctx.strokeStyle = palette.foreground; ctx.globalAlpha = 0.1; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(2.5, 2.5, 251, 379, 19); ctx.stroke(); ctx.globalAlpha = 1;
  const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; result.anisotropy = anisotropy; result.minFilter = LinearMipmapLinearFilter; result.magFilter = LinearFilter; return result;
}
export function useCardResources(palette: TablePalette, artwork?: TableArtwork, numberColor = "#ad158f", numberBackground: string | null = null) {
  const invalidate = useThree(state => state.invalidate);
  const anisotropy = useThree(state => Math.min(8, state.gl.capabilities.getMaxAnisotropy()));
  const geometry = useMemo(() => ({ flat: createCardGeometry() }), []);
  const maps = useMemo(() => {
    const keys = new Set([...Array.from({ length: 14 }, (_, i) => String(i)), ...Object.keys(artwork?.faces ?? {})]);
    const result: Record<string, CanvasTexture> = { back: texture(null, anisotropy, palette, numberColor, artwork?.back) };
    for (const key of keys) result[key] = texture(Number.isFinite(Number(key)) ? Number(key) : 0, anisotropy, palette, numberColor, artwork?.faces[key], numberBackground);
    for (const [key, map] of Object.entries(result)) map.name = (key === "back" ? artwork?.back : artwork?.faces[key])?.src ?? "procedural";
    return result;
  }, [anisotropy, artwork, palette, numberColor, numberBackground]);
  useEffect(() => {
    let disposed = false;
    function load(asset: CardArtwork, index: string) {
      if (!asset.src) return;
      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        const canvas = maps[index].image as HTMLCanvasElement;
        const ctx = canvas.getContext("2d")!;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (asset.valueOverride !== undefined) {
          ctx.fillStyle = palette.surface; ctx.beginPath(); ctx.ellipse(94, 106, 66, 78, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = asset?.textColor ?? palette.foreground; ctx.font = "600 120px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(asset.valueOverride), 94, 106);
        }
        maps[index].needsUpdate = true; invalidate();
      };
      image.src = asset.src;
    }
    if (artwork) {
      Object.entries(artwork.faces).forEach(([value, asset]) => { if (asset) load(asset, value); });
      load(artwork.back, "back");
    }
    return () => { disposed = true; };
  }, [artwork, maps, palette.surface, palette.foreground, invalidate]);
  useEffect(() => () => Object.values(maps).forEach(map => map.dispose()), [maps]);
  useEffect(() => () => { Object.values(geometry).forEach(({ face, backFace, edge }) => { face.dispose(); backFace.dispose(); edge.dispose(); }); }, [geometry]);
  return { ...geometry, maps, palette };
}
export type CardResources = ReturnType<typeof useCardResources>;
