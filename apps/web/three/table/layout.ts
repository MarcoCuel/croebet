export type HandLayout = "fan" | "line";
export type Vec3 = [number, number, number];
export type CardPose = { position: Vec3; rotation: Vec3; scale: number };
export type HandOptions = { layout: HandLayout; width: number; curve: number; spacing: number; overlap: number; tilt: number; scale: number; orientation: number };
export type SeatPlacement = { seat: number; position: Vec3; angle: number; width: number };
export const radians = (degrees: number) => degrees * Math.PI / 180;

export function seatPlacements(players: number, viewer: number, radius: number, depth: number, handWidth: number): SeatPlacement[] {
  const growth = 1 + Math.max(0, players - 6) * 0.07;
  return Array.from({ length: players }, (_, place) => {
    const angle = place / players * Math.PI * 2;
    return { seat: (viewer + place) % players, angle,
      position: [Math.sin(angle) * radius * growth, 0, Math.cos(angle) * depth * growth],
      width: place === 0 ? handWidth : Math.min(handWidth, 2 * Math.PI * Math.min(radius, depth) * growth / players * 0.72),
    };
  });
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
export function sceneBounds(seats: SeatPlacement[], scale: number, curve: number): Vec3[] {
  return seats.flatMap(seat => {
    const halfWidth = seat.width / 2 + 0.6 * scale;
    const extentX = Math.abs(Math.cos(seat.angle)) * halfWidth + Math.abs(Math.sin(seat.angle)) * scale;
    const extentZ = Math.abs(Math.sin(seat.angle)) * halfWidth + Math.abs(Math.cos(seat.angle)) * scale;
    return [-1, 1].flatMap(x => [-1, 1].flatMap(z => [0, (1.8 + curve * 0.15) * scale].map(y =>
      [seat.position[0] + x * extentX, y, seat.position[2] + z * extentZ] as Vec3)));
  });
}
