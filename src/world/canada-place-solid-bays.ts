import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import data from "./canada-place-concourse-data.json";
export const CANADA_PLACE_ROUND_OPENING = {
  radius: 1.7,
  centerY: 14.3,
  depth: 0.28,
};
/** Recessed opaque service/structural bays identified in independent west views.
 * Interval edges, recess and opening sizes are explicitly photographic estimates. */
export function addCanadaPlaceSolidBays(
  root: T.Object3D,
  wall: T.MeshStandardMaterial,
  point: (s: number, out: number, y: number) => T.Vector3,
) {
  const bodies: T.BufferGeometry[] = [],
    details: T.BufferGeometry[] = [];
  const quad = (p: T.Vector3[], n: T.Vector3, target: T.BufferGeometry[]) => {
    if (p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(n) < 0)
      p = [p[0], p[3], p[2], p[1]];
    const g = new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute(
        p.flatMap((v) => v.toArray()),
        3,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2),
    );
    target.push(g);
  };
  for (const [a, b] of data.solidBays) {
    const mid = (a + b) / 2,
      out = data.solidBayOutward,
      { radius: r, centerY: y, depth } = CANADA_PLACE_ROUND_OPENING;
    const n = point(mid, out + 0.1, y)
      .sub(point(mid, out, y))
      .normalize();
    const shape = new T.Shape();
    shape.moveTo(a, 7.8);
    shape.lineTo(b, 7.8);
    shape.lineTo(b, 17.65);
    shape.lineTo(a, 17.65);
    shape.closePath();
    const hole = new T.Path();
    hole.absarc(mid, y, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const flat = new T.ShapeGeometry(shape, 24),
      flatP = flat.getAttribute("position"),
      flatI = flat.index!,
      local: number[] = [],
      uv: number[] = [];
    const stationCuts = [
      a,
      ...data.stations.map((s) => s.s).filter((s) => s > a && s < b),
      b,
    ];
    const clip = (poly: T.Vector2[], x: number, side: number) => {
      const result: T.Vector2[] = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i],
          q = poly[(i + 1) % poly.length],
          inside = (p.x - x) * side >= -1e-9,
          next = (q.x - x) * side >= -1e-9;
        if (inside) result.push(p);
        if (inside !== next) {
          const t = (x - p.x) / (q.x - p.x);
          result.push(p.clone().lerp(q, t));
        }
      }
      return result;
    };
    // Split source-plane triangles at registered station bends before mapping:
    // the rendered ground edge now exactly follows the collision perimeter.
    for (let i = 0; i < flatI.count; i += 3) {
      const tri = [0, 1, 2].map(
        (k) =>
          new T.Vector2(
            flatP.getX(flatI.getX(i + k)),
            flatP.getY(flatI.getX(i + k)),
          ),
      );
      for (let j = 1; j < stationCuts.length; j++) {
        const poly = clip(clip(tri, stationCuts[j - 1], 1), stationCuts[j], -1);
        for (let k = 1; k < poly.length - 1; k++)
          for (const p of [poly[0], poly[k], poly[k + 1]]) {
            local.push(p.x, p.y, 0);
            uv.push(p.x, p.y);
          }
      }
    }
    flat.dispose();
    const g = new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute(local, 3),
    );
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(Array.from({ length: local.length / 3 }, (_, i) => i));
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const q = point(p.getX(i), out, p.getY(i));
      p.setXYZ(i, q.x, q.y, q.z);
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const v = [0, 1, 2].map((k) =>
        new T.Vector3().fromBufferAttribute(p, ix.getX(i + k)),
      );
      if (v[1].sub(v[0]).cross(v[2].sub(v[0])).dot(n) < 0) {
        const q = ix.getX(i + 1);
        ix.setX(i + 1, ix.getX(i + 2));
        ix.setX(i + 2, q);
      }
    }
    g.computeVertexNormals();
    bodies.push(g);
    // Circular masonry reveal and opaque recessed infill: no opening into void.
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const t = (i * Math.PI * 2) / steps,
        u = ((i + 1) * Math.PI * 2) / steps,
        s1 = mid + r * Math.cos(t),
        s2 = mid + r * Math.cos(u),
        y1 = y + r * Math.sin(t),
        y2 = y + r * Math.sin(u);
      const f1 = point(s1, out, y1),
        f2 = point(s2, out, y2),
        b1 = point(s1, out - depth, y1),
        b2 = point(s2, out - depth, y2);
      quad([f1, f2, b2, b1], point(mid, out, y).sub(f1), bodies);
      quad([point(mid, out - depth, y), b1, b2, b2], n, details);
    }
    // Pale central split visible in both SACO and the official west photograph.
    quad(
      [
        point(mid - 0.045, out - 0.035, y - r),
        point(mid + 0.045, out - 0.035, y - r),
        point(mid + 0.045, out - 0.035, y + r),
        point(mid - 0.045, out - 0.035, y + r),
      ],
      n,
      bodies,
    );
    const cuts = [
      a,
      ...data.stations.map((s) => s.s).filter((s) => s > a && s < b),
      b,
    ];
    for (let i = 1; i < cuts.length; i++) {
      const l = cuts[i - 1],
        h = cuts[i];
      quad(
        [
          point(l, 0, 17.65),
          point(l, out, 17.65),
          point(h, out, 17.65),
          point(h, 0, 17.65),
        ],
        new T.Vector3(0, 1, 0),
        bodies,
      );
      quad(
        [
          point(l, 0, 7.8),
          point(h, 0, 7.8),
          point(h, 0, 17.65),
          point(l, 0, 17.65),
        ],
        n.clone().negate(),
        bodies,
      );
    }
  }
  const backing = new T.MeshStandardMaterial({
    color: 0x495551,
    roughness: 0.84,
    metalness: 0,
    name: "Canada Place round opening infill",
  });
  return [
    [bodies, wall, "canada-west-solid-bays"],
    [details, backing, "canada-west-round-infill"],
  ].map(([list, mat, name]) => {
    const geometries = list as T.BufferGeometry[],
      geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, mat as T.Material);
    mesh.name = name as string;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  });
}
