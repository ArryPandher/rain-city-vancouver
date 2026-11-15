import type * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import type { Point } from "./data";
import type { Batcher } from "./geometry";

/** Close an affected building's raised datum to its exterior finished ground.
 * All inputs are WORLD coordinates/elevations. An offset-zero Batcher is the
 * clearest caller contract, but its offsetY is compensated here when nonzero.
 * This is a narrow foundation closure, not a new facade or collision volume.
 * Open/closed simple footprint rings and either winding are accepted.
 */
export function buildHoweBuildingFoundation(
  batch: Batcher,
  footprint: Point[],
  datumY: number,
  groundHeight: (x: number, z: number) => number,
  material: T.Material,
  skipAt?: (x: number, z: number) => boolean,
) {
  const ring = footprint.filter(
    (p, i) =>
      i === 0 ||
      Math.hypot(p[0] - footprint[i - 1][0], p[1] - footprint[i - 1][1]) > 1e-6,
  );
  if (
    ring.length > 1 &&
    Math.hypot(ring[0][0] - ring.at(-1)![0], ring[0][1] - ring.at(-1)![1]) <
      1e-6
  )
    ring.pop();
  if (
    ring.length < 3 ||
    !Number.isFinite(datumY) ||
    !ring.flat().every(Number.isFinite)
  )
    throw new Error(
      "Foundation requires a finite simple building footprint and world datum",
    );
  const area = ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (Math.abs(area) < 1e-6)
    throw new Error("Foundation footprint has no area");
  if (area < 0) ring.reverse();
  const normals = ring.map((a, i): Point => {
    const b = ring[(i + 1) % ring.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  });
  // Shared miter endpoints keep perpendicular and re-entrant building corners
  // closed. Limit acute corner extension to four strip widths, inside the plan.
  const inset = (distance: number) =>
    ring.map((p, i): Point => {
      const a = normals[(i + ring.length - 1) % ring.length],
        b = normals[i],
        x = a[0] + b[0],
        z = a[1] + b[1],
        divisor = 1 + a[0] * b[0] + a[1] * b[1];
      if (divisor < 1e-8)
        throw new Error("Foundation footprint has a reversing edge");
      const scale = Math.min(
        distance / divisor,
        (4 * distance) / Math.hypot(x, z),
      );
      return [p[0] + x * scale, p[1] + z * scale];
    });
  const outer = inset(0.025),
    inner = inset(0.125),
    mesh = new ArchitecturalMesh(batch, ...ring[0]),
    top = datumY + 0.03,
    lerp = (a: Point, b: Point, t: number): Point => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ],
    vertex = (p: Point, y: number): Vertex3 => [p[0], y - batch.offsetY, p[1]],
    bottom = (p: Point) => {
      const h = groundHeight(...p);
      if (!Number.isFinite(h))
        throw new Error("Foundation ground height must be finite");
      return Math.min(h - 0.08, datumY);
    };
  let segments = 0,
    skippedSegments = 0,
    minY = top,
    perimeter = 0;
  const quad = (a: Vertex3, b: Vertex3, c: Vertex3, d: Vertex3) => {
    const width = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
      height = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    mesh.quad(material, a, b, c, d, [0, 0, width, 0, width, height, 0, height]);
  };
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      length = Math.hypot(ring[j][0] - ring[i][0], ring[j][1] - ring[i][1]),
      count = Math.ceil(length / 2);
    perimeter += length;
    let lowA = bottom(ring[i]);
    for (let k = 0; k < count; k++) {
      const t0 = k / count,
        t1 = (k + 1) / count,
        lowB = bottom(lerp(ring[i], ring[j], t1));
      const midpoint = lerp(inner[i], inner[j], (t0 + t1) / 2);
      if (top - Math.min(lowA, lowB) < 0.05 || skipAt?.(...midpoint)) {
        skippedSegments++;
        lowA = lowB;
        continue;
      }
      const a = lerp(outer[i], outer[j], t0),
        b = lerp(outer[i], outer[j], t1),
        c = lerp(inner[i], inner[j], t1),
        d = lerp(inner[i], inner[j], t0),
        al = vertex(a, lowA),
        bl = vertex(b, lowB),
        cl = vertex(c, lowB),
        dl = vertex(d, lowA),
        at = vertex(a, top),
        bt = vertex(b, top),
        ct = vertex(c, top),
        dt = vertex(d, top);
      // Each short strip is a closed six-face solid, including end caps where
      // adjacent strips are omitted because their ground already meets datum.
      quad(al, at, bt, bl);
      quad(bl, bt, ct, cl);
      quad(cl, ct, dt, dl);
      quad(dl, dt, at, al);
      quad(at, dt, ct, bt);
      quad(al, bl, cl, dl);
      minY = Math.min(minY, lowA, lowB);
      lowA = lowB;
      segments++;
    }
  }
  mesh.finish();
  return {
    segments,
    skippedSegments,
    triangles: segments * 12,
    vertices: segments * 24,
    batches: segments ? 1 : 0,
    perimeter,
    minY,
    maxY: top,
  };
}
