import * as T from "three";
import { seeded, type Road } from "./data";
import { Batcher } from "./geometry";
import { broadleafVolumeGeometry } from "./broadleaf-volume";
import type { Materials } from "./materials";
import {
  ROBSON_MOUND_BOUNDS,
  ROBSON_MOUND_OUTLINE,
  robsonMoundEdgeDistance,
  robsonMoundHeight,
  robsonMoundIntersects,
  robsonMoundPathClear,
  robsonMoundPlanting,
} from "./robson-mound-site";

type Point = [number, number];
export interface RobsonMoundShrub {
  x: number;
  z: number;
  y: number;
  height: number;
  width: number;
  rotation: number;
  red: boolean;
}

/** A two-metre ribbon can cut through a curved slope at a path bend. Refine
 * only local triangles and resample the same datum, keeping the path's UVs. */
export function fitRobsonMoundPath(
  source: T.BufferGeometry,
  height: (x: number, z: number) => number,
  offset: number,
) {
  const p = source.getAttribute("position"),
    tex = source.getAttribute("uv"),
    ix = source.getIndex();
  type Vertex = [number, number, number, number, number];
  const positions: number[] = [],
    uvs: number[] = [];
  const mid = (a: Vertex, b: Vertex): Vertex => {
    const x = (a[0] + b[0]) / 2,
      z = (a[2] + b[2]) / 2;
    return [x, height(x, z) + offset, z, (a[3] + b[3]) / 2, (a[4] + b[4]) / 2];
  };
  const add = (a: Vertex, b: Vertex, c: Vertex, depth = 0) => {
    const ps = [a, b, c];
    const local = robsonMoundIntersects([
      a[0],
      a[2],
      b[0],
      b[2],
      c[0],
      c[2],
      a[0],
      a[2],
    ]);
    if (local && depth < 18) {
      const lengths = ps.map((v, i) =>
        Math.hypot(v[0] - ps[(i + 1) % 3][0], v[2] - ps[(i + 1) % 3][2]),
      );
      const x = (a[0] + b[0] + c[0]) / 3,
        z = (a[2] + b[2] + c[2]) / 3;
      let error = Math.abs(height(x, z) + offset - (a[1] + b[1] + c[1]) / 3);
      for (let i = 0; i < 3; i++)
        error = Math.max(
          error,
          Math.abs(
            mid(ps[i], ps[(i + 1) % 3])[1] -
              (ps[i][1] + ps[(i + 1) % 3][1]) / 2,
          ),
        );
      if (Math.max(...lengths) > 0.9 || error > 0.012) {
        const i = lengths.indexOf(Math.max(...lengths)),
          j = (i + 1) % 3,
          k = (i + 2) % 3,
          m = mid(ps[i], ps[j]);
        add(ps[i], m, ps[k], depth + 1);
        add(m, ps[j], ps[k], depth + 1);
        return;
      }
    }
    for (const v of ps) {
      positions.push(v[0], v[1], v[2]);
      uvs.push(v[3], v[4]);
    }
  };
  const count = ix?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const vs = [i, i + 1, i + 2].map((j) => {
      const k = ix ? ix.getX(j) : j;
      return [
        p.getX(k),
        p.getY(k),
        p.getZ(k),
        tex.getX(k),
        tex.getY(k),
      ] as Vertex;
    });
    add(vs[0], vs[1], vs[2]);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  source.dispose();
  return g;
}

/** Adaptive terrain retains the exact mapped boundary; analytic vertex normals
 * keep the photographed rounded landform from reading as a faceted cone. */
export function robsonMoundGeometry() {
  const outline = Array.from(
    { length: ROBSON_MOUND_OUTLINE.length / 2 },
    (_, i) =>
      new T.Vector2(
        ROBSON_MOUND_OUTLINE[i * 2],
        ROBSON_MOUND_OUTLINE[i * 2 + 1],
      ),
  );
  const positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [];
  const h = (p: Point) => robsonMoundHeight(...p) ?? 0;
  const midpoint = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const add = (a: Point, b: Point, c: Point, depth = 0) => {
    const ps = [a, b, c],
      hs = ps.map(h);
    const lengths = ps.map((p, i) =>
      Math.hypot(p[0] - ps[(i + 1) % 3][0], p[1] - ps[(i + 1) % 3][1]),
    );
    let error = Math.abs(
      h([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]) -
        (hs[0] + hs[1] + hs[2]) / 3,
    );
    for (let i = 0; i < 3; i++)
      error = Math.max(
        error,
        Math.abs(
          h(midpoint(ps[i], ps[(i + 1) % 3])) - (hs[i] + hs[(i + 1) % 3]) / 2,
        ),
      );
    if ((Math.max(...lengths) > 1.5 || error > 0.018) && depth < 20) {
      const i = lengths.indexOf(Math.max(...lengths)),
        j = (i + 1) % 3,
        k = (i + 2) % 3;
      const mid = midpoint(ps[i], ps[j]);
      add(ps[i], mid, ps[k], depth + 1);
      add(mid, ps[j], ps[k], depth + 1);
      return;
    }
    const ordered =
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0
        ? [a, c, b]
        : ps;
    for (const p of ordered) {
      positions.push(p[0], h(p), p[1]);
      const dx = (h([p[0] + 0.025, p[1]]) - h([p[0] - 0.025, p[1]])) / 0.05;
      const dz = (h([p[0], p[1] + 0.025]) - h([p[0], p[1] - 0.025])) / 0.05;
      const n = new T.Vector3(-dx, 1, -dz).normalize();
      normals.push(n.x, n.y, n.z);
      uv.push(p[0] / 2.5, p[1] / 2.5);
    }
  };
  for (const ids of T.ShapeUtils.triangulateShape(outline, []))
    add(
      ...(ids.map((i) => [outline[i].x, outline[i].y] as Point) as [
        Point,
        Point,
        Point,
      ]),
    );
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.name = "Robson Hornby mound — mapped turf contour";
  return g;
}

export function robsonMoundShrubs(roads: Road[]) {
  const nearby = roads.filter((r) => robsonMoundIntersects(r.pts));
  const out: RobsonMoundShrub[] = [];
  const random = seeded(1978),
    b = ROBSON_MOUND_BOUNDS;
  for (let x = b.minX + 1; x < b.maxX; x += 1.65)
    for (let z = b.minZ + 1; z < b.maxZ; z += 1.65) {
      const xx = x + (random() - 0.5) * 0.65,
        zz = z + (random() - 0.5) * 0.65;
      const amount = robsonMoundPlanting(xx, zz);
      if (
        !amount ||
        robsonMoundEdgeDistance(xx, zz) < 1.45 ||
        !robsonMoundPathClear(xx, zz, nearby, 1.45)
      )
        continue;
      out.push({
        x: xx,
        z: zz,
        y: robsonMoundHeight(xx, zz)!,
        height: 0.62 + amount * 0.43 + random() * 0.12,
        width: 2.35 + amount * 0.25 + random() * 0.1,
        rotation: random() * Math.PI * 2,
        red: xx < -126 && zz < 79 && random() > 0.68,
      });
    }
  return out;
}

/** Broad, overlapping leaf volumes replace the sparse upright branch cards.
 * Reuse the existing licensed depth atlas, including its overhead leaf view;
 * the 1.35 m maximum horizontal radius fits inside the retained path clearance. */
export function robsonMoundShrubGeometry(
  shrub: RobsonMoundShrub,
  source: T.BufferGeometry,
) {
  source.computeBoundingBox();
  const bounds = source.boundingBox!,
    centre = bounds.getCenter(new T.Vector3());
  const sourcePositions = source.getAttribute("position");
  let radius = 0;
  for (let i = 0; i < sourcePositions.count; i++)
    radius = Math.max(
      radius,
      Math.hypot(
        sourcePositions.getX(i) - centre.x,
        sourcePositions.getZ(i) - centre.z,
      ),
    );
  const g = source.clone();
  g.deleteAttribute("sliceAxis");
  const positions = g.getAttribute("position"),
    normals = g.getAttribute("normal");
  const colors = new Float32Array(positions.count * 3);
  const color = new T.Color(shrub.red ? 0xa79075 : 0xd8dfc6);
  const c = Math.cos(shrub.rotation),
    s = Math.sin(shrub.rotation);
  for (let i = 0; i < positions.count; i++) {
    const lx =
      (((sourcePositions.getX(i) - centre.x) / radius) * shrub.width) / 2;
    const lz =
      (((sourcePositions.getZ(i) - centre.z) / radius) * shrub.width) / 2;
    const dx = lx * c - lz * s,
      dz = lx * s + lz * c;
    const x = shrub.x + dx,
      z = shrub.z + dz;
    const rise =
      ((sourcePositions.getY(i) - bounds.min.y) /
        (bounds.max.y - bounds.min.y)) *
      shrub.height;
    positions.setXYZ(i, x, (robsonMoundHeight(x, z) ?? 0) + rise + 0.015, z);
    // Foliage normals describe the rounded clump, not the support planes.
    const n = new T.Vector3(
      dx * 0.65,
      0.75 + rise * 0.3,
      dz * 0.65,
    ).normalize();
    normals.setXYZ(i, n.x, n.y, n.z);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  g.setAttribute("color", new T.BufferAttribute(colors, 3));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function buildRobsonMound(
  root: T.Object3D,
  materials: Materials,
  roads: Road[],
) {
  const batch = new Batcher(root, 192);
  const turf = new T.MeshStandardMaterial({
    name: "Robson mound — maintained turf",
    map: materials.texture("harbour-green/grass_ground-color.webp", true),
    normalMap: materials.texture("harbour-green/grass_ground-normal.webp"),
    roughnessMap: materials.texture(
      "harbour-green/grass_ground-roughness.webp",
    ),
    normalScale: new T.Vector2(0.25, 0.25),
    color: 0xb5b6a3,
    roughness: 0.96,
  });
  const leaves = new T.MeshStandardMaterial({
    name: "Robson mound — evergreen shrub masses",
    map: materials.texture("broadleaf/color.webp", true),
    color: 0xffffff,
    vertexColors: true,
    alphaTest: 0.18,
    alphaToCoverage: true,
    side: T.DoubleSide,
    roughness: 0.96,
    envMapIntensity: 0.35,
  });
  leaves.map!.wrapS = leaves.map!.wrapT = T.ClampToEdgeWrapping;
  batch.add(robsonMoundGeometry(), turf, -126, 78);
  const shrubSource = broadleafVolumeGeometry(true);
  for (const shrub of robsonMoundShrubs(roads)) {
    batch.add(robsonMoundShrubGeometry(shrub, shrubSource), leaves, -126, 78);
  }
  shrubSource.dispose();
  return batch.finish();
}
