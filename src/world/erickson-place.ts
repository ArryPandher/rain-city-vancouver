import * as T from "three";
import { Building, centroid } from "./data";
import { Batcher, flatPolygon, walls } from "./geometry";
import type { Materials } from "./materials";

export const ERICKSON_PLACE_ID = "w143683975";

type V3 = [number, number, number];

/** Original, reference-guided model. Dimensions between mapped edges are estimated. */
export function ericksonPlace(b: Building, batch: Batcher, m: Materials) {
  if (b.id !== ERICKSON_PLACE_ID) return false;
  const [cx, cz] = centroid(b.pts);
  const concrete = new T.MeshStandardMaterial({
    name: "Arthur Erickson Place — cast concrete",
    color: 0xc9c5b8,
    map: m.texture("cast-concrete/color.jpg", true),
    normalMap: m.texture("cast-concrete/normal.jpg"),
    normalScale: new T.Vector2(0.32, 0.32),
    roughnessMap: m.texture("cast-concrete/roughness.jpg"),
    roughness: 0.96,
    side: T.DoubleSide,
  });
  const glass = [0x283b3c, 0x37494a, 0x263638, 0x414c46].map(
    (color) =>
      new T.MeshPhysicalMaterial({
        name: "Arthur Erickson Place — recessed glazing",
        color,
        metalness: 0.25,
        roughness: 0.28,
        clearcoat: 0.25,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.5,
        side: T.DoubleSide,
      }),
  );
  const seal = new T.MeshStandardMaterial({ color: 0x29302e, roughness: 0.85 });
  const model = new Map<
    T.Material,
    { p: number[]; uv: number[]; ix: number[] }
  >();
  function quad(mat: T.Material, a: V3, b: V3, c: V3, d: V3) {
    let buffers = model.get(mat);
    if (!buffers) model.set(mat, (buffers = { p: [], uv: [], ix: [] }));
    const n = buffers.p.length / 3;
    const u = new T.Vector3(...b).sub(new T.Vector3(...a)).normalize();
    const v = new T.Vector3(...d).sub(new T.Vector3(...a)).normalize();
    for (const point of [a, b, c, d]) {
      buffers.p.push(...point);
      const p = new T.Vector3(...point);
      buffers.uv.push(p.dot(u) / 1.805, p.dot(v) / 1.805);
    }
    buffers.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }

  // Map axes follow the 45-degree downtown street grid. The original OSM
  // outline includes the lower western annex; the office masses sit to its east.
  const world = (u: number, y: number, v: number): V3 => [
    (u + v) / Math.SQRT2,
    y,
    (v - u) / Math.SQRT2,
  ];
  const height = 103.6;
  const lobby = 6.4;
  const parapet = 1.8;
  const storey = (height - lobby - parapet) / 26;
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, cx, cz);

  // Long faces have square, mullion-free windows. End faces have broad piers
  // separated by narrow vertical glass slots, visible in the architect's photos.
  for (const tower of [
    { u: 120, v: -341.2, w: 36.2, d: 21.8 },
    { u: 143, v: -346, w: 36.2, d: 21.8 },
  ]) {
    for (let face = 0; face < 4; face++) {
      const long = face % 2 === 0;
      const span = long ? tower.w : tower.d;
      const depth = long ? tower.d : tower.w;
      const cols = long ? 12 : 3;
      const pitch = span / cols;
      const sign = face < 2 ? 1 : -1;
      const point = (along: number, y: number, recess = 0): V3 => {
        // Walls taper from roughly 8 feet at the base to 8 inches at the roof.
        // The jambs remain true geometry, so their depth reads while walking.
        const inward = (2.4384 - 0.2032) * (y / height);
        const a = along * (1 - (2 * inward) / span);
        const f = sign * (depth / 2 - inward - recess);
        return long
          ? world(tower.u + f, y, tower.v + a)
          : world(tower.u + a, y, tower.v + f);
      };
      const panel = (x0: number, y0: number, x1: number, y1: number) =>
        quad(
          concrete,
          point(x0, y0),
          point(x1, y0),
          point(x1, y1),
          point(x0, y1),
        );
      for (let row = 0; row < 27; row++) {
        const bottom = row === 0 ? 0.75 : lobby + (row - 1) * storey;
        const top = row === 0 ? lobby : lobby + row * storey;
        for (let col = 0; col < cols; col++) {
          const x0 = -span / 2 + col * pitch;
          const x1 = x0 + pitch;
          const mid = (x0 + x1) / 2;
          const windowWidth = long ? 2.13 : 1.32;
          const left = mid - windowWidth / 2;
          const right = mid + windowWidth / 2;
          const low = row === 0 ? 1.05 : bottom + 0.62;
          const high = row === 0 ? top - 0.6 : long ? low + 2.13 : top - 0.12;
          panel(x0, bottom, left, top);
          panel(right, bottom, x1, top);
          panel(left, bottom, right, low);
          panel(left, high, right, top);
          const lowDepth = 2.4384 - (2.4384 - 0.2032) * (low / height);
          const highDepth = 2.4384 - (2.4384 - 0.2032) * (high / height);
          const a = point(left, low),
            b = point(right, low);
          const c = point(right, high),
            d = point(left, high);
          const aa = point(left, low, lowDepth),
            bb = point(right, low, lowDepth);
          const cc = point(right, high, highDepth),
            dd = point(left, high, highDepth);
          quad(concrete, a, aa, dd, d);
          quad(concrete, bb, b, c, cc);
          quad(concrete, aa, a, b, bb);
          quad(concrete, d, dd, cc, c);
          quad(
            glass[(row * 17 + col * 3 + face) % glass.length],
            aa,
            bb,
            cc,
            dd,
          );
          // A small seal at each sill, without adding mullions across the pane.
          quad(
            seal,
            aa,
            bb,
            point(right, low + 0.035, lowDepth),
            point(left, low + 0.035, lowDepth),
          );
        }
      }
      panel(-span / 2, height - parapet, span / 2, height);
    }
    const roofInset = 2.24;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].flatMap(([u, v]) => {
      const p = world(
        tower.u + u * (tower.d / 2 - roofInset),
        height,
        tower.v + v * (tower.w / 2 - roofInset),
      );
      return [p[0], p[2]];
    });
    add(flatPolygon(corners, [], height, 3), m.roof);
  }

  // Keep the mapped ground footprint visibly occupied, matching collision.
  add(walls(b.pts, 0.8), concrete);
  add(flatPolygon(b.pts, [], 0.8, 1.805), concrete);
  const box = (
    u: number,
    y: number,
    v: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
  ) => {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(Math.PI / 4);
    g.translate(...world(u, y, v));
    add(g, mat);
  };
  // The central service spine joins the offset masses. A shallow reflecting
  // basin and footbridges give the lower mapped western wing its plaza scale.
  box(131.5, 50, -343, 1.2, 100, 16, concrete);
  const water = new T.MeshPhysicalMaterial({
    color: 0x254b4b,
    roughness: 0.12,
    metalness: 0.35,
    clearcoat: 0.8,
    envMapIntensity: 0.65,
  });
  box(94, 0.825, -326.5, 8.7, 0.025, 40, water);
  for (const u of [89.5, 98.5]) box(u, 0.98, -326.5, 0.3, 0.36, 40.6, concrete);
  for (const v of [-346.8, -306.2]) box(94, 0.98, v, 9.3, 0.36, 0.3, concrete);
  for (const v of [-338.8, -325.4, -311.9])
    box(94, 1.12, v, 9.4, 0.24, 1.8, concrete);
  for (const [mat, buffers] of model) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(buffers.p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(buffers.uv, 2));
    g.setIndex(buffers.ix);
    g.computeVertexNormals();
    add(g, mat);
  }
  return true;
}
