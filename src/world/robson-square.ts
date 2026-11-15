import * as T from "three";
import { robsonLowerStairGeometry } from "./robson-stairs";
import { Building, centroid } from "./data";
import { Batcher } from "./geometry";
import type { Materials } from "./materials";
import {
  gridXZ,
  gridUV,
  robsonHeight,
  robsonBaseHeight,
  ROBSON_GARDEN_ID,
  ROBSON_CANOPIES,
  ROBSON_PLANTERS,
  ROBSON_POOL,
} from "./robson-site";
type P = [number, number];
export function robsonSquare(b: Building, batch: Batcher, m: Materials) {
  if (b.id !== ROBSON_GARDEN_ID && !ROBSON_CANOPIES.has(b.id)) return false;
  const [cx, cz] = centroid(b.pts);
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, cx, cz);
  const concrete = new T.MeshStandardMaterial({
    name: "Robson Square — concrete terraces",
    map: m.texture("cast-concrete/color.jpg", true),
    normalMap: m.texture("cast-concrete/normal.jpg"),
    normalScale: new T.Vector2(0.2, 0.2),
    roughness: 0.97,
    color: 0xc7c1b1,
  });
  const box = (
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material = concrete,
  ) => {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(Math.PI / 4);
    const [x, z] = gridXZ(u, v);
    g.translate(x, y, z);
    add(g, mat);
  };
  if (ROBSON_CANOPIES.has(b.id)) {
    const uv = Array.from({ length: b.pts.length / 2 }, (_, i) =>
      gridUV(b.pts[i * 2], b.pts[i * 2 + 1]),
    );
    const minU = Math.min(...uv.map((p) => p[0])) + 0.2,
      maxU = Math.max(...uv.map((p) => p[0])) - 0.2,
      minV = Math.min(...uv.map((p) => p[1])) + 0.4,
      maxV = Math.max(...uv.map((p) => p[1])) - 0.4;
    const glass = new T.MeshPhysicalMaterial({
      name: "Robson Square — arched glass entry",
      color: 0x95b4ad,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      roughness: 0.15,
      metalness: 0.15,
      side: T.DoubleSide,
      clearcoat: 0.5,
    });
    glass.userData.castShadow = false;
    const steel = new T.MeshStandardMaterial({
      color: 0xa9bfb5,
      metalness: 0.4,
      roughness: 0.5,
    });
    const point = (u: number, t: number) => {
      const v = minV + (maxV - minV) * t,
        [x, z] = gridXZ(u, v);
      return new T.Vector3(x, 2.7 + Math.sin(Math.PI * t) * 1.4, z);
    };
    const beam = (a: T.Vector3, b: T.Vector3) => {
      const delta = b.clone().sub(a),
        g = new T.CylinderGeometry(0.055, 0.055, delta.length(), 6);
      g.applyQuaternion(
        new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          delta.normalize(),
        ),
      );
      g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
      add(g, steel);
    };
    for (let j = 0; j < 12; j++) {
      const a = point(minU, j / 12),
        bb = point(maxU, j / 12),
        c = point(maxU, (j + 1) / 12),
        d = point(minU, (j + 1) / 12),
        g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          [a, bb, c, d].flatMap((p) => p.toArray()),
          3,
        ),
      );
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
      );
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      add(g, glass);
      for (let u = minU; u <= maxU; u += 1.8)
        beam(point(u, j / 12), point(u, (j + 1) / 12));
      if (j % 3 === 0) beam(a, bb);
    }
    for (const u of [minU + 0.2, maxU - 0.2])
      for (const v of [minV, maxV]) box(u, 1.35, v, 0.13, 2.7, 0.13, steel);
    return true;
  }
  // Subdivide the real outline before applying elevation; the original garden
  // footprint remains intact and shares its height function with walking/vehicles.
  const outline = Array.from(
      { length: b.pts.length / 2 },
      (_, i) => [b.pts[i * 2], b.pts[i * 2 + 1]] as P,
    ),
    positions: number[] = [],
    uvs: number[] = [];
  const elevation = (p: P) => robsonBaseHeight(p[0], p[1], b.pts) ?? 0.08;
  const subdivide = (a: P, bb: P, c: P, depth = 0) => {
    const lengths = [
        Math.hypot(a[0] - bb[0], a[1] - bb[1]),
        Math.hypot(bb[0] - c[0], bb[1] - c[1]),
        Math.hypot(c[0] - a[0], c[1] - a[1]),
      ],
      longest = Math.max(...lengths);
    const heights = [a, bb, c].map(elevation),
      points = [a, bb, c];
    let error = Math.abs(
      elevation([(a[0] + bb[0] + c[0]) / 3, (a[1] + bb[1] + c[1]) / 3]) -
        (heights[0] + heights[1] + heights[2]) / 3,
    );
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      error = Math.max(
        error,
        Math.abs(
          elevation([
            (points[i][0] + points[j][0]) / 2,
            (points[i][1] + points[j][1]) / 2,
          ]) -
            (heights[i] + heights[j]) / 2,
        ),
      );
    }
    if ((longest > 3 || error > 0.025) && depth < 20) {
      const i = lengths.indexOf(longest),
        p = [a, bb, c][i],
        q = [a, bb, c][(i + 1) % 3],
        r = [a, bb, c][(i + 2) % 3],
        mid: P = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      subdivide(p, mid, r, depth + 1);
      subdivide(mid, q, r, depth + 1);
      return;
    }
    const pts =
      (bb[0] - a[0]) * (c[1] - a[1]) - (bb[1] - a[1]) * (c[0] - a[0]) > 0
        ? [a, c, bb]
        : [a, bb, c];
    for (const [x, z] of pts) {
      positions.push(x, robsonBaseHeight(x, z, b.pts) ?? 0.08, z);
      uvs.push(x / 4, z / 4);
    }
  };
  for (const ids of T.ShapeUtils.triangulateShape(
    outline.map((p) => new T.Vector2(...p)),
    [],
  ))
    subdivide(outline[ids[0]], outline[ids[1]], outline[ids[2]]);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  add(g, m.concrete);
  add(robsonLowerStairGeometry(), concrete);
  const planted = new T.MeshStandardMaterial({
    name: "Robson Square — evergreen planting",
    color: 0x405647,
    roughness: 1,
  });
  const leaves = new T.MeshStandardMaterial({
    name: "Robson Square — shrub foliage",
    map: m.texture("broadleaf-branch.png", true),
    color: 0xa5b9a0,
    alphaTest: 0.42,
    side: T.DoubleSide,
    roughness: 1,
  });
  for (const p of ROBSON_PLANTERS) {
    const [x, z] = gridXZ(p.u, p.v),
      floor = robsonHeight(x, z, b.pts) ?? 0;
    box(p.u, (floor + 0.84) / 2, p.v, p.w, floor + 0.84, p.d);
    box(p.u, floor + 0.92, p.v, p.w - 0.7, 0.23, p.d - 0.7, planted);
    for (let u = p.u - p.w / 2 + 1; u < p.u + p.w / 2 - 0.5; u += 1.1)
      for (let v = p.v - p.d / 2 + 0.8; v < p.v + p.d / 2 - 0.3; v += 1.15)
        for (let side = 0; side < 3; side++) {
          const size = 1.1 + 0.35 * Math.sin(u * 17 + v * 13),
            shrub = new T.PlaneGeometry(size, size * 1.25),
            [x, z] = gridXZ(u, v);
          shrub.rotateY((side * Math.PI) / 3 + u);
          shrub.translate(x, floor + 1.3, z);
          add(shrub, leaves);
        }
  }
  const p = ROBSON_POOL,
    [x, z] = gridXZ(p.u, p.v),
    floor = robsonHeight(x, z, b.pts) ?? 0;
  box(p.u, (floor + 0.3) / 2, p.v, p.w, floor + 0.3, p.d);
  const water = new T.MeshPhysicalMaterial({
    name: "Robson Square — reflecting pool",
    color: 0x315b55,
    roughness: 0.16,
    metalness: 0.22,
    clearcoat: 0.8,
  });
  box(p.u, floor + 0.32, p.v, p.w - 0.6, 0.08, p.d - 0.6, water);
  for (const side of [-1, 1])
    box(p.u, floor + 0.4, p.v + (side * p.d) / 2, p.w, 0.5, 0.35);
  // Seating follows the terraces and stays outside the central walking route.
  const timber = new T.MeshStandardMaterial({
    color: 0x776858,
    roughness: 0.95,
  });
  for (const u of [-254, -228, -196])
    for (const v of [-25, 1]) {
      const [x, z] = gridXZ(u, v),
        h = robsonHeight(x, z, b.pts) ?? 0;
      box(u, h + 0.24, v, 3.1, 0.48, 0.6);
      box(u, h + 0.52, v, 3.2, 0.09, 0.72, timber);
    }
  return true;
}
