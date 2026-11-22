export type HandLayout = "fan" | "line";
export type Vec3 = [number, number, number];
export type CardPose = { position: Vec3; rotation: Vec3; scale: number; paperCurve?: number };
export type HandOptions = { layout: HandLayout; width: number; curve: number; spacing: number; overlap: number; tilt: number; scale: number; orientation: number; spatialCurve?: number; visibleLimit?: number };
export type SeatPlacement = { seat: number; position: Vec3; angle: number; width: number };
export const radians = (degrees: number) => degrees * Math.PI / 180;

export function seatPlacements(players: number, viewer: number, radius: number, depth: number, handWidth: number, cameraAngle = 36): SeatPlacement[] {
  const growth = 1 + Math.max(0, players - 6) * 0.07;
  // Keep lateral seats at the outer edges instead of curling them into the center.
  const front = Math.min(0.6, Math.max(0, players - 4) * 0.18);
  const path: { x: number; z: number; distance: number }[] = [];
  const add = (x: number, z: number) => path.push({ x, z, distance: 0 });
  for (let i = 0; i <= 32; i++) add(1, front + (-0.55 - front) * i / 32);
  for (let i = 1; i <= 32; i++) {
    const t = i / 32 * Math.PI / 2;
    add(0.65 + 0.35 * Math.cos(t), -0.55 - 0.45 * Math.sin(t));
  }
  for (let i = 1; i <= 64; i++) add(0.65 - 1.3 * i / 64, -1);
  for (let i = 1; i <= 32; i++) {
    const t = i / 32 * Math.PI / 2;
    add(-0.65 - 0.35 * Math.sin(t), -0.55 - 0.45 * Math.cos(t));
  }
  for (let i = 1; i <= 32; i++) add(-1, -0.55 + (front + 0.55) * i / 32);
  let length = 0;
  path.forEach((point, i) => {
    if (i) length += Math.hypot((point.x - path[i - 1].x) * radius * 0.9,
      (point.z - path[i - 1].z) * depth * 0.72 * Math.sin(radians(cameraAngle)));
    point.distance = length;
  });
  const positions = Array.from({ length: players - 1 }, (_, i) => {
    if (players === 2) return { x: 0, z: -1 };
    if (players === 3) return { x: i === 0 ? 0.75 : -0.75, z: -0.75 };
    const wanted = length * (i / (players - 2));
    const index = path.findIndex(point => point.distance >= wanted);
    const right = path[index < 0 ? path.length - 1 : index], left = path[Math.max(0, index - 1)];
    const t = right.distance === left.distance ? 0 : (wanted - left.distance) / (right.distance - left.distance);
    return { x: left.x + (right.x - left.x) * t, z: left.z + (right.z - left.z) * t };
  });
  return Array.from({ length: players }, (_, place) => {
    const point = place === 0 ? { x: 0, z: 0 } : positions[place - 1];
    const local = place === 0;
    return { seat: (viewer + place) % players,
      // Hand orientation is relative to the viewer, independently of the seat's bearing.
      angle: -point.x * 0.65,
      position: [local ? 0 : point.x * radius * growth * 0.9, local ? 0 : 0.18,
        local ? depth * 1.2 : point.z * depth * growth * 0.72 - 0.2] as Vec3,
      width: local ? handWidth : Math.min(handWidth * 0.75,
        Math.PI * Math.min(radius, depth) * growth / Math.max(1, players - 1) * 0.85),
    };
  });
}

export function seatLabelPosition(seat: SeatPlacement, scale: number, local: boolean): Vec3 {
  return [seat.position[0], seat.position[1] + Math.max(1.65, scale * (local ? 1.65 : 1.5)), seat.position[2]];
}

/** Adaptive, navigable window: bounded by readable physical spacing, never a fixed card count. */
export function handWindow(count: number, width: number, scale: number, focus = 0, interactive = true, limit = Infinity) {
  const capacity = Math.max(1, Math.floor(width / (scale * (interactive ? 0.1 : 0.16))) + 1);
  const length = Math.min(count, capacity, limit);
  const start = Math.max(0, Math.min(Math.floor(focus - length / 2), count - length));
  return { start, length };
}
export function handPlacements(count: number, options: HandOptions): CardPose[] {
  const step = Math.min(options.spacing * (1 - options.overlap) * options.scale, options.width / Math.max(1, count - 1));
  const pitch = radians(options.tilt);
  const fanArc = options.layout === "fan" ? options.curve * 0.32 : 0;
  const fanRadius = fanArc > 0 ? (count - 1) * step / (2 * Math.sin(fanArc / 2)) : 0;
  return Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2;
    const t = count <= 1 ? 0 : centered / (count - 1);
    const fan = options.layout === "fan";
    if (fan) {
      // One pivot controls both the card centers and their tangents. Keep the
      // entire fan in its tilted plane; world-Z offsets intersect that plane.
      const turn = t * fanArc;
      const drop = fanRadius * (Math.cos(turn) - 1);
      // Later cards cover earlier ones, including the newly purchased card.
      // Separation exceeds the shallow paper bend plus its physical thickness.
      const layer = index * 0.014 * options.scale;
      return { position: [fanArc > 0 ? fanRadius * Math.sin(turn) : centered * step,
        0.65 * options.scale + drop * Math.cos(pitch) + layer * Math.sin(pitch),
        -drop * Math.sin(pitch) + layer * Math.cos(pitch)],
        rotation: [-pitch, radians(options.orientation), -turn], scale: options.scale, paperCurve: options.curve > 0 ? 0.06 : 0 };
    }
    // Never squeeze the layer below the physical paper thickness. In narrow
    // hands reduce the arc instead, keeping its cylinders and width consistent.
    const layerStep = 0.02 * options.scale;
    const span = (count - 1) * step;
    const minimumRadius = 0.9 * options.scale;
    const arc = Math.min(options.spatialCurve ?? 0,
      2 * Math.asin(Math.min(1, span / (2 * minimumRadius + (count - 1) * layerStep))));
    const yaw = t * arc;
    const radius = arc > 0 ? (count - 1) * (step / (2 * Math.sin(arc / 2)) - layerStep / 2) : 0;
    // Concentric paper surfaces preserve overlap instead of intersecting tangent planes.
    const layer = index * layerStep;
    const paperRadius = radius + layer;
    return { position: [arc > 0 ? paperRadius * Math.sin(yaw) : centered * step,
      0.65 * options.scale,
      (arc > 0 ? paperRadius * Math.cos(yaw) - radius : layer)],
      rotation: [-pitch, radians(options.orientation) + yaw, 0], scale: options.scale, paperCurve: radius > 0 ? options.scale / paperRadius : 0 };
  });
}
/** Slide decorative pairs along their existing cylinder rather than through it. */
export function offsetHandPose(pose: CardPose, distance: number, cylindrical: boolean): CardPose {
  if (!cylindrical || !pose.paperCurve) return { ...pose, position: [pose.position[0] + distance, pose.position[1], pose.position[2]] };
  const radius = pose.scale / pose.paperCurve, yaw = pose.rotation[1], nextYaw = yaw + distance / radius;
  return { ...pose, position: [pose.position[0] + radius * (Math.sin(nextYaw) - Math.sin(yaw)), pose.position[1],
    pose.position[2] + radius * (Math.cos(nextYaw) - Math.cos(yaw))], rotation: [pose.rotation[0], nextYaw, pose.rotation[2]] };
}

export function worldHandPose(pose: CardPose, seat: SeatPlacement): CardPose {
  const [x, y, z] = pose.position;
  return { position: [seat.position[0] + Math.cos(seat.angle) * x + Math.sin(seat.angle) * z, seat.position[1] + y,
    seat.position[2] - Math.sin(seat.angle) * x + Math.cos(seat.angle) * z],
    // YXZ rotation order in the renderer keeps tilt/fan in each seat's local frame.
    rotation: [pose.rotation[0], seat.angle + pose.rotation[1], pose.rotation[2]], scale: pose.scale, paperCurve: pose.paperCurve };
}
export function pileRotation(faceUp: boolean, cameraAngle = 36): Vec3 {
  return faceUp ? [-radians(cameraAngle), 0, 0] : [-Math.PI / 2, 0, Math.PI / 2];
}
export function pilePose(index: number, position: Vec3, height: number, natural: boolean, scale = 1, rotation = pileRotation(natural)): CardPose {
  const noise = (n: number) => Math.sin((index + 1) * n);
  const [rx, ry, rz] = rotation;
  const offset = index * height * scale;
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
  const hand = options;
  const projectedHeight = 1.05 * hand.scale * Math.cos(radians(hand.tilt - cameraAngle));
  const center = fit.target[1] * cos - fit.target[2] * sin;
  const desired = center + fit.bottom + projectedHeight * 0.3;
  const current = (seat.position[1] + 0.65 * hand.scale) * cos - seat.position[2] * sin;
  return { ...seat, position: [fit.target[0], seat.position[1], seat.position[2] + (current - desired) / sin] };
}
/** Frame hands and opponent labels; the background is independent of the camera bounds. */
export function sceneBounds(seats: SeatPlacement[], hands: HandOptions[], counts: number[], deck?: Vec3): Vec3[] {
  const points: Vec3[] = [[-1.5, 0, -0.8], [1.5, 1, 0.8]];
  if (deck) for (const x of [-0.85, 0.85]) for (const z of [-0.85, 0.85]) {
    points.push([deck[0] + x, 0, deck[2] + z], [deck[0] + x, 1, deck[2] + z]);
  }
  seats.forEach((seat, place) => {
    const local = place === 0;
    const hand = hands[place];
    const visible = handWindow(counts[seat.seat], seat.width, hand.scale, 0, local, hand.visibleLimit);
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
