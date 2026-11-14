import * as T from "three";
import { Building, centroid } from "./data";
import { Batcher, flatPolygon, walls } from "./geometry";
import type { Materials } from "./materials";

export const LAW_COURTS_ID = "w137903324";
type V3 = [number, number, number];
const world = (u: number, y: number, v: number): V3 => [
  (u + v) / Math.SQRT2,
  y,
  (v - u) / Math.SQRT2,
];

/** Original massing and space frame, guided by Erickson's published photographs. */
export function lawCourts(b: Building, batch: Batcher, m: Materials) {
  if (b.id !== LAW_COURTS_ID) return false;
  const [cx, cz] = centroid(b.pts);
  const concrete = new T.MeshStandardMaterial({
    name: "Law Courts — cast concrete",
    color: 0xc5bfae,
    map: m.texture("cast-concrete/color.jpg", true),
    normalMap: m.texture("cast-concrete/normal.jpg"),
    roughnessMap: m.texture("cast-concrete/roughness.jpg"),
    normalScale: new T.Vector2(0.23, 0.23),
    roughness: 0.96,
    side: T.DoubleSide,
  });
  const frame = new T.MeshStandardMaterial({
    name: "Law Courts — pale steel space frame",
    color: 0xaebfb9,
    roughness: 0.42,
    metalness: 0.55,
  });
  const glass = new T.MeshPhysicalMaterial({
    name: "Law Courts — sloping glass canopy",
    color: 0x8ea8a2,
    roughness: 0.13,
    metalness: 0.12,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: T.DoubleSide,
    envMapIntensity: 0.75,
  });
  const windows = new T.MeshPhysicalMaterial({
    name: "Law Courts — recessed glazing",
    color: 0x30484a,
    roughness: 0.22,
    metalness: 0.22,
    clearcoat: 0.45,
  });
  glass.userData.castShadow = false;
  const green = new T.MeshStandardMaterial({ color: 0x435246, roughness: 1 });
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, cx, cz);
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
    g.translate(...world(u, y, v));
    if (mat === concrete) {
      const p = g.getAttribute("position"),
        uv = g.getAttribute("uv"),
        n = g.getAttribute("normal");
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)),
          ny = Math.abs(n.getY(i));
        uv.setXY(
          i,
          (ny > 0.5 ? p.getX(i) : nx > 0.5 ? p.getZ(i) : p.getX(i)) / 2,
          p.getY(i) / 2,
        );
      }
    }
    add(g, mat);
  };
  const beam = (a: V3, b: V3, r = 0.075, mat: T.Material = frame) => {
    const p = new T.Vector3(...world(...a)),
      q = new T.Vector3(...world(...b)),
      d = q.clone().sub(p);
    const g = new T.CylinderGeometry(r, r, d.length(), 6);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    g.translate(...p.add(q).multiplyScalar(0.5).toArray());
    add(g, mat);
  };
  const quad = (a: V3, b: V3, c: V3, d: V3, mat: T.Material) => {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [a, b, c, d].flatMap((p) => world(...p)),
        3,
      ),
    );
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    add(g, mat);
  };
  // Low plinth follows the original footprint; glazing sits behind projecting slabs.
  add(walls(b.pts, 0.65), concrete);
  add(flatPolygon(b.pts, [], 0.65, 2), concrete);
  for (let floor = 0; floor < 5; floor++) {
    const y = 0.7 + floor * 4.4,
      front = -339 - floor * 2.2,
      back = -425,
      width = front - back,
      top = y + 4.4,
      minV = Math.max(-39, -40 + ((top - 19) / 15.6) * 21 + 1.5),
      maxV = Math.min(21, 22 - ((top - 10.8) / 23.8) * 29 - 1.5),
      middleV = (minV + maxV) / 2,
      depth = maxV - minV;
    box((front + back) / 2, y, middleV, width, 0.7, depth + 1);
    box(
      (front + back) / 2,
      y + 2.2,
      middleV,
      width - 2.8,
      3.7,
      depth - 5,
      windows,
    );
    // Recessed bands, square columns and deep horizontal concrete spandrels.
    for (const v of [minV, maxV]) {
      box((front + back) / 2, y + 1.1, v, width, 1.6, 0.75);
      for (let u = back + 3; u < front - 2; u += 9)
        box(u, y + 2.2, v, 1.15, 4.3, 1.3);
    }
    for (const u of [back, front])
      box(u, y + 1.2, middleV, 0.8, 1.7, depth + 1);
  }
  // Courtroom volumes extend towards the public garden, separated by terraces.
  for (const [u, y, v, w, h, d] of [
    [-376, 24, -16, 52, 6.8, 24],
    [-365, 30, -13, 27, 5.4, 10],
    [-335, 15, -14, 22, 7.2, 29],
    [-325, 10.2, -14, 18, 5.5, 30],
  ]) {
    box(u, y, v, w, h, d);
    box(u + w / 2 + 0.025, y - 0.5, v, 0.06, h * 0.48, d - 4, windows);
    box(u, y + h / 2 + 0.16, v, w + 0.7, 0.3, d + 0.7);
  }
  // Open terraces and long rectangular reflecting water, seen from Robson Square.
  box(-322, 4.1, -13, 32, 1.2, 38);
  const water = new T.MeshPhysicalMaterial({
    name: "Law Courts — terrace basin",
    color: 0x284b48,
    roughness: 0.16,
    metalness: 0.18,
    clearcoat: 0.8,
  });
  box(-321, 4.8, -13, 26, 0.18, 16, water);
  for (const v of [-22, -4]) box(-321, 4.95, v, 28, 0.7, 1.2);
  for (const v of [-30, 5]) {
    box(-321, 4.9, v, 30, 0.8, 3);
    box(-321, 5.35, v, 29, 0.18, 2.4, green);
  }

  // Three slopes make the asymmetric broad glass roof and short flat crown.
  // The 81 m span and all intermediate heights are estimates from the photographs.
  const profile: [number, number][] = [
    [-40, 19],
    [-19, 34.6],
    [-7, 34.6],
    [22, 10.8],
  ];
  const back = -424,
    front = -343,
    along = 27;
  for (let f = 0; f < profile.length - 1; f++) {
    const [v0, y0] = profile[f],
      [v1, y1] = profile[f + 1],
      across = Math.max(4, Math.ceil(Math.hypot(v1 - v0, y1 - y0) / 2.2));
    const point = (i: number, j: number, drop = 0): V3 => [
      back + ((front - back) * i) / along,
      y0 + ((y1 - y0) * j) / across - drop,
      v0 + ((v1 - v0) * j) / across,
    ];
    for (let i = 0; i < along; i++)
      for (let j = 0; j < across; j++)
        quad(
          point(i, j),
          point(i + 1, j),
          point(i + 1, j + 1),
          point(i, j + 1),
          glass,
        );
    for (let i = 0; i <= along; i++) beam(point(i, 0), point(i, across), 0.045);
    for (let j = 0; j <= across; j++) beam(point(0, j), point(along, j), 0.045);
    // A two-layer triangulated space frame stays visible through the panes.
    for (let i = 0; i <= along; i += 3) {
      beam(point(i, 0, 1.25), point(i, across, 1.25), 0.065);
      for (let j = 0; j < across; j++) {
        beam(point(i, j), point(i, j + 1, 1.25), 0.045);
        beam(point(i, j, 1.25), point(i, j + 1), 0.045);
      }
    }
    for (const i of [0, along]) {
      beam(point(i, 0), point(i, across), 0.14);
      beam(point(i, 0, 1.25), point(i, across, 1.25), 0.12);
    }
  }
  // The low Hornby edge is a glazed public-gallery wall beneath the canopy.
  quad(
    [back, 1, 22],
    [front, 1, 22],
    [front, 10.8, 22],
    [back, 10.8, 22],
    glass,
  );
  for (let u = back; u <= front; u += 3) beam([u, 1, 22], [u, 10.8, 22], 0.07);
  for (let y = 1; y < 10.8; y += 3) beam([back, y, 22], [front, y, 22], 0.07);
  for (let u = back + 2; u < front; u += 12) box(u, 5.1, 20.3, 0.85, 9, 0.85);
  return true;
}
