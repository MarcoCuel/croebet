import { fitCamera, foregroundSeat, handWindow, sceneBounds, seatPlacements, type HandOptions, type Vec3 } from "./layout.ts";

import { constrainDiscardTransform, handObstacles, pileBounds, projectPoint, type PileTransform } from "./pile-transform.ts";
import { constrainDeckPosition } from "./deck-placement.ts";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Presentation rules only: no game engine state, renderer or stored manual geometry. */
export function resolveTableLayout({ players, viewer, counts, width, height, angle, deck, deckRotation = -18, discard = { x: 0, z: 0.15, rotation: 0, scale: 1 } }: {
  players: number; viewer: number; counts: number[]; width: number; height: number; angle: number; deck: Vec3; deckRotation?: number; discard?: PileTransform;
}) {
  const aspect = width / Math.max(1, height);
  const roomy = clamp((aspect - 0.5) / 1.1, 0, 1);
  const radius = 2.8 + roomy * 1.2;
  const localWidth = 4.4 + roomy * 1.6;
  const seats = seatPlacements(players, viewer, radius, 3.2, localWidth, angle);
  const crowding = Math.max(0, players - 4);
  const localScale = 1.5 - Math.min(0.12, crowding * 0.015);
  const opponentScale = clamp(1.02 - crowding * 0.06, 0.54, 1.06);
  const maxScales = seats.map((_, place) => place === 0 ? localScale : opponentScale);
  // Allocate each opponent a projected clearance, including card width and height.
  // This matters near the sides, where equal 3D seat distances appear compressed.
  const sin = Math.sin(angle * Math.PI / 180);
  seats.forEach((seat, place) => {
    if (place === 0) return;
    let clearance = Infinity;
    seats.forEach((other, otherPlace) => {
      if (otherPlace === 0 || otherPlace === place) return;
      clearance = Math.min(clearance, Math.hypot(seat.position[0] - other.position[0], (seat.position[2] - other.position[2]) * sin));
    });
    const scale = Math.min(opponentScale, clearance * 0.55);
    maxScales[place] = scale;
    const span = Math.sqrt(Math.max(0, (clearance * 0.86) ** 2 - (1.05 * scale) ** 2));
    seat.width = Math.max(0.08, Math.min(seat.width - 0.72 * scale - 0.12, span - 0.72 * scale));
  });
  const worldWidth = 2 * (radius * (1 + Math.max(0, players - 6) * 0.07) + 1.5);
  const pixelsPerUnit = Math.max(1, width) / worldWidth;
  const rules = (place: number, count: number): HandOptions => {
    const local = place === 0, seat = seats[place];
    const baseScale = maxScales[place];
    const scale = Math.max(local ? 1.15 : Math.min(0.5, baseScale * 0.8), baseScale * clamp(1 - Math.max(0, count - 7) * 0.009, 0.8, 1));
    const minStripPx = local ? 24 : 10;
    const availablePx = (seat.width + 0.72 * scale) * pixelsPerUnit;
    const visibleLimit = clamp(Math.floor((availablePx - 0.72 * scale * pixelsPerUnit) / minStripPx) + 1, local ? 6 : 2, local ? 26 : 18);
    const visible = Math.min(count, visibleLimit);
    const desiredStep = 0.72 * scale * (local ? 0.68 : 0.6);
    const step = Math.min(desiredStep, seat.width / Math.max(1, visible - 1));
    return { layout: local ? "fan" : "line", width: seat.width, scale,
      spacing: 0.72, overlap: clamp(1 - step / (0.72 * scale), 0, 0.94),
      curve: local ? clamp((visible - 1) * 0.16, 0, 1.35) : 0,
      spatialCurve: local ? 0 : clamp((visible - 1) * 0.14, 0, 1.05) * clamp(seat.width / 2.8, 0.4, 1),
      tilt: local ? angle : 3.5, orientation: 0, visibleLimit };
  };
  const hands = seats.map((seat, place) => rules(place, counts[seat.seat] ?? 0));
  // A stable envelope at maximum occupancy avoids zooming on every purchase/discard.
  const envelope = seats.map((_, place) => {
    const limits = rules(place, 1000);
    return { ...limits, scale: maxScales[place],
      curve: place === 0 ? 1.35 : 0, spatialCurve: place === 0 ? 0 : 1.05 * clamp(seats[place].width / 2.8, 0.4, 1) };
  });
  const bounds = sceneBounds(seats, envelope, Array(players).fill(1000));
  const fit = fitCamera(bounds, aspect, angle);
  const localSeat = foregroundSeat(seats[0], fit, hands[0], angle);
  const deckPoint = constrainDeckPosition({ x: deck[0], z: deck[2] }, { fit, angle, width, height, rotation: deckRotation });
  const deckPosition: Vec3 = [deckPoint.x, 0.035, deckPoint.z];
  const viewport = { fit, angle, width, height };
  const obstacles = handObstacles(seats.map((seat, place) => place === 0 ? localSeat : seat), hands, counts, viewport);
  obstacles.push(pileBounds({ ...deckPoint, rotation: deckRotation, scale: 1 }, "deck", viewport));
  const deckLabel = projectPoint(deckPoint.x, 0.06, deckPoint.z + 0.95, viewport);
  obstacles.push({ left: deckLabel.x - 24, right: deckLabel.x + 24, top: deckLabel.y - 14, bottom: deckLabel.y + 14 });
  const discardTransform = constrainDiscardTransform(discard, viewport, obstacles);
  return { seats, hands, bounds, fit, localSeat, deckPosition, discardTransform, obstacles };
}
export type AdaptiveTableLayout = ReturnType<typeof resolveTableLayout>;

export function adaptiveHandWindow(count: number, hand: HandOptions, focus = 0, local = true) {
  return handWindow(count, hand.width, hand.scale, focus, local, hand.visibleLimit);
}
