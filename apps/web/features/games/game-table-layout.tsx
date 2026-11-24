"use client";

import { createContext, useContext, useId, useState, useRef, useLayoutEffect, type CSSProperties, type ReactNode } from "react";
import { GameHistory, type GameHistoryEntry } from "./game-history";
import { cn } from "@/lib/utils";

const HistoryContext = createContext<{ id: string; visible: boolean; toggle: () => void } | null>(null);

export function useGameHistory() {
  const history = useContext(HistoryContext);
  if (!history) throw new Error("GameControls exige GameTableLayout.");
  return history;
}

/** Shared viewport: stacked on narrow containers, independent columns on desktop. */
export function GameTableLayout({ children, history, initialHistoryVisible = true }: { children: ReactNode; history: GameHistoryEntry[]; initialHistoryVisible?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const content = container.closest<HTMLElement>("[data-match-content]");
    const update = () => {
      // Scrolling either column must not change the available viewport height.
      const top = container.getBoundingClientRect().top + (content?.scrollTop ?? window.scrollY);
      const bottom = content ? Math.min(content.getBoundingClientRect().bottom, window.innerHeight) : window.innerHeight;
      const gap = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setHeight(Math.max(0, bottom - top - gap));
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (container.parentElement) observer.observe(container.parentElement);
    if (content) observer.observe(content);
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  const id = useId();
  const [visible, setVisible] = useState(initialHistoryVisible);
  return <HistoryContext.Provider value={{ id, visible, toggle: () => setVisible(value => !value) }}>
    <div ref={root} className="@container h-[var(--table-height,calc(100dvh-var(--header-height)-1rem))] min-h-0" style={height === null ? undefined : { "--table-height": `${height}px` } as CSSProperties} data-game-table-layout>
      <div className={cn("grid h-full min-h-0 grid-cols-1 auto-rows-min items-stretch overflow-y-auto overscroll-contain @3xl:grid-rows-[minmax(0,1fr)] @3xl:overflow-hidden [--history-width:clamp(8rem,25cqi,14rem)] transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none", visible ? "gap-4 @3xl:grid-cols-[minmax(0,1fr)_var(--history-width)] @3xl:gap-6" : "gap-0 @3xl:grid-cols-[minmax(0,1fr)_0rem]")} data-lenis-prevent>
        {/* Keep the outer 2px seat highlight inside the horizontal scroll clip. */}
        <div className="min-h-0 min-w-0 px-0.5 @3xl:overflow-x-hidden @3xl:overflow-y-auto @3xl:overscroll-contain" data-lenis-prevent data-game-table-content>
          {children}
        </div>
        <aside id={id} inert={!visible} aria-hidden={!visible} className={cn("min-h-0 min-w-0 overflow-hidden transition-[opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none", !visible && "hidden @3xl:invisible @3xl:block @3xl:opacity-0")} aria-label="Histórico da partida">
          <div className="max-h-80 min-h-0 overflow-y-auto @3xl:h-full @3xl:max-h-none overscroll-contain rounded-panel bg-surface p-4 text-xs leading-relaxed text-muted" data-lenis-prevent>
            <GameHistory entries={history} />
          </div>
        </aside>
      </div>
    </div>
  </HistoryContext.Provider>;
}
