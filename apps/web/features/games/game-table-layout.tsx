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
  aside,
}: {
  children: ReactNode;
  history: GameHistoryEntry[];
  aside?: ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(true);
  // O conteúdo do aside (por exemplo, participantes) permanece visível quando
  // apenas o histórico é escondido. Sem conteúdo próprio, o aside inteiro
  // acompanha o histórico e libera a largura da mesa.
  const showAside = visible || !!aside;

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
            showAside &&
              "gap-4 @3xl:grid-cols-[minmax(0,1fr)_var(--history-width)]"
          )}
        >
          <div
            className="min-w-0 px-0.5"
            data-game-table-content
          >
            {children}
          </div>

          <div
            data-game-table-aside
            inert={!showAside}
            aria-hidden={!showAside}
            className={cn(
              "flex min-w-0 flex-col gap-3",
              // Em telas estreitas o aside fica abaixo da mesa e precisa
              // reservar a área da barra inferior fixa, como o conteúdo.
              "pb-60 sm:pb-64 @3xl:pb-0",
              "@3xl:sticky @3xl:top-[calc(var(--header-height))]",
              "@3xl:max-h-[calc(100dvh-var(--header-height)-1rem)]",
              !showAside && "hidden"
            )}
          >
            {aside}

            <div
              id={id}
              role="complementary"
              aria-label="Histórico da partida"
              inert={!visible}
              aria-hidden={!visible}
              className={cn(
                "min-h-0 overflow-y-auto overscroll-contain",
                "rounded-panel bg-surface p-4",
                "text-xs leading-relaxed text-muted",
                "max-h-[calc(100dvh-var(--header-height)-1rem)]",
                "@3xl:max-h-none @3xl:flex-1",
                !visible && "hidden"
              )}
              data-lenis-prevent
            >
              <GameHistory entries={history} />
            </div>
          </div>
        </div>
      </div>
    </HistoryContext.Provider>
  );
}
