export interface TerrainMetadata {
  version: number;
  sourceYear: number;
  minX: number;
  minZ: number;
  step: number;
  columns: number;
  rows: number;
  scale: number;
  binary: string;
  lakes: { name: string; height: number; pts: number[] }[];
}
/** One sampled surface for rendering, actors, vegetation and collision. */
export class Terrain {
  constructor(
    public meta: TerrainMetadata,
    public values: Uint16Array,
  ) {
    if (
      values.length !== meta.columns * meta.rows ||
      meta.step <= 0 ||
      meta.scale <= 0
    )
      throw new Error("Invalid terrain grid");
  }
  get maxX() {
    return this.meta.minX + (this.meta.columns - 1) * this.meta.step;
  }
  get maxZ() {
    return this.meta.minZ + (this.meta.rows - 1) * this.meta.step;
  }
  contains(x: number, z: number) {
    return (
      x >= this.meta.minX &&
      z >= this.meta.minZ &&
      x <= this.maxX &&
      z <= this.maxZ
    );
  }
  intersects(points: number[]) {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]);
      maxX = Math.max(maxX, points[i]);
      minZ = Math.min(minZ, points[i + 1]);
      maxZ = Math.max(maxZ, points[i + 1]);
    }
    return (
      minX <= this.maxX &&
      maxX >= this.meta.minX &&
      minZ <= this.maxZ &&
      maxZ >= this.meta.minZ
    );
  }
  height(x: number, z: number) {
    if (!this.contains(x, z)) return 0;
    const m = this.meta,
      u = (x - m.minX) / m.step,
      v = (z - m.minZ) / m.step;
    const ix = Math.min(m.columns - 2, Math.floor(u)),
      iz = Math.min(m.rows - 2, Math.floor(v));
    const a = u - ix,
      b = v - iz,
      i = iz * m.columns + ix,
      h = this.values;
    // Same diagonal as the rendered grid, so a foot or tyre has one surface.
    return (
      (a + b <= 1
        ? h[i] + (h[i + 1] - h[i]) * a + (h[i + m.columns] - h[i]) * b
        : h[i + m.columns + 1] +
          (h[i + m.columns] - h[i + m.columns + 1]) * (1 - a) +
          (h[i + 1] - h[i + m.columns + 1]) * (1 - b)) * m.scale
    );
  }
}
export async function loadTerrain(base: string) {
  const response = await fetch(`${base}data/stanley-terrain.json`);
  if (!response.ok) throw new Error(`Terrain metadata HTTP ${response.status}`);
  const meta: TerrainMetadata = await response.json();
  if (
    meta.version !== 1 ||
    meta.columns < 2 ||
    meta.rows < 2 ||
    meta.columns * meta.rows > 4_000_000 ||
    meta.binary !== "stanley-height.u16"
  )
    throw new Error("Invalid terrain metadata");
  const data = await fetch(`${base}data/${meta.binary}`);
  if (!data.ok) throw new Error(`Terrain grid HTTP ${data.status}`);
  const buffer = await data.arrayBuffer();
  if (buffer.byteLength !== meta.columns * meta.rows * 2)
    throw new Error("Truncated terrain grid");
  const view = new DataView(buffer),
    values = new Uint16Array(buffer.byteLength / 2);
  for (let i = 0; i < values.length; i++)
    values[i] = view.getUint16(i * 2, true);
  return new Terrain(meta, values);
}
