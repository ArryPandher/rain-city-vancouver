import * as T from "three";
import { ArchitecturalMesh, type Vertex3 } from "./architectural-mesh";
import type { Batcher } from "./geometry";
import { PACIFIC_COAST_CENTRE } from "./pacific-coast-site";
import {
  PACIFIC_APRON,
  type PacificCoastApronSite,
} from "./pacific-coast-apron-site";

/** Visible stone surface and collision are generated from the same triangles. */
export function buildPacificCoastApron(
  batch: Batcher,
  site: PacificCoastApronSite,
  materials: { base: T.Material; trim: T.Material; frame: T.Material },
) {
  const mesh = new ArchitecturalMesh(batch, ...PACIFIC_COAST_CENTRE);
  const local = (p: Vertex3): Vertex3 => [p[0], p[1] - batch.offsetY, p[2]];
  const points: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (const tri of site.triangles) {
    let [a, b, c] = tri.map(local);
    const cross = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (cross.y < 0) [b, c] = [c, b];
    const i = points.length / 3;
    points.push(...a, ...b, ...c);
    uvs.push(a[0], a[2], b[0], b[2], c[0], c[2]);
    indices.push(i, i + 1, i + 2);
  }
  const top = new T.BufferGeometry();
  top.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  top.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  top.setIndex(indices);
  top.computeVertexNormals();
  mesh.add(top, materials.base);
  for (const edge of site.edges) {
    const a = local(edge.a),
      b = local(edge.b),
      lowA: Vertex3 = [a[0], edge.bottomA - batch.offsetY, a[2]],
      lowB: Vertex3 = [b[0], edge.bottomB - batch.offsetY, b[2]],
      shoulderA: Vertex3 = [a[0], a[1] - 0.055, a[2]],
      shoulderB: Vertex3 = [b[0], b[1] - 0.055, b[2]],
      length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    // Separate vertical coping face: no coplanar second top or floating cap.
    mesh.quad(materials.base, lowB, lowA, shoulderA, shoulderB, [
      length,
      lowB[1],
      0,
      lowA[1],
      0,
      shoulderA[1],
      length,
      shoulderB[1],
    ]);
    mesh.quad(materials.trim, shoulderB, shoulderA, a, b, [
      length,
      shoulderB[1],
      0,
      shoulderA[1],
      0,
      a[1],
      length,
      b[1],
    ]);
  }
  const posts = new Set<string>();
  for (const rail of site.rails) {
    const a = local(rail.a),
      b = local(rail.b);
    mesh.beam(a, b, PACIFIC_APRON.railRadius, materials.frame, 8);
    mesh.beam(
      [a[0], a[1] - 0.34, a[2]],
      [b[0], b[1] - 0.34, b[2]],
      0.016,
      materials.frame,
      6,
    );
    for (const p of [a, b]) {
      const key = `${p[0].toFixed(4)},${p[2].toFixed(4)}`;
      if (posts.has(key)) continue;
      posts.add(key);
      const foot: Vertex3 = [p[0], p[1] - PACIFIC_APRON.railHeight, p[2]];
      mesh.beam(foot, p, 0.021, materials.frame, 8);
      mesh.box(
        [foot[0], foot[1] + 0.009, foot[2]],
        0.075,
        0.018,
        0.075,
        materials.frame,
      );
    }
  }
  mesh.finish();
  return {
    supportTriangles: site.triangles.length,
    railSpans: site.rails.length,
    posts: posts.size,
  };
}
