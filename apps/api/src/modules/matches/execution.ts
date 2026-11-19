import type { GameDriver } from "./driver.ts";

/** Automatic rules finish atomically; the browser only schedules their presentation. */
export function execute<State, View, Setup, Action>(driver: GameDriver<State, View, Setup, Action>, initial: State, version: number, command?: Action) {
  let state = initial;
  const before = driver.project(initial);
  const frames: { action: Action; state: View; version: number }[] = [];
  const apply = (action: Action) => {
    const next = driver.apply(state, action);
    if (next === state) throw new Error("ILLEGAL_ACTION");
    state = next;
    frames.push({ action, state: driver.project(state), version: ++version });
  };
  if (command) {
    if (driver.finished(state) || driver.automatic(state)) throw new Error("ILLEGAL_ACTION");
    apply(command);
  }
  for (let steps = 0; !driver.finished(state); steps++) {
    const action = driver.automatic(state);
    if (!action) break;
    if (steps >= 1000) throw new Error("AUTOMATION_LIMIT");
    apply(action);
  }
  driver.parse(state);
  return { before, state, frames, version, status: driver.finished(state) ? "finished" as const : "playing" as const };
}
