import type { CardPose, Vec3 } from "./layout";
export type CardMotion = { key: string; duration: number; delay?: number; arc: number; shuffle?: boolean };
export type CardTarget = { id: string; value: number; pose: CardPose; hidden: boolean; zone?: "hand" | "deck" | "discard"; label?: string; actionLabel?: string; curved?: boolean | "fan"; thickness?: number; revealBack?: boolean; interactive?: boolean; selected?: boolean; origin?: CardPose; motion: CardMotion };
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
  return Math.max(0, order) * duration * 0.3;
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
