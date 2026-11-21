"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { moveDeckByPixels } from "./deck-placement";
import { projectPoint, wrapRotation, type PileTransform, type PileViewport } from "./pile-transform";
export type TransformMode = "move" | "rotate" | "resize";

export function usePileTransform(position: PileTransform, viewport: PileViewport, constrain: (t: PileTransform) => PileTransform, onMove: (point: PileTransform) => void, onClick: () => void, purchase: boolean) {
  const canvas = useThree(state => state.gl.domElement);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ position, viewport, constrain, onMove, onClick });
  useLayoutEffect(() => { latest.current = { position, viewport, constrain, onMove, onClick }; });
  const session = useRef<{ pointer: number; x: number; y: number; start: PileTransform; viewport: PileViewport; moved: boolean; purchase: boolean; mode: TransformMode; center: { x: number; y: number } } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const previousTabIndex = canvas.tabIndex; canvas.setAttribute("tabindex", "0");
    const move = (event: PointerEvent) => {
      const drag = session.current;
      if (!drag || drag.pointer !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      event.preventDefault();
      if (!drag.moved) { drag.moved = true; suppressClick.current = true; setDragging(true); }
      const next = { ...drag.start };
      if (drag.mode === "move") Object.assign(next, moveDeckByPixels(drag.start, dx, dy, { ...drag.viewport, rotation: drag.start.rotation }));
      else if (drag.mode === "rotate") {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + drag.center.x, cy = rect.top + drag.center.y;
        const delta = Math.atan2(event.clientY - cy, event.clientX - cx) - Math.atan2(drag.y - cy, drag.x - cx);
        next.rotation = wrapRotation(drag.start.rotation - delta * 180 / Math.PI);
      } else {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + drag.center.x, cy = rect.top + drag.center.y;
        next.scale = drag.start.scale * Math.hypot(event.clientX - cx, event.clientY - cy) / Math.max(12, Math.hypot(drag.x - cx, drag.y - cy));
      }
      latest.current.onMove(latest.current.constrain(next));
    };
    const finish = (event?: PointerEvent) => {
      const drag = session.current;
      if (!drag || (event && drag.pointer !== event.pointerId)) return;
      if (event?.type === "pointerup") move(event);
      session.current = null;
      suppressClick.current = true;
      if (canvas.hasPointerCapture(drag.pointer)) canvas.releasePointerCapture(drag.pointer);
      setDragging(false);
      if (event?.type === "pointerup" && !drag.moved && drag.purchase) latest.current.onClick();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !session.current) return;
      event.preventDefault(); latest.current.onMove(latest.current.constrain(session.current.start)); finish();
    };
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("lostpointercapture", finish);
    canvas.addEventListener("keydown", escape);
    return () => {
      canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", finish);
      canvas.removeEventListener("pointercancel", finish); canvas.removeEventListener("lostpointercapture", finish);
      canvas.removeEventListener("keydown", escape); canvas.setAttribute("tabindex", String(previousTabIndex));
      const drag = session.current; session.current = null;
      if (drag && canvas.hasPointerCapture(drag.pointer)) canvas.releasePointerCapture(drag.pointer);
    };
  }, [canvas]);
  return {
    dragging,
    begin: (event: PointerEvent | React.PointerEvent, mode: TransformMode = "move", activateOnClick = true) => {
      if (event.button !== 0) return;
      event.preventDefault(); suppressClick.current = false;
      session.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
        start: latest.current.position, viewport: latest.current.viewport, moved: false, purchase: purchase && mode === "move" && activateOnClick, mode, center: projectPoint(latest.current.position.x, purchase ? 0.35 : 0.6, latest.current.position.z, latest.current.viewport) };
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
    },
    cancelClick: () => { if (session.current) session.current.purchase = false; suppressClick.current = true; },
    click: () => { if (suppressClick.current) { suppressClick.current = false; return; } latest.current.onClick(); },
    key: (event: React.KeyboardEvent, mode: TransformMode = "move") => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      const current = latest.current, next = { ...current.position };
      if (mode === "rotate" && !event.altKey) next.rotation += (direction[0] || -direction[1]) * (event.shiftKey ? 15 : 5);
      else if (mode === "resize" && !event.altKey) next.scale += (direction[0] || -direction[1]) * 0.05;
      else Object.assign(next, moveDeckByPixels(next, direction[0] * (event.shiftKey ? 24 : 8), direction[1] * (event.shiftKey ? 24 : 8), { ...current.viewport, rotation: next.rotation }));
      current.onMove(current.constrain(next));
    },
  };
}
