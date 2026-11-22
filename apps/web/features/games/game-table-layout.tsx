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

/** Shared table columns, history surface and visibility for every game. */
export function GameTableLayout({ children, history, fitTable = false }: { children: ReactNode; history: GameHistoryEntry[]; fitTable?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [tableBounds, setTableBounds] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!fitTable || !root.current) return;
    const container = root.current;
    let table: HTMLElement | null = null;
    const update = () => {
      if (!table) return;
      const bounds = table.getBoundingClientRect();
      const next = { top: bounds.top - container.getBoundingClientRect().top, height: bounds.height };
      setTableBounds(current => current?.top === next.top && current.height === next.height ? current : next);
    };
    const observer = new ResizeObserver(update);
    const connect = () => {
      const next = container.querySelector<HTMLElement>("[data-table-viewport]");
      if (next === table) return;
      if (table) observer.unobserve(table);
      table = next;
      if (table) observer.observe(table);
      update();
    };
    const mutations = new MutationObserver(connect);
    mutations.observe(container, { childList: true, subtree: true });
    observer.observe(container);
    window.addEventListener("resize", update);
    connect();
    return () => { mutations.disconnect(); observer.disconnect(); window.removeEventListener("resize", update); };
  }, [fitTable]);
  const id = useId();
  const [visible, setVisible] = useState(true);
  return <HistoryContext.Provider value={{ id, visible, toggle: () => setVisible(value => !value) }}>
    <div ref={root} className="@container">
      <div className={cn("grid items-start transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none", visible ? "gap-6 @[60rem]:grid-cols-[minmax(0,1fr)_14rem]" : "gap-0 @[60rem]:grid-cols-[minmax(0,1fr)_0rem]")}>
        {children}
        <div className={cn("grid min-w-0 overflow-clip transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:self-stretch", visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <aside id={id} inert={!visible} aria-hidden={!visible} style={fitTable && tableBounds ? { "--table-top": `${tableBounds.top}px`, "--table-height": `${tableBounds.height}px` } as CSSProperties : undefined} className={cn("min-h-0 min-w-0 overflow-hidden transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:w-56 @[60rem]:self-start", !fitTable && "@[60rem]:sticky @[60rem]:top-[calc(var(--header-height)+1rem)]", fitTable && "@[60rem]:mt-(--table-top) @[60rem]:h-(--table-height) @[60rem]:flex @[60rem]:flex-col", !visible && "invisible translate-x-full")} aria-label="Histórico da partida">
            <div className={cn("overflow-y-auto rounded-panel bg-surface p-4 text-xs leading-relaxed text-muted", fitTable ? "max-h-[max(0rem,calc(100dvh-var(--header-height)-2rem))] @[60rem]:max-h-none @[60rem]:h-full min-h-0" : "max-h-[max(0rem,calc(100dvh-var(--header-height)-2rem))]")} data-lenis-prevent>
              <GameHistory entries={history} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  </HistoryContext.Provider>;
}
