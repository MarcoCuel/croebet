import { fitCamera, foregroundSeat, handWindow, sceneBounds, seatPlacements, type HandOptions, type Vec3 } from "./layout.ts";

import { constrainDiscardTransform, handObstacles, pileBounds, poseBounds, projectPoint, type PileTransform } from "./pile-transform.ts";
import { exposedTargets } from "./areas.ts";
import { constrainDeckPosition } from "./deck-placement.ts";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Presentation rules only: no game engine state, renderer or stored manual geometry. */
export function resolveTableLayout({ players, viewer, counts, exposedCounts = [], handLayout, choosing = false, cardWidths = [], width, height, angle, deck, deckRotation = -18, deckScale = 1, localCardScale = 1, opponentCardScale = 1, localHandCurve = 1, discard = { x: 0, z: 0.15, rotation: 0, scale: 1 } }: {
  players: number; viewer: number; counts: number[]; exposedCounts?: number[]; handLayout?: "spread"; choosing?: boolean; cardWidths?: number[]; width: number; height: number; angle: number; deck: Vec3; deckRotation?: number; deckScale?: number; localCardScale?: number; opponentCardScale?: number; localHandCurve?: number; discard?: PileTransform;
}) {
  const aspect = width / Math.max(1, height);
  const roomy = clamp((aspect - 0.5) / 1.1, 0, 1);
  const radius = 2.8 + roomy * 1.2;
  const localWidth = 4.4 + roomy * 1.6;
  const arrange = (radius: number) => {
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
    const rules = (place: number, count: number, multiplier = 1): HandOptions => {
      const local = place === 0, seat = seats[place];
      const baseScale = maxScales[place];
      const automaticScale = Math.max(local ? 1.15 : Math.min(0.5, baseScale * 0.8), baseScale * clamp(1 - Math.max(0, count - 7) * 0.009, 0.8, 1));
      const scale = automaticScale * multiplier;
      // Keep the current solver's allocation; larger cards consume more of it.
      const handWidth = Math.max(0.08, seat.width - 0.72 * (scale - automaticScale));
      const minStripPx = local ? 24 : 10;
      const availablePx = (handWidth + 0.72 * scale) * pixelsPerUnit;
      const visibleLimit = clamp(Math.floor((availablePx - 0.72 * scale * pixelsPerUnit) / minStripPx) + 1, local ? 6 : 2, local ? 26 : 18);
      const visible = Math.min(count, visibleLimit);
      const desiredStep = 0.72 * scale * (local ? 0.68 : 0.6);
      const step = Math.min(desiredStep, handWidth / Math.max(1, visible - 1));
      return { layout: local ? "fan" : "line", width: handWidth, scale,
        spacing: 0.72, overlap: clamp(1 - step / (0.72 * scale), 0, 0.94),
        curve: local ? clamp((visible - 1) * 0.16, 0, 1.35) : 0,
        spatialCurve: local ? 0 : clamp((visible - 1) * 0.14, 0, 1.05) * clamp(handWidth / 2.8, 0.4, 1),
        tilt: local ? angle : 3.5, orientation: 0, visibleLimit };
    };
    const hands = seats.map((seat, place) => rules(place, counts[seat.seat] ?? 0, place === 0 ? localCardScale : opponentCardScale));
    // A stable envelope at maximum occupancy avoids zooming on every purchase/discard.
    const envelope = seats.map((_, place) => {
      const limits = rules(place, 1000);
      return { ...limits, scale: maxScales[place],
        curve: place === 0 ? 1.35 : 0, spatialCurve: place === 0 ? 0 : 1.05 * clamp(seats[place].width / 2.8, 0.4, 1) };
    });
    const bounds = sceneBounds(seats, envelope, Array(players).fill(1000));
    const fit = fitCamera(bounds, aspect, angle);
    return { seats, hands, bounds, fit };
  };
  const initial = arrange(radius);
  const outerSeatX = Math.max(...initial.seats.map(seat => Math.abs(seat.position[0])));
  const outerBoundX = Math.max(...initial.bounds.map(point => Math.abs(point[0])));
  // Preserve vertical framing and card proportions; expand the seating path into
  // horizontal space left by the camera instead of capping it at desktop aspect.
  const extraWidth = Math.max(0, initial.fit.right * 0.88 - outerBoundX);
  const expandedRadius = outerSeatX > 0 ? radius * (1 + extraWidth / outerSeatX) : radius;
  // Frame using the automatic envelope so zoom cannot cancel the user's multiplier.
  const { seats, hands, bounds, fit } = expandedRadius > radius ? arrange(expandedRadius) : initial;
  // Use the projected viewport, not the original world-space seat width, for the foreground fan.
  const local = hands[0];
  const screenWidth = (fit.right - fit.left) * 0.9;
  local.visibleLimit = clamp(Math.floor(width * 0.9 / 24) + 1, 6, 50);
  const visible = Math.min(counts[viewer] ?? 0, local.visibleLimit);
  local.curve = clamp((visible - 1) * 0.16, 0, 1.35) * localHandCurve;
  const edgeAngle = local.curve * 0.32 / 2;
  const cardWidth = 2 * (0.36 * Math.cos(edgeAngle) + 0.525 * Math.sin(edgeAngle)) * local.scale;
  local.width = Math.max(0.08, screenWidth - cardWidth);
  const spread = 0.68 + 0.26 * clamp((visible - 7) / 13, 0, 1);
  const step = Math.min(0.72 * local.scale * spread, local.width / Math.max(1, visible - 1));
  local.overlap = clamp(1 - step / (0.72 * local.scale), 0, 0.94);
  if (handLayout === "spread") hands.forEach((hand, place) => {
    // Temporary choices retain the original fan and its compact interaction.
    if (place === 0 && choosing) return;
    const seat = seats[place], count = counts[seat.seat] ?? 0;
    const cardWidth = cardWidths[seat.seat] ?? 0.72;
    const gap = 0.04;
    const spacing = cardWidth + gap;
    const available = place === 0 ? screenWidth : hand.width + 0.72 * hand.scale;
    const minimum = Math.min(hand.scale, (place === 0 ? 0.8 * localCardScale : 0.4 * opponentCardScale));
    hand.scale = Math.min(hand.scale, available / cardWidth,
      Math.max(minimum, available / Math.max(cardWidth, count * spacing - gap)));
    hand.visibleLimit = Math.max(1, Math.floor((available / hand.scale + gap) / spacing));
    hand.width = Math.max(0, (hand.visibleLimit - 1) * spacing * hand.scale);
    hand.spacing = spacing; hand.overlap = 0;
  });
  const localSeat = foregroundSeat(seats[0], fit, hands[0], angle);
  const deckPoint = constrainDeckPosition({ x: deck[0], z: deck[2] }, { fit, angle, width, height, rotation: deckRotation, scale: deckScale });
  const deckPosition: Vec3 = [deckPoint.x, 0.035, deckPoint.z];
  const viewport = { fit, angle, width, height };
  const obstacles = handObstacles(seats.map((seat, place) => place === 0 ? localSeat : seat), hands, counts, viewport);
  seats.forEach((seat, place) => {
    const cards = Array.from({ length: exposedCounts[seat.seat] ?? 0 }, (_, index) => ({ id: String(index), value: 0 }));
    obstacles.push(...exposedTargets(cards, place === 0 ? localSeat : seat, place === 0, hands[place].scale, angle, handLayout === "spread").map(target => poseBounds(target.pose, viewport)));
  });
  obstacles.push(pileBounds({ ...deckPoint, rotation: deckRotation, scale: deckScale }, "deck", viewport));
  const deckLabel = projectPoint(deckPoint.x, 0.06, deckPoint.z + 0.95 * deckScale, viewport);
  obstacles.push({ left: deckLabel.x - 24, right: deckLabel.x + 24, top: deckLabel.y - 14, bottom: deckLabel.y + 14 });
  const discardTransform = constrainDiscardTransform(discard, viewport, obstacles);
  return { seats, hands, bounds, fit, localSeat, deckPosition, discardTransform, obstacles };
}
export type AdaptiveTableLayout = ReturnType<typeof resolveTableLayout>;

export function adaptiveHandWindow(count: number, hand: HandOptions, focus = 0, local = true) {
  return handWindow(count, hand.width, hand.scale, focus, local, hand.visibleLimit);
}
