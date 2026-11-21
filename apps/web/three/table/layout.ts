export type HandLayout = "fan" | "line";
export type Vec3 = [number, number, number];
export type CardPose = { position: Vec3; rotation: Vec3; scale: number };
export type HandOptions = { layout: HandLayout; width: number; curve: number; spacing: number; overlap: number; tilt: number; scale: number; orientation: number };
export type SeatPlacement = { seat: number; position: Vec3; angle: number; width: number };
export const radians = (degrees: number) => degrees * Math.PI / 180;

export function seatPlacements(players: number, viewer: number, radius: number, depth: number, handWidth: number): SeatPlacement[] {
  const growth = 1 + Math.max(0, players - 6) * 0.07;
  return Array.from({ length: players }, (_, place) => {
    // Reserve the foreground for the observer; opponents occupy the far semicircle.
    const around = place === 0 ? 0 : players === 2 ? Math.PI
      : Math.PI / 2 + (place - 1) / (players - 2) * Math.PI;
    const local = place === 0;
    return { seat: (viewer + place) % players,
      // Hand orientation is relative to the viewer, independently of the seat's bearing.
      angle: local ? 0 : -Math.sin(around) * 0.65,
      position: [local ? 0 : Math.sin(around) * radius * growth * 0.9, local ? 0 : 0.18,
        local ? depth * 1.2 : Math.cos(around) * depth * growth * 0.72 - 0.2] as Vec3,
      width: local ? handWidth : Math.min(handWidth * 0.75,
        Math.PI * Math.min(radius, depth) * growth / Math.max(1, players - 1) * 0.85),
    };
  });
}

/** The foreground hand has its own readable size and pitch, shared by layout and controls. */
export function viewHandOptions(options: HandOptions, local: boolean, cameraAngle: number): HandOptions {
  return { ...options, layout: local ? options.layout : "line", scale: options.scale * (local ? 1.3 : 0.9),
    // Opponents hold parallel, upright cards; only the whole row follows the seat diagonal.
    orientation: local ? options.orientation : 0,
    tilt: local ? Math.min(75, Math.max(0, options.tilt + cameraAngle - 14)) : Math.min(8, options.tilt * 0.25) };
}
export function seatLabelPosition(seat: SeatPlacement, scale: number, local: boolean): Vec3 {
  return [seat.position[0], seat.position[1] + Math.max(1.65, scale * (local ? 1.65 : 1.5)), seat.position[2]];
}

/** Adaptive, navigable window: bounded by readable physical spacing, never a fixed card count. */
export function handWindow(count: number, width: number, scale: number, focus = 0, interactive = true) {
  const capacity = Math.max(1, Math.floor(width / (scale * (interactive ? 0.1 : 0.16))) + 1);
  const length = Math.min(count, capacity);
  const start = Math.max(0, Math.min(Math.floor(focus - length / 2), count - length));
  return { start, length };
}
export function handPlacements(count: number, options: HandOptions): CardPose[] {
  const step = Math.min(options.spacing * (1 - options.overlap) * options.scale, options.width / Math.max(1, count - 1));
  return Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2;
    const t = count <= 1 ? 0 : centered / (count - 1);
    const fan = options.layout === "fan";
    return { position: [centered * step, (fan ? -t * t * options.curve * 0.5 : 0) + 0.65 * options.scale, index * 0.003 * options.scale],
      rotation: [-radians(options.tilt), radians(options.orientation), fan ? -t * options.curve * 0.32 : 0], scale: options.scale };
  });
}
export function worldHandPose(pose: CardPose, seat: SeatPlacement): CardPose {
  const [x, y, z] = pose.position;
  return { position: [seat.position[0] + Math.cos(seat.angle) * x + Math.sin(seat.angle) * z, seat.position[1] + y,
    seat.position[2] - Math.sin(seat.angle) * x + Math.cos(seat.angle) * z],
    // YXZ rotation order in the renderer keeps tilt/fan in each seat's local frame.
    rotation: [pose.rotation[0], seat.angle + pose.rotation[1], pose.rotation[2]], scale: pose.scale };
}
export function pileRotation(faceUp: boolean, cameraAngle = 36): Vec3 {
  return faceUp ? [-radians(cameraAngle), 0, 0] : [-Math.PI / 2, 0, Math.PI / 2];
}
export function pilePose(index: number, position: Vec3, height: number, natural: boolean, scale = 1, rotation = pileRotation(natural)): CardPose {
  const noise = (n: number) => Math.sin((index + 1) * n);
  const [rx, ry, rz] = rotation;
  const offset = index * height;
  // Stack along the face normal so upright piles stay solid instead of separating vertically.
  return { position: [position[0] + Math.sin(ry) * Math.cos(rx) * offset + (natural ? noise(13.7) * 0.035 : 0),
    position[1] - Math.sin(rx) * offset,
    position[2] + Math.cos(ry) * Math.cos(rx) * offset + (natural ? noise(8.3) * 0.025 : 0)],
    rotation: [rx, ry, rz + (natural ? noise(4.1) * 0.025 : 0)], scale };
}

/** Fit an orthographic frustum: distance never changes the apparent size of cards. */
export function fitCamera(points: Vec3[], aspect: number, angle: number, margin = 1.12) {
  const pitch = radians(angle), sin = Math.sin(pitch), cos = Math.cos(pitch);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxDepth = 0;
  for (const [x, y, z] of points) {
    const projectedY = y * cos - z * sin;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, projectedY); maxY = Math.max(maxY, projectedY);
    maxDepth = Math.max(maxDepth, Math.abs(y * sin + z * cos));
  }
  const safeAspect = Math.max(0.1, aspect);
  const halfHeight = Math.max(1, (maxY - minY) / 2, (maxX - minX) / (2 * safeAspect)) * margin;
  const centerY = (minY + maxY) / 2;
  const target: Vec3 = [(minX + maxX) / 2, centerY * cos, -centerY * sin];
  const distance = Math.max(12, maxDepth + halfHeight / sin + 4);
  return { position: [target[0], target[1] + sin * distance, target[2] + cos * distance] as Vec3,
    target, distance, left: -halfHeight * safeAspect, right: halfHeight * safeAspect, top: halfHeight, bottom: -halfHeight };
}
/** Anchor the local hand to the lower screen edge, leaving its bottom fifth outside the frame. */
export function foregroundSeat(seat: SeatPlacement, fit: ReturnType<typeof fitCamera>, options: HandOptions, cameraAngle: number): SeatPlacement {
  const pitch = radians(cameraAngle), sin = Math.sin(pitch), cos = Math.cos(pitch);
  const hand = viewHandOptions(options, true, cameraAngle);
  const projectedHeight = 1.05 * hand.scale * Math.cos(radians(hand.tilt - cameraAngle));
  const center = fit.target[1] * cos - fit.target[2] * sin;
  const desired = center + fit.bottom + projectedHeight * 0.3;
  const current = (seat.position[1] + 0.65 * hand.scale) * cos - seat.position[2] * sin;
  return { ...seat, position: [seat.position[0], seat.position[1], seat.position[2] + (current - desired) / sin] };
}
/** Frame hands and opponent labels; the background is independent of the camera bounds. */
export function sceneBounds(seats: SeatPlacement[], options: HandOptions, counts: number[], cameraAngle: number): Vec3[] {
  const points: Vec3[] = [[-1.5, 0, -0.8], [1.5, 1, 0.8]];
  seats.forEach((seat, place) => {
    const local = place === 0;
    const hand = viewHandOptions({ ...options, width: seat.width }, local, cameraAngle);
    const visible = handWindow(counts[seat.seat], seat.width, hand.scale, 0, local);
    for (const pose of handPlacements(visible.length, hand)) {
      const world = worldHandPose(pose, seat);
      // YXZ matches TableCard, including fan rotation, pitch and hover/selection growth.
      const [rx, ry, rz] = world.rotation;
      for (const x of [-0.4, 0.4]) for (const y of [-0.58, 0.58]) {
        const fanX = (x * Math.cos(rz) - y * Math.sin(rz)) * world.scale;
        const fanY = (x * Math.sin(rz) + y * Math.cos(rz)) * world.scale;
        const tiltedY = fanY * Math.cos(rx), tiltedZ = fanY * Math.sin(rx);
        const corner: Vec3 = [world.position[0] + fanX * Math.cos(ry) + tiltedZ * Math.sin(ry),
          world.position[1] + tiltedY, world.position[2] - fanX * Math.sin(ry) + tiltedZ * Math.cos(ry)];
        points.push(corner, [corner[0], corner[1] + 0.25 * world.scale, corner[2]]);
      }
    }
    if (!local) {
      const [x, y, z] = seatLabelPosition(seat, hand.scale, false);
      points.push([x - 0.75, y + 0.3, z], [x + 0.75, y - 0.3, z]);
    }
  });
  return points;
}
