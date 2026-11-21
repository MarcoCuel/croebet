"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { constrainDeckPosition, moveDeckByPixels, type DeckPoint, type DeckViewport } from "./deck-placement";

export function useDeckDrag(position: DeckPoint, viewport: DeckViewport, onMove: (point: DeckPoint) => void, onClick: () => void) {
  const canvas = useThree(state => state.gl.domElement);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ position, viewport, onMove, onClick });
  useLayoutEffect(() => { latest.current = { position, viewport, onMove, onClick }; });
  const session = useRef<{ pointer: number; x: number; y: number; start: DeckPoint; viewport: DeckViewport; moved: boolean; purchase: boolean } | null>(null);
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
      latest.current.onMove(constrainDeckPosition(moveDeckByPixels(drag.start, dx, dy, drag.viewport), latest.current.viewport));
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
      event.preventDefault(); latest.current.onMove(constrainDeckPosition(session.current.start, latest.current.viewport)); finish();
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
    begin: (event: PointerEvent | React.PointerEvent, purchase = true) => {
      if (event.button !== 0) return;
      event.preventDefault(); suppressClick.current = false;
      session.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
        start: latest.current.position, viewport: latest.current.viewport, moved: false, purchase };
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
    },
    click: () => { if (suppressClick.current) { suppressClick.current = false; return; } latest.current.onClick(); },
    key: (event: React.KeyboardEvent) => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      latest.current.onMove(constrainDeckPosition(moveDeckByPixels(latest.current.position, direction[0] * step, direction[1] * step, latest.current.viewport), latest.current.viewport));
    },
  };
}
