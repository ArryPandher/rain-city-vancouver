import type { BufferGeometry } from "three";

const CELL_SIZE = 16;
// Match CollisionWorld.bridgeAt: a car below a separate deck must not snap up.
const MAX_STEP_UP = 3;

export type VehicleSurfaceStats = Readonly<{
  triangleCount: number;
  triangleBytes: number;
  cellCount: number;
  cellIndexBytes: number;
  /** Typed contact payload only; excludes JavaScript Map/key overhead. */
  payloadBytes: number;
}>;

/** Immutable contact copy of final world-space road triangles, never GPU data. */
export class VehicleRoadSurface {
  readonly stats: VehicleSurfaceStats;
  constructor(
    private readonly faces: Float32Array,
    private readonly cells: Map<string, Uint32Array>,
  ) {
    let cellIndexBytes = 0;
    for (const ids of cells.values()) cellIndexBytes += ids.byteLength;
    this.stats = Object.freeze({
      triangleCount: faces.length / 9,
      triangleBytes: faces.byteLength,
      cellCount: cells.size,
      cellIndexBytes,
      payloadBytes: faces.byteLength + cellIndexBytes,
    });
  }

  height(x: number, z: number, referenceY = Infinity): number | undefined {
    if (!Number.isFinite(x) || !Number.isFinite(z) || Number.isNaN(referenceY))
      return undefined;
    const ids = this.cells.get(
      `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`,
    );
    if (!ids) return undefined;
    const f = this.faces;
    let y: number | undefined;
    for (const id of ids) {
      const i = id * 9,
        ax = f[i],
        az = f[i + 2],
        bx = f[i + 3],
        bz = f[i + 5],
        cx = f[i + 6],
        cz = f[i + 8];
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
      const h = u * f[i + 1] + v * f[i + 4] + (1 - u - v) * f[i + 7];
      if (h <= referenceY + MAX_STEP_UP && (y === undefined || h > y)) y = h;
    }
    return y;
  }
}

/** Build while final clipped ribbons still exist; release temporary arrays on finish. */
export class VehicleRoadSurfaceBuilder {
  private faces: number[] = [];
  private cells = new Map<string, number[]>();

  add(geometry: BufferGeometry) {
    const p = geometry.getAttribute("position"),
      ix = geometry.getIndex();
    if (!p) return;
    const end = Math.min(
      ix?.count ?? p.count,
      geometry.drawRange.start + geometry.drawRange.count,
    );
    for (let n = geometry.drawRange.start; n + 2 < end; n += 3) {
      const a = ix ? ix.getX(n) : n,
        b = ix ? ix.getX(n + 1) : n + 1,
        c = ix ? ix.getX(n + 2) : n + 2;
      const ax = Math.fround(p.getX(a)),
        ay = Math.fround(p.getY(a)),
        az = Math.fround(p.getZ(a)),
        bx = Math.fround(p.getX(b)),
        by = Math.fround(p.getY(b)),
        bz = Math.fround(p.getZ(b)),
        cx = Math.fround(p.getX(c)),
        cy = Math.fround(p.getY(c)),
        cz = Math.fround(p.getZ(c));
      if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite))
        continue;
      const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(area) < 1e-9) continue;
      const id = this.faces.length / 9;
      this.faces.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      const minX = Math.floor(Math.min(ax, bx, cx) / CELL_SIZE),
        maxX = Math.floor(Math.max(ax, bx, cx) / CELL_SIZE),
        minZ = Math.floor(Math.min(az, bz, cz) / CELL_SIZE),
        maxZ = Math.floor(Math.max(az, bz, cz) / CELL_SIZE);
      for (let x = minX; x <= maxX; x++)
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${z}`;
          const ids = this.cells.get(key) ?? [];
          ids.push(id);
          this.cells.set(key, ids);
        }
    }
  }

  finish() {
    const cells = new Map<string, Uint32Array>();
    for (const [key, ids] of this.cells) cells.set(key, new Uint32Array(ids));
    const surface = new VehicleRoadSurface(new Float32Array(this.faces), cells);
    this.faces = [];
    this.cells.clear();
    return surface;
  }
}
