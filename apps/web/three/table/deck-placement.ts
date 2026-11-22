import { radians, type fitCamera } from "./layout.ts";

export type DeckPoint = { x: number; z: number };
export type DeckViewport = { fit: ReturnType<typeof fitCamera>; angle: number; width: number; height: number; rotation: number; scale?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Include the complete rotated stack and its anchored controls inside the visible frame. */
export function constrainDeckPosition(point: DeckPoint, { fit, angle, width, height, rotation, scale = 1 }: DeckViewport): DeckPoint {
  const sin = Math.sin(radians(angle)), cos = Math.cos(radians(angle));
  const turn = radians(rotation), c = Math.cos(turn), s = Math.sin(turn);
  const viewWidth = fit.right - fit.left, viewHeight = fit.top - fit.bottom;
  const marginX = 30 * viewWidth / Math.max(1, width), marginY = 30 * viewHeight / Math.max(1, height);
  const labelHalfX = 30 * viewWidth / Math.max(1, width), labelHalfY = 20 * viewHeight / Math.max(1, height);
  let left = -labelHalfX, right = labelHalfX;
  let bottom = 0.06 * cos - 0.95 * scale * sin - labelHalfY, top = 0.06 * cos - 0.95 * scale * sin + labelHalfY;
  for (const x of [-0.575, 0.575]) for (const z of [-0.4, 0.4]) for (const y of [0.01, 0.67]) {
    const dx = (c * x + s * z) * scale, dz = (-s * x + c * z) * scale;
    left = Math.min(left, dx); right = Math.max(right, dx);
    bottom = Math.min(bottom, (0.01 + (y - 0.01) * scale) * cos - dz * sin); top = Math.max(top, (0.01 + (y - 0.01) * scale) * cos - dz * sin);
  }
  const centerY = fit.target[1] * cos - fit.target[2] * sin;
  const minX = fit.target[0] + fit.left + marginX - left, maxX = fit.target[0] + fit.right - marginX - right;
  const minZ = (top - (centerY + fit.top - marginY)) / sin;
  const maxZ = (bottom - (centerY + fit.bottom + marginY)) / sin;
  return { x: minX <= maxX ? clamp(point.x, minX, maxX) : fit.target[0],
    z: minZ <= maxZ ? clamp(point.z, minZ, maxZ) : (minZ + maxZ) / 2 };
}

/** Orthographic pointer motion mapped onto the deck's horizontal movement plane. */
export function moveDeckByPixels(start: DeckPoint, dx: number, dy: number, viewport: DeckViewport): DeckPoint {
  return { x: start.x + dx * (viewport.fit.right - viewport.fit.left) / Math.max(1, viewport.width),
    z: start.z + dy * (viewport.fit.top - viewport.fit.bottom) / (Math.max(1, viewport.height) * Math.sin(radians(viewport.angle))) };
}
