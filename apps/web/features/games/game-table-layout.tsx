"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const HistoryContext = createContext<{ id: string; visible: boolean; toggle: () => void } | null>(null);

export function useGameHistory() {
  const history = useContext(HistoryContext);
  if (!history) throw new Error("GameControls exige GameTableLayout.");
  return history;
}

/** Shared table columns, history surface and visibility for every game. */
export function GameTableLayout({ children, history }: { children: ReactNode; history: ReactNode }) {
  const id = useId();
  const [visible, setVisible] = useState(true);
  return <HistoryContext.Provider value={{ id, visible, toggle: () => setVisible(value => !value) }}>
    <div className="@container">
      <div className={cn("grid items-start transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none", visible ? "gap-6 @[60rem]:grid-cols-[minmax(0,1fr)_14rem]" : "gap-0 @[60rem]:grid-cols-[minmax(0,1fr)_0rem]")}>
        {children}
        <div className={cn("grid min-w-0 overflow-clip transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:self-stretch", visible ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <aside id={id} inert={!visible} aria-hidden={!visible} className={cn("min-h-0 min-w-0 overflow-hidden transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none @[60rem]:sticky @[60rem]:top-[calc(var(--header-height)+1rem)] @[60rem]:w-56 @[60rem]:self-start", !visible && "invisible translate-x-full")} aria-label="Histórico da partida">
            <div className="max-h-[max(0rem,calc(100dvh-var(--header-height)-2rem))] overflow-y-auto rounded-panel bg-surface p-4 text-xs leading-relaxed text-muted" data-lenis-prevent>
              {history}
            </div>
          </aside>
        </div>
      </div>
    </div>
  </HistoryContext.Provider>;
}
