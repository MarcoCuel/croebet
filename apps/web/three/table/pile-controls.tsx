"use client";

import { useId } from "react";
import { Html } from "@react-three/drei";
import { RotateCw, Maximize2 } from "lucide-react";
import { pileBounds, projectPoint, type PileTransform, type PileKind, type PileViewport } from "./pile-transform";
import type { TransformMode } from "./use-pile-transform";

export function PileControls({ kind, transform, viewport, begin, onKey }: {
  kind: PileKind; transform: PileTransform; viewport: PileViewport;
  begin: (event: React.PointerEvent, mode: TransformMode, activateOnClick?: boolean) => void;
  onKey: (event: React.KeyboardEvent, mode: TransformMode) => void;
}) {
  const description = useId();
  const y = kind === "deck" ? 0.35 : 0.6;
  const center = projectPoint(transform.x, y, transform.z, viewport), bounds = pileBounds(transform, kind, viewport);
  const name = kind === "deck" ? "deck" : "descarte";
  return <Html position={[transform.x, y, transform.z]} zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
    <div onPointerDown={event => { if (!(event.target as HTMLElement).closest("button")) begin(event, "move", false); }} className="group pointer-events-auto absolute grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ left: bounds.right - center.x, top: bounds.bottom - center.y }}>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-70">
        <button className="grid size-7 touch-none cursor-grab place-items-center rounded-full border border-contrast/10 bg-background/95 text-muted shadow-sm hover:text-foreground active:cursor-grabbing" aria-label={`Rotacionar ${name}`} aria-describedby={`${description}-rotation`} title="Arraste para girar · Setas para ajustar · Alt+setas para mover" onPointerDown={event => begin(event, "rotate")} onKeyDown={event => onKey(event, "rotate")}><RotateCw className="size-3.5" /></button>
        {kind === "discard" && <button className="grid size-7 touch-none cursor-nwse-resize place-items-center rounded-full border border-contrast/10 bg-background/95 text-muted shadow-sm hover:text-foreground" aria-label="Redimensionar descarte" aria-describedby={`${description}-scale`} title="Arraste para redimensionar · Setas para ajustar · Alt+setas para mover" onPointerDown={event => begin(event, "resize")} onKeyDown={event => onKey(event, "resize")}><Maximize2 className="size-3.5" /></button>}
        <span id={`${description}-rotation`} className="sr-only">Rotação atual: {Math.round(transform.rotation)} graus.</span>
        <span id={`${description}-scale`} className="sr-only">Tamanho atual: {Math.round(transform.scale * 100)}%.</span>
      </div>
    </div>
  </Html>;
}
