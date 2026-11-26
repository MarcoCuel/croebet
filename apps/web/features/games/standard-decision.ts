/** Shared decision rule for games that expose the standard `legalActions` projection. */
type DecisionView = {
  phase?: unknown;
  round?: unknown;
  turn?: unknown;
  log?: unknown;
  legalActions?: unknown;
  inspection?: { controller?: unknown } | null;
};

export function standardDecision(state: unknown): { seat: number; key: string } | null {
  if (!state || typeof state !== "object") return null;
  const view = state as DecisionView;
  if (view.phase !== "playing" || !Array.isArray(view.legalActions) || view.legalActions.length === 0) return null;
  const inspection = view.inspection && typeof view.inspection === "object" ? view.inspection : null;
  const seat = typeof inspection?.controller === "number" ? inspection.controller : view.turn;
  if (typeof seat !== "number" || !Number.isInteger(seat) || typeof view.round !== "number") return null;
  const log = Array.isArray(view.log) ? view.log.length : 0;
  return { seat, key: `${view.round}:${seat}:${log}:${view.legalActions.length}` };
}

export function standardLogLength(state: unknown): number {
  if (!state || typeof state !== "object") return 0;
  const log = (state as { log?: unknown }).log;
  return Array.isArray(log) ? log.length : 0;
}
