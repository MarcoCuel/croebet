"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

import { GameHistory, type GameHistoryEntry } from "./game-history";
import { cn } from "@/lib/utils";

const HistoryContext = createContext<{
  id: string;
  visible: boolean;
  toggle: () => void;
} | null>(null);

export function useGameHistory() {
  const history = useContext(HistoryContext);

  if (!history) {
    throw new Error("GameControls exige GameTableLayout.");
  }

  return history;
}

export function GameTableLayout({
  children,
  history,
}: {
  children: ReactNode;
  history: GameHistoryEntry[];
}) {
  const id = useId();
  const [visible, setVisible] = useState(true);

  return (
    <HistoryContext.Provider
      value={{
        id,
        visible,
        toggle: () => setVisible((value) => !value),
      }}
    >
      <div className="@container min-w-0" data-game-table-layout>
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)] items-start",
            "[--history-width:clamp(8rem,25cqi,14rem)]",
            visible &&
              "gap-4 @3xl:grid-cols-[minmax(0,1fr)_var(--history-width)] @3xl:gap-6"
          )}
        >
          <div
            className="min-w-0 px-0.5"
            data-game-table-content
          >
            {children}
          </div>

          <aside
            id={id}
            inert={!visible}
            aria-hidden={!visible}
            aria-label="Histórico da partida"
            className={cn(
              "min-w-0",
              "@3xl:sticky @3xl:top-[calc(var(--header-height))]",
              !visible && "hidden"
            )}
          >
            <div
              className={cn(
                "max-h-[calc(100dvh-var(--header-height)-1rem)]",
                "@3xl:h-[calc(100dvh-var(--header-height)-1rem)]",
                "overflow-y-auto overscroll-contain",
                "rounded-panel bg-surface p-4",
                "text-xs leading-relaxed text-muted"
              )}
              data-lenis-prevent
            >
              <GameHistory entries={history} />
            </div>
          </aside>
        </div>
      </div>
    </HistoryContext.Provider>
  );
}