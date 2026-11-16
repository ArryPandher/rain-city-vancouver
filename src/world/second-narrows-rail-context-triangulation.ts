import type { RailGroundTriangle } from "./second-narrows-rail-context";
/** Improve the outside-soil triangulation without moving any shared road,
 * shoreline, or bank boundary vertex. Flips operate only between two soil faces;
 * the measured road-profile boundary remains a constrained edge. */
export function improveRailGroundTriangles(
  triangles: RailGroundTriangle[],
  onRoad: (x: number, z: number) => boolean,
) {
  const vertices: [number, number, number][] = [],
    lookup = new Map<string, number>();
  const faces = triangles.map(
    (t) =>
      t.points.map((p) => {
        const key = `${p[0]},${p[2]}`;
        let id = lookup.get(key);
        if (id === undefined) {
          id = vertices.length;
          vertices.push(p);
          lookup.set(key, id);
        }
        return id;
      }) as [number, number, number],
  );
  const soil = triangles.map(
    (t) =>
      !onRoad(
        t.points.reduce((s, p) => s + p[0], 0) / 3,
        t.points.reduce((s, p) => s + p[2], 0) / 3,
      ),
  );
  const cross = (a: number, b: number, c: number) => {
    const p = vertices[a],
      q = vertices[b],
      r = vertices[c];
    return (q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]);
  };
  const quality = (a: number, b: number, c: number) => {
    const p = vertices[a],
      q = vertices[b],
      r = vertices[c];
    const ab = (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2,
      bc = (q[0] - r[0]) ** 2 + (q[2] - r[2]) ** 2,
      ca = (r[0] - p[0]) ** 2 + (r[2] - p[2]) ** 2;
    return Math.abs(cross(a, b, c)) / Math.max(ab, bc, ca);
  };
  for (let pass = 0; pass < 24; pass++) {
    const edges = new Map<string, { face: number; opposite: number }>(),
      used = new Set<number>();
    let changed = 0;
    for (let i = 0; i < faces.length; i++) {
      if (!soil[i] || used.has(i)) continue;
      const t = faces[i];
      for (let k = 0; k < 3; k++) {
        const a = t[k],
          b = t[(k + 1) % 3],
          c = t[(k + 2) % 3],
          key = a < b ? `${a},${b}` : `${b},${a}`,
          other = edges.get(key);
        if (!other) {
          edges.set(key, { face: i, opposite: c });
          continue;
        }
        const j = other.face,
          d = other.opposite;
        if (
          used.has(i) ||
          used.has(j) ||
          c === d ||
          cross(c, d, a) * cross(c, d, b) >= -1e-12
        )
          continue;
        const old = Math.min(quality(a, b, c), quality(a, b, d)),
          next = Math.min(quality(c, d, a), quality(c, d, b));
        if (next <= old + 1e-7) continue;
        faces[i] = [c, d, a];
        faces[j] = [d, c, b];
        used.add(i);
        used.add(j);
        changed++;
        break;
      }
    }
    if (!changed) break;
  }
  return faces.map(
    (ids) => ids.map((id) => vertices[id]) as RailGroundTriangle["points"],
  );
}
