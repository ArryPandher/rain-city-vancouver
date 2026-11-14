import * as T from "three";
import { Batcher, flatPolygon, walls } from "./geometry";
import type { Point } from "./data";
export type Vertex3 = [number, number, number];

/** Metric facade geometry, accumulated once per material for static batching. */
export class ArchitecturalMesh {
  private groups = new Map<
    T.Material,
    { p: number[]; uv: number[]; ix: number[] }
  >();
  constructor(
    private batch: Batcher,
    private x: number,
    private z: number,
  ) {}
  add(g: T.BufferGeometry, m: T.Material) {
    this.batch.add(g, m, this.x, this.z);
  }
  quad(
    m: T.Material,
    a: Vertex3,
    b: Vertex3,
    c: Vertex3,
    d: Vertex3,
    uv?: number[],
  ) {
    let q = this.groups.get(m);
    if (!q) this.groups.set(m, (q = { p: [], uv: [], ix: [] }));
    const n = q.p.length / 3;
    q.p.push(...a, ...b, ...c, ...d);
    q.uv.push(...(uv ?? [0, 0, 0, 1, 1, 1, 1, 0]));
    q.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  box(p: Vertex3, w: number, h: number, d: number, m: T.Material, angle = 0) {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(angle);
    g.translate(...p);
    this.add(g, m);
  }
  beam(a: Vertex3, b: Vertex3, r: number, m: T.Material, sides = 8) {
    const p = new T.Vector3(...a),
      q = new T.Vector3(...b),
      v = q.clone().sub(p);
    if (v.length() < 0.001) return;
    const g = new T.CylinderGeometry(r, r, v.length(), sides);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    g.translate(...p.add(q).multiplyScalar(0.5).toArray());
    this.add(g, m);
  }
  cap(poly: Point[][], y: number, m: T.Material) {
    this.add(
      flatPolygon(
        poly[0].flat(),
        poly.slice(1).map((p) => p.flat()),
        y,
        2,
      ),
      m,
    );
  }
  skin(poly: Point[][], low: number, high: number, m: T.Material) {
    for (const ring of poly) {
      const g = walls(ring.slice(0, -1).flat(), high - low);
      g.translate(0, low, 0);
      this.add(g, m);
    }
  }
  finish() {
    for (const [m, q] of this.groups) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(q.uv, 2));
      g.setIndex(q.ix);
      g.computeVertexNormals();
      this.add(g, m);
    }
    this.groups.clear();
  }
}
/** Ring must be counterclockwise in map x/z coordinates. Positive depth goes inside. */
export function facadeFrame(a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const p = (along: number, y: number, depth = 0): Vertex3 => [
    a[0] + (dx * along - dz * depth) / length,
    y,
    a[1] + (dz * along + dx * depth) / length,
  ];
  return { length, p, outward: [dz / length, -dx / length] as Point };
}
