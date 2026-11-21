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
      position: [local ? 0 : Math.sin(around) * radius * growth, 0,
        local ? depth * 1.2 : Math.cos(around) * depth * growth] as Vec3,
      width: local ? handWidth : Math.min(handWidth * 0.75,
        Math.PI * Math.min(radius, depth) * growth / Math.max(1, players - 1) * 0.85),
    };
  });
}

/** The foreground hand has its own readable size and pitch, shared by layout and controls. */
export function viewHandOptions(options: HandOptions, local: boolean, cameraAngle: number): HandOptions {
  return { ...options, scale: options.scale * (local ? 1.3 : 0.8),
    tilt: local ? Math.min(75, Math.max(0, options.tilt + cameraAngle - 14)) : options.tilt };
}
export function seatLabelPosition(seat: SeatPlacement, scale: number, local: boolean): Vec3 {
  return [seat.position[0], Math.max(1.65, scale * (local ? 1.65 : 1.5)), seat.position[2]];
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
  return { position: [seat.position[0] + Math.cos(seat.angle) * x + Math.sin(seat.angle) * z, y,
    seat.position[2] - Math.sin(seat.angle) * x + Math.cos(seat.angle) * z],
    // YXZ rotation order in the renderer keeps tilt/fan in each seat's local frame.
    rotation: [pose.rotation[0], seat.angle + pose.rotation[1], pose.rotation[2]], scale: pose.scale };
}
export function pilePose(index: number, position: Vec3, height: number, natural: boolean, scale = 1): CardPose {
  const noise = (n: number) => Math.sin((index + 1) * n);
  return { position: [position[0] + (natural ? noise(13.7) * 0.09 : 0), position[1] + index * height,
    position[2] + (natural ? noise(8.3) * 0.08 : 0)], rotation: [-Math.PI / 2, natural ? noise(4.1) * 0.17 : 0, 0], scale };
}

/** Fits every bound in the perspective frustum, including portrait aspect ratios. */
export function fitCamera(points: Vec3[], aspect: number, angle: number, fov = 44, margin = 1.15) {
  const pitch = radians(angle); const tanV = Math.tan(radians(fov) / 2); const tanH = tanV * Math.max(0.1, aspect);
  const target: Vec3 = [0, 0.4, 0];
  let distance = 4;
  for (const [x, worldY, z] of points) {
    const y = worldY - target[1];
    const depth = y * Math.sin(pitch) + z * Math.cos(pitch);
    const vertical = y * Math.cos(pitch) - z * Math.sin(pitch);
    distance = Math.max(distance, depth + Math.max(Math.abs(x) / tanH, Math.abs(vertical) / tanV) * margin);
  }
  return { position: [0, target[1] + Math.sin(pitch) * distance, Math.cos(pitch) * distance] as Vec3, target, distance };
}
/** Frame hands and labels only; the table deliberately extends beyond this composition. */
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
    const [x, y, z] = seatLabelPosition(seat, hand.scale, local);
    points.push([x - 0.75, y + 0.3, z], [x + 0.75, y - 0.3, z]);
  });
  return points;
}

/** Keep the far rim behind opponents, extending the surface past the near and side edges. */
export function surfacePlacement(fit: ReturnType<typeof fitCamera>, aspect: number, radius: number, depth: number) {
  const halfViewWidth = fit.distance * Math.tan(radians(44) / 2) * aspect;
  const surfaceDepth = Math.max(depth * 2.5, fit.position[2] * 1.4);
  return { radius: Math.max(radius * 2.5, halfViewWidth * 2), depth: surfaceDepth,
    centerZ: surfaceDepth - depth - 1.5 };
}
