import { BufferGeometry, Float32BufferAttribute } from "three";

/** Cylindrical paper, curved horizontally in the hand frame, even for sideways cards. */
export function createCardGeometry(curvature = 0, rotation = 0, tilt = 0, hidden = false) {
  const width = 0.72, height = 1.05, radius = 0.06;
  const deform = paperDeformation(curvature, rotation, tilt, hidden);
  const columns = 24, cornerSegments = 12, middleSegments = 24;
  // Sample quarter circles directly: uniform rows left only one segment per corner.
  const lower = Array.from({ length: cornerSegments + 1 }, (_, i) =>
    -height / 2 + radius - radius * Math.cos(i / cornerSegments * Math.PI / 2));
  const middle = Array.from({ length: middleSegments - 1 }, (_, i) =>
    -height / 2 + radius + (i + 1) / middleSegments * (height - 2 * radius));
  const ys = [...lower, ...middle, ...lower.toReversed().map(y => -y)];
  const rows = ys.length - 1;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const y = ys[row];
    const corner = Math.max(0, Math.abs(y) - (height / 2 - radius));
    const halfWidth = width / 2 - radius + Math.sqrt(Math.max(0, radius ** 2 - corner ** 2));
    for (let col = 0; col <= columns; col++) {
      const x = (col / columns * 2 - 1) * halfWidth;
      positions.push(...deform(x, y));
      uvs.push(x / width + 0.5, y / height + 0.5);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const face = new BufferGeometry();
  face.setAttribute("position", new Float32BufferAttribute(positions, 3));
  face.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  face.setIndex(indices); face.computeVertexNormals();
  // Undo the reverse mesh rotation, including diagonally bent sideways/fan cards.
  const backFace = face.clone();
  const backPositions = backFace.getAttribute("position");
  const backUV = backFace.getAttribute("uv");
  for (let i = 0; i < backPositions.count; i++) {
    backPositions.setX(i, -backPositions.getX(i));
    backUV.setX(i, 1 - backUV.getX(i));
    backPositions.setZ(i, -backPositions.getZ(i));
  }
  const backIndices = backFace.getIndex()!;
  for (let i = 0; i < backIndices.count; i += 3) {
    const first = backIndices.getX(i);
    backIndices.setX(i, backIndices.getX(i + 2)); backIndices.setX(i + 2, first);
  }
  backFace.computeVertexNormals();

  const perimeter: number[] = [];
  for (let col = 0; col <= columns; col++) perimeter.push(col);
  for (let row = 1; row <= rows; row++) perimeter.push(row * (columns + 1) + columns);
  for (let col = columns - 1; col >= 0; col--) perimeter.push(rows * (columns + 1) + col);
  for (let row = rows - 1; row > 0; row--) perimeter.push(row * (columns + 1));
  const edges: number[] = [], edgeIndices: number[] = [];
  perimeter.forEach((vertex, i) => {
    const [x, y, z] = positions.slice(vertex * 3, vertex * 3 + 3);
    edges.push(x, y, z - 0.002, x, y, z + 0.002);
    const a = i * 2, b = ((i + 1) % perimeter.length) * 2;
    edgeIndices.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const edge = new BufferGeometry();
  edge.setAttribute("position", new Float32BufferAttribute(edges, 3));
  edge.setIndex(edgeIndices); edge.computeVertexNormals();
  edge.userData.perimeter = perimeter;
  return { face, backFace, edge };
}

/** Morph the paper with the physical flip, without swapping its bend at reveal start. */
export function interpolateCardGeometry(current: ReturnType<typeof createCardGeometry>, front: typeof current, back: typeof current, mix: number) {
  for (const key of ["face", "backFace", "edge"] as const) {
    for (const attribute of ["position", "normal"] as const) {
      const output = current[key].getAttribute(attribute);
      const a = front[key].getAttribute(attribute), b = back[key].getAttribute(attribute);
      for (let i = 0; i < output.count; i++) {
        const x = a.getX(i) + (b.getX(i) - a.getX(i)) * mix;
        const y = a.getY(i) + (b.getY(i) - a.getY(i)) * mix;
        const z = a.getZ(i) + (b.getZ(i) - a.getZ(i)) * mix;
        const length = attribute === "normal" ? Math.hypot(x, y, z) || 1 : 1;
        output.setXYZ(i, x / length, y / length, z / length);
      }
      output.needsUpdate = true;
    }
    current[key].boundingSphere = null;
    current[key].boundingBox = null;
  }
}

function paperDeformation(curvature: number, rotation: number, tilt: number, hidden: boolean) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const cp = Math.cos(tilt), sp = Math.sin(tilt), reverse = hidden ? -1 : 1;
  return (x: number, y: number) => {
    // Bend in the hand frame after sideways rotation, pitch and face reversal.
    const horizontal = x * reverse * c - y * s;
    const vertical = x * reverse * s + y * c;
    const depth = -vertical * sp;
    const radius = curvature ? 1 / curvature : 0;
    const bentX = curvature ? (radius + depth) * Math.sin(horizontal * curvature) : horizontal;
    const bentZ = curvature ? (radius + depth) * Math.cos(horizontal * curvature) - radius : depth;
    const bentY = vertical * cp;
    const unpitchedY = bentY * cp - bentZ * sp;
    const z = bentY * sp + bentZ * cp;
    return [(bentX * c + unpitchedY * s) * reverse, -bentX * s + unpitchedY * c, z * reverse] as const;
  };
}

/** Reuse the meshes while hover scale and idle rotation change the paper frame. */
export function updateCardGeometry(paper: ReturnType<typeof createCardGeometry>, curvature: number, rotation: number, tilt = 0, hidden = false) {
  const deform = paperDeformation(curvature, rotation, tilt, hidden);
  const face = paper.face.getAttribute("position"), uv = paper.face.getAttribute("uv");
  const back = paper.backFace.getAttribute("position");
  for (let i = 0; i < face.count; i++) {
    const [x, y, z] = deform((uv.getX(i) - 0.5) * 0.72, (uv.getY(i) - 0.5) * 1.05);
    face.setXYZ(i, x, y, z); back.setXYZ(i, -x, y, -z);
  }
  const edge = paper.edge.getAttribute("position");
  const perimeter = paper.edge.userData.perimeter as number[];
  perimeter.forEach((vertex, i) => {
    const x = face.getX(vertex), y = face.getY(vertex), z = face.getZ(vertex);
    edge.setXYZ(i * 2, x, y, z - 0.002); edge.setXYZ(i * 2 + 1, x, y, z + 0.002);
  });
  for (const geometry of Object.values(paper)) {
    geometry.getAttribute("position").needsUpdate = true;
    geometry.computeVertexNormals(); geometry.boundingSphere = null; geometry.boundingBox = null;
  }
}

export function scaledPaperCurvature(curvature: number, baseScale: number, currentScale: number, radialOffset: number) {
  return currentScale / Math.max(baseScale / curvature + radialOffset, baseScale * 0.72);
}
