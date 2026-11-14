import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { vecs } from "./data";
export function normalizeGeometry(g: T.BufferGeometry) {
  for (const k of Object.keys(g.attributes))
    if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  const n = g.getAttribute("position").count;
  if (!g.getIndex()) g.setIndex(Array.from({ length: n }, (_, i) => i));
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.getAttribute("uv"))
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(new Float32Array(n * 2), 2),
    );
  return g;
}
export function flatPolygon(
  p: number[],
  holes: number[][] = [],
  y = 0,
  scale = 5,
) {
  const s = new T.Shape(vecs(p));
  for (const h of holes) s.holes.push(new T.Path(vecs(h)));
  const g = new T.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const pos = g.getAttribute("position"),
    uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++)
    uv.setXY(i, pos.getX(i) / scale, pos.getZ(i) / scale);
  return g;
}
export function ribbon(
  points: number[],
  width: number,
  y = 0,
  height?: (x: number, z: number) => number,
  texScale = 5,
): T.BufferGeometry {
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  let traveled = 0;
  let prev = [0, 0];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i],
      z = points[i + 1],
      j = Math.min(points.length - 2, i + 2),
      k = Math.max(0, i - 2);
    const dx = points[j] - points[k],
      dz = points[j + 1] - points[k + 1],
      l = Math.hypot(dx, dz) || 1;
    const nx = ((dz / l) * width) / 2,
      nz = ((-dx / l) * width) / 2;
    if (i) traveled += Math.hypot(x - prev[0], z - prev[1]);
    prev = [x, z];
    const h = (height?.(x, z) ?? 0) + y;
    pos.push(x + nx, h, z + nz, x - nx, h, z - nz);
    uv.push(0, traveled / texScale, width / texScale, traveled / texScale);
    if (i) {
      const a = i - 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function walls(p: number[], height: number) {
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    let x = p[i],
      z = p[i + 1],
      xx = p[j],
      zz = p[j + 1],
      n = pos.length / 3,
      l = Math.hypot(xx - x, zz - z);
    pos.push(x, 0, z, xx, 0, zz, x, height, z, xx, height, zz);
    uv.push(0, 0, l / 24, 0, 0, height / 51.2, l / 24, height / 51.2);
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export class Batcher {
  groups = new Map<
    string,
    { geo: T.BufferGeometry[]; mat: T.Material; x: number; z: number }
  >();
  constructor(
    public parent: T.Object3D,
    public size = 420,
  ) {}
  add(g: T.BufferGeometry, mat: T.Material, x: number, z: number, key = "") {
    if (!g.getIndex())
      g.setIndex(
        Array.from({ length: g.getAttribute("position").count }, (_, i) => i),
      );
    const cx = Math.floor(x / this.size),
      cz = Math.floor(z / this.size),
      k = `${cx},${cz},${mat.uuid},${key}`;
    let b = this.groups.get(k);
    if (!b)
      this.groups.set(
        k,
        (b = {
          geo: [],
          mat,
          x: cx * this.size + this.size / 2,
          z: cz * this.size + this.size / 2,
        }),
      );
    b.geo.push(g);
  }
  finish(shadow = true) {
    const chunks: T.Mesh[] = [];
    for (const b of this.groups.values()) {
      const g = mergeGeometries(b.geo, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new T.Mesh(g, b.mat);
      m.userData.allowShadow = shadow;
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.userData.center = [b.x, b.z];
      this.parent.add(m);
      chunks.push(m);
      b.geo.forEach((g) => g.dispose());
    }
    this.groups.clear();
    return chunks;
  }
}
