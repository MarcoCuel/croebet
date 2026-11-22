import type { CardPose, Vec3 } from "./layout";
export type CardMotion = { key: string; duration: number; delay?: number; arc: number; shuffle?: boolean; via?: CardPose; hold?: number };
export type CardTarget = { id: string; value: number; face?: string; idle?: import("./model").CardIdle; glow?: boolean; pose: CardPose; hidden: boolean; zone?: "hand" | "deck" | "discard" | "exposed" | "staging"; label?: string; actionLabel?: string; paperCurve?: number; paperTilt?: number; thickness?: number; interactive?: boolean; selected?: boolean; raised?: boolean; origin?: CardPose; motion: CardMotion };

/** Two flights and an optional reading pause share one clock and one identity. */
export function routeProgress(elapsed: number, duration: number, delay = 0, hold = 0, via = false) {
  const time = Math.max(0, elapsed - delay);
  if (!via) return { leg: 0, progress: easedProgress(time, duration), done: time >= duration };
  const legDuration = duration / 2;
  if (time < legDuration + hold) return { leg: 0, progress: easedProgress(time, legDuration), done: false };
  return { leg: 1, progress: easedProgress(time - legDuration - hold, legDuration), done: time >= duration + hold };
}
/** Scene-owned history survives cards leaving and re-entering a paginated hand. */
export function consumeCardMotion(history: Map<string, string>, id: string, key: string) {
  const fresh = key !== "layout" && history.get(id) !== key;
  history.set(id, key);
  return fresh;
}
/** Lift along the hand's plane, keeping its depth relative to adjacent cards unchanged. */
export function raisedCardPosition(pose: CardPose, distance: number): Vec3 {
  const [rx, ry] = pose.rotation;
  return [pose.position[0] + distance * Math.sin(ry) * Math.sin(rx),
    pose.position[1] + distance * Math.cos(rx),
    pose.position[2] + distance * Math.cos(ry) * Math.sin(rx)];
}
export function distributionDelay(order: number, duration: number) {
  return Math.max(0, order) * duration * 0.2;
}
export function cardMotionUpdate(previous: { destination: string; key: string; active: boolean; transfer: boolean }, next: { destination: string; key: string; reducedMotion: boolean }) {
  if (previous.destination === next.destination) return "ignore";
  return previous.active && previous.transfer && previous.key === next.key && !next.reducedMotion ? "continue" : "start";
}
export function easedProgress(elapsed: number, duration: number, delay = 0) {
  const t = Math.max(0, Math.min(1, (elapsed - delay) / Math.max(0.001, duration)));
  return t * t * (3 - 2 * t);
}
export function arcPosition(from: Vec3, to: Vec3, progress: number, height: number): Vec3 {
  return [from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress + Math.sin(progress * Math.PI) * height,
    from[2] + (to[2] - from[2]) * progress];
}
