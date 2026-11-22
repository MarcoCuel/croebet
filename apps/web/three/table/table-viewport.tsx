"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { resolveTableLayout, adaptiveHandWindow } from "./adaptive-layout";
import { presentedHands, type TableState } from "./model";
import { useTableVisualSettings } from "./use-visual-settings";
import type { TablePresentation } from "./table-scene";
import { TableSceneBoundary } from "./scene-boundary";
import { TableSeatBadge } from "./seat-badge";
import { Button } from "@/components/ui/button";

const Scene = dynamic(() => import("./table-scene"), { ssr: false, loading: () => <p role="status">Carregando mesa 3D…</p> });
function SettledFallback({ children, settle }: { children: ReactNode; settle: () => void }) {
  useEffect(settle, [settle]);
  return children;
}

/** Shared by real games: the simulator never handles commands for this viewport. */
export function TableViewport({ state, presentation, viewer, turn, canDraw, onDraw, onCard, onSeat, status, children, actions, fallback, testId, onAnimating, paused, timeScale, localPlayer = true }: {
  state: TableState; presentation: TablePresentation; viewer: number; turn: number; canDraw: boolean;
  onDraw: () => void; onCard: (id: string) => void; onSeat: (seat: number) => void; status: string;
  children?: ReactNode; actions?: ReactNode; fallback?: ReactNode; testId?: string; onAnimating?: (busy: boolean) => void;
  paused?: boolean; timeScale?: number;
  localPlayer?: boolean;
}) {
  const { settings: visual, onDeckChange, onDiscardChange } = useTableVisualSettings();
  const root = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 960, height: 640 });
  const [top, setTop] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [focus, setFocus] = useState(0);
  const active = useRef(new Map<string, string>());
  const callback = useRef(onAnimating);
  useEffect(() => { callback.current = onAnimating; }, [onAnimating]);
  const onMotion = useCallback((id: string, key: string, moving: boolean) => {
    if (moving) active.current.set(id, key);
    else if (active.current.get(id) === key) active.current.delete(id);
    callback.current?.(active.current.size > 0);
  }, []);
  const settle = useCallback(() => { active.current.clear(); callback.current?.(false); }, []);
  useEffect(() => () => { active.current.clear(); callback.current?.(false); }, []);
  useEffect(() => {
    const measure = () => {
      if (!root.current) return;
      const rect = root.current.getBoundingClientRect();
      setViewport({ width: root.current.clientWidth, height: root.current.clientHeight });
      setTop(rect.top + globalThis.scrollY);
    };
    const observer = new ResizeObserver(measure);
    if (root.current) {
      observer.observe(root.current);
      if (root.current.parentElement) observer.observe(root.current.parentElement);
    }
    measure();
    globalThis.addEventListener("resize", measure);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches); update(); query.addEventListener("change", update);
    return () => { observer.disconnect(); globalThis.removeEventListener("resize", measure); query.removeEventListener("change", update); };
  }, []);
  const hands = presentedHands(state, viewer);
  const countKey = hands.map(hand => hand.length).join(":");
  const exposedKey = state.exposed?.map(cards => cards.length).join(":") ?? "";
  const layout = useMemo(() => resolveTableLayout({ players: state.hands.length, viewer, counts: countKey.split(":").map(Number), exposedCounts: exposedKey.split(":").map(Number), ...viewport,
    angle: visual.angle, localCardScale: visual.localCardScale, opponentCardScale: visual.opponentCardScale, localHandCurve: visual.localHandCurve,
    deck: [visual.deckX, 0.035, visual.deckZ], deckRotation: visual.deckRotation, deckScale: visual.deckScale,
    discard: { x: visual.discardX, z: visual.discardZ, rotation: visual.discardRotation, scale: visual.discardScale } }), [state.hands.length, viewer, countKey, exposedKey, viewport, visual]);
  const settings = { ...visual, players: state.hands.length, viewer, turn, reveal: false };
  const count = hands[viewer].length;
  const window = adaptiveHandWindow(count, layout.hands[0], focus);
  const local = presentation.seats[viewer];
  return <div ref={root} data-testid={testId} data-choice={state.choice ? "true" : "false"} style={top === null ? undefined : { height: `calc(100dvh - ${top}px - 1rem)` }} className="relative h-[calc(100dvh-var(--header-height)-5rem)] min-h-[30rem] w-full overflow-hidden rounded-panel border border-contrast/6" data-lenis-prevent>
    <TableSceneBoundary fallback={<SettledFallback settle={settle}>{fallback}</SettledFallback>}><Scene fallback={<SettledFallback settle={settle}>{fallback}</SettledFallback>} state={state} settings={settings} layout={layout} presentation={presentation} selected={null} focus={focus}
      reducedMotion={reduced} paused={paused} timeScale={timeScale} canDraw={canDraw} onDeckChange={onDeckChange} onDiscardChange={onDiscardChange} onDraw={onDraw} onSelect={onCard} onTurn={onSeat} onMenu={() => {}} onMotion={onMotion} /></TableSceneBoundary>
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col items-center gap-2 text-center">
      {status && <p role="status" className="rounded-lg bg-background/90 px-3 py-2 text-sm font-medium backdrop-blur-sm">{status}</p>}
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2">{children}</div>
    </div>
    <div className="absolute bottom-3 left-3 z-20 max-w-[45%]">
      <TableSeatBadge {...local} count={state.hands[viewer].length} active={turn === viewer} local={localPlayer} compact={viewport.width < 600} onActivate={() => onSeat(viewer)} />
    </div>
    {count > window.length && <div className="absolute right-3 bottom-3 z-20 flex items-center gap-2 rounded-lg bg-background/95 p-1">
      <Button size="sm" variant="ghost" aria-label="Cartas anteriores" disabled={window.start === 0} onClick={() => setFocus(Math.max(0, window.start - window.length / 2))}>←</Button>
      <span className="text-xs tabular-nums">{window.start + 1}–{window.start + window.length} / {count}</span>
      <Button size="sm" variant="ghost" aria-label="Próximas cartas" disabled={window.start + window.length >= count} onClick={() => setFocus(window.start + window.length * 1.5)}>→</Button>
    </div>}
    <span className="sr-only">{state.hands.flatMap((hand, seat) => hand.filter(card => card.hidden ?? presentation.hiddenSeats.includes(seat)).map(card => <span key={card.id} aria-label="Carta oculta">Carta oculta de {presentation.seats[seat].name}</span>))}</span>
    {actions}
  </div>;
}
