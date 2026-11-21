import { BufferGeometry, Float32BufferAttribute } from "three";

/** Shared paper mesh: rounded corners, thin edges and a subtle bend along its height. */
export function createCardGeometry(bend = 0) {
  const width = 0.72, height = 1.05, radius = 0.06;
  const columns = 8, cornerSegments = 12, middleSegments = 24;
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
    const z = -bend * (1 - (2 * y / height) ** 2);
    for (let col = 0; col <= columns; col++) {
      const x = (col / columns * 2 - 1) * halfWidth;
      positions.push(x, y, z); uvs.push(x / width + 0.5, y / height + 0.5);
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
  // TableCard rotates the reverse face by PI around Y; compensate the paper bend.
  const backFace = face.clone();
  const backPositions = backFace.getAttribute("position");
  for (let i = 0; i < backPositions.count; i++) backPositions.setZ(i, -backPositions.getZ(i));
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
  return { face, backFace, edge };
}
