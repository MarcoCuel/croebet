"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GameActionBar({ children, wide = false, contained = false, above }: { children: ReactNode; wide?: boolean; contained?: boolean; above?: ReactNode }) {
  return <div className={cn("pointer-events-none z-30 flex flex-col items-center gap-2 px-4", contained ? "relative shrink-0 w-full" : "fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))]")} data-game-actions>
    {above}
    <div className={cn("pointer-events-auto flex flex-wrap items-center justify-center gap-4 rounded-panel border border-contrast/6 bg-surface/95 p-2 [&:not(:has(button,summary))_h2]:p-2 shadow-lg backdrop-blur-md", wide ? "w-[min(36rem,calc(100vw-2rem))]" : "w-fit max-w-[calc(100vw-2rem)]", contained && "max-w-full")}>{children}</div>
  </div>;
}

export function GameDrawActions({ onDraw, onStop, canStop = true }: { onDraw: () => void; onStop?: () => void; canStop?: boolean }) {
  return <div className="flex gap-2">
    <Button size="sm" className="min-w-24" aria-keyshortcuts="Enter" title="Comprar carta (Enter)" onClick={onDraw}>Comprar<span aria-hidden="true" className="hidden text-xs opacity-70 sm:inline">Enter</span></Button>
    {onStop && <Button size="sm" className="min-w-24" variant="secondary" aria-keyshortcuts="Escape" title="Parar (Escape)" disabled={!canStop} onClick={onStop}>Parar<span aria-hidden="true" className="hidden text-xs opacity-70 sm:inline">Esc</span></Button>}
  </div>;
}

export function GameActionShortcuts({ onDraw, onStop }: { onDraw?: () => void; onStop?: () => void }) {
  const actions = useRef({ onDraw, onStop });
  useLayoutEffect(() => { actions.current = { onDraw, onStop }; }, [onDraw, onStop]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || document.visibilityState === "hidden") return;
      const action = event.key === "Enter" ? actions.current.onDraw : event.key === "Escape" && !document.fullscreenElement ? actions.current.onStop : undefined;
      if (!action) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      if (event.key === "Enter" && target instanceof Element && target.closest('button, a, [role="button"], [role="slider"], summary')) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
