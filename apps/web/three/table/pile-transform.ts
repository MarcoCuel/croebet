import { handPlacements, worldHandPose, seatLabelPosition, radians, type CardPose } from "./layout.ts";
import { constrainDeckPosition, type DeckViewport } from "./deck-placement.ts";

export type PileTransform = { x: number; z: number; rotation: number; scale: number };
export type PileKind = "deck" | "discard";
export type ScreenRect = { left: number; right: number; top: number; bottom: number };
export type PileViewport = Omit<DeckViewport, "rotation">;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const wrapRotation = (n: number) => ((n + 180) % 360 + 360) % 360 - 180;

export function projectPoint(x: number, y: number, z: number, viewport: PileViewport) {
  const { fit, angle, width, height } = viewport, sin = Math.sin(radians(angle)), cos = Math.cos(radians(angle));
  return { x: (0.5 + (x - fit.target[0]) / (fit.right - fit.left)) * width,
    y: (0.5 - ((y - fit.target[1]) * cos - (z - fit.target[2]) * sin) / (fit.top - fit.bottom)) * height };
}
export function poseBounds(pose: CardPose, viewport: PileViewport): ScreenRect {
  const [rx, ry, rz] = pose.rotation, points = [];
  for (const x of [-0.36, 0.36]) for (const y of [-0.525, 0.525]) {
    const a = (x * Math.cos(rz) - y * Math.sin(rz)) * pose.scale;
    const b = (x * Math.sin(rz) + y * Math.cos(rz)) * pose.scale;
    const z = b * Math.sin(rx);
    points.push(projectPoint(pose.position[0] + a * Math.cos(ry) + z * Math.sin(ry),
      pose.position[1] + b * Math.cos(rx), pose.position[2] - a * Math.sin(ry) + z * Math.cos(ry), viewport));
  }
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}
export function pileBounds(t: PileTransform, kind: PileKind, viewport: PileViewport): ScreenRect {
  const rotation: [number, number, number] = kind === "deck" ? [-Math.PI / 2, radians(t.rotation), Math.PI / 2] : [-radians(viewport.angle), 0, radians(t.rotation)];
  const base = poseBounds({ position: [t.x, kind === "deck" ? 0.035 : 0.6, t.z], rotation, scale: t.scale }, viewport);
  if (kind === "deck") {
    const upper = poseBounds({ position: [t.x, 0.67, t.z], rotation, scale: 1 }, viewport);
    base.top = Math.min(base.top, upper.top); base.bottom = Math.max(base.bottom, upper.bottom);
  }
  return base;
}
export function constrainDeckTransform(t: PileTransform, viewport: PileViewport): PileTransform {
  const rotation = wrapRotation(t.rotation);
  return { ...constrainDeckPosition(t, { ...viewport, rotation }), rotation, scale: 1 };
}
const overlaps = (a: ScreenRect, b: ScreenRect) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;

/** Central workspace, including the handles; obstacle edges provide nearest free candidates. */
export function constrainDiscardTransform(input: PileTransform, viewport: PileViewport, obstacles: ScreenRect[]): PileTransform {
  const { width, height, fit, angle } = viewport;
  const desired = projectPoint(input.x, 0.6, input.z, viewport);
  for (let scale = clamp(input.scale, 0.65, 1.8); scale >= 0.649; scale = scale <= 0.65 ? 0 : Math.max(0.65, scale - 0.05)) {
    const transform = { ...input, rotation: wrapRotation(input.rotation), scale };
    const box = pileBounds(transform, "discard", viewport);
    // Reserve the actual lower-right affordances, not an empty margin on every side.
    const left = Math.min(box.left - desired.x, box.right - desired.x - 32);
    const right = box.right - desired.x + 32;
    const top = Math.min(box.top - desired.y, box.bottom - desired.y - 16);
    const bottom = box.bottom - desired.y + 16;
    const minX = width * 0.24 - left, maxX = width * 0.76 - right;
    const minY = height * 0.27 - top, maxY = height * 0.8 - bottom;
    if (minX > maxX || minY > maxY) continue;
    const xs = [clamp(desired.x, minX, maxX), minX, maxX], ys = [clamp(desired.y, minY, maxY), minY, maxY];
    for (const obstacle of obstacles) {
      xs.push(clamp(obstacle.left - right - 9, minX, maxX), clamp(obstacle.right - left + 9, minX, maxX));
      ys.push(clamp(obstacle.top - bottom - 9, minY, maxY), clamp(obstacle.bottom - top + 9, minY, maxY));
    }
    let best: { x: number; y: number; distance: number } | null = null;
    candidates: for (const x of xs) for (const y of ys) {
      const distance = (x - desired.x) ** 2 + (y - desired.y) ** 2;
      if (best && best.distance <= distance) continue;
      if (obstacles.some(obstacle => overlaps({ left: x + left, right: x + right, top: y + top, bottom: y + bottom }, obstacle))) continue;
      best = { x, y, distance };
      if (distance === 0) break candidates;
    }
    if (best) return { ...transform,
      x: input.x + (best.x - desired.x) * (fit.right - fit.left) / width,
      z: input.z + (best.y - desired.y) * (fit.top - fit.bottom) / (height * Math.sin(radians(angle))) };
  }
  // An exceptionally cramped viewport still keeps a small discard in the central workspace.
  const center = projectPoint(0, 0.6, 0.15, viewport);
  return { x: (clamp(center.x, width * 0.35, width * 0.65) - width / 2) * (fit.right - fit.left) / width + fit.target[0],
    z: input.z + (height * 0.5 - desired.y) * (fit.top - fit.bottom) / (height * Math.sin(radians(angle))), rotation: wrapRotation(input.rotation), scale: 0.65 };
}

export function handObstacles(seats: Parameters<typeof worldHandPose>[1][], hands: Parameters<typeof handPlacements>[1][], counts: number[], viewport: PileViewport) {
  return seats.flatMap((seat, index) => {
    const count = Math.min(counts[seat.seat] ?? 0, hands[index].visibleLimit ?? Infinity);
    const cards = handPlacements(count, hands[index]).map(pose => poseBounds(worldHandPose(pose, seat), viewport));
    const rectangles: ScreenRect[] = [];
    if (cards.length) rectangles.push({ left: Math.min(...cards.map(c => c.left)), right: Math.max(...cards.map(c => c.right)), top: Math.min(...cards.map(c => c.top)), bottom: Math.max(...cards.map(c => c.bottom)) });
    if (index > 0) {
      const position = seatLabelPosition(seat, hands[index].scale, false), center = projectPoint(...position, viewport);
      const halfWidth = viewport.width < 600 || seats.length > 6 ? 30 : 64;
      rectangles.push({ left: center.x - halfWidth, right: center.x + halfWidth, top: center.y - 24, bottom: center.y + 24 });
    }
    return rectangles;
  });
}
