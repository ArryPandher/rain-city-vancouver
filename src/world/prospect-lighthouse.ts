import * as T from "three";
import { type Building, centroid } from "./data";
import { Batcher, walls, flatPolygon } from "./geometry";
import { type Materials } from "./materials";

export const PROSPECT_LIGHT_ID = "w1001586109";
export function prospectLightFrame(b: Building) {
  const [x, z] = centroid(b.pts),
    dx = b.pts[2] - b.pts[0],
    dz = b.pts[3] - b.pts[1],
    length = Math.hypot(dx, dz);
  return new T.Matrix4()
    .makeBasis(
      new T.Vector3(dx / length, 0, dz / length),
      new T.Vector3(0, 1, 0),
      new T.Vector3(-dz / length, 0, dx / length),
    )
    .setPosition(x, 0, z);
}
function taperedSegment(
  y0: number,
  y1: number,
  w0: number,
  d0: number,
  w1: number,
  d1: number,
  base?: number[][],
) {
  const corners = (w: number, d: number, y: number) => [
      [-w / 2, y, d / 2],
      [w / 2, y, d / 2],
      [w / 2, y, -d / 2],
      [-w / 2, y, -d / 2],
    ],
    lower = base ?? corners(w0, d0, y0),
    upper = corners(w1, d1, y1),
    pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      offset = pos.length / 3,
      width = i % 2 ? d0 : w0;
    pos.push(...lower[i], ...lower[j], ...upper[j], ...upper[i]);
    uv.push(0, y0 / 2, width / 2, y0 / 2, width / 2, y1 / 2, 0, y1 / 2);
    idx.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Original interpretation of the 1948 tower, anchored to its mapped footprint. */
export function prospectLighthouse(b: Building, batch: Batcher, m: Materials) {
  if (b.id !== PROSPECT_LIGHT_ID) return false;
  const [x, z] = centroid(b.pts),
    frame = prospectLightFrame(b),
    inverse = frame.clone().invert(),
    footprint = Array.from({ length: b.pts.length / 2 }, (_, i) =>
      new T.Vector3(b.pts[i * 2], 2.7, b.pts[i * 2 + 1])
        .applyMatrix4(inverse)
        .toArray(),
    ),
    frontZ = footprint[0][2],
    front = (depth: number) => frontZ + depth - 2.525;
  const white = new T.MeshStandardMaterial({
    name: "Prospect lighthouse — weathered white concrete",
    color: 0xdde0d9,
    roughness: 0.91,
    map: m.texture("theatres/plaster-color.webp", true),
    normalMap: m.texture("theatres/plaster-normal.webp"),
    normalScale: new T.Vector2(0.2, 0.2),
  });
  const red = white.clone();
  red.name = "Prospect lighthouse — red band";
  red.color.set(0x9b2723);
  const metal = new T.MeshStandardMaterial({
    name: "Prospect lighthouse — galvanized ladder and rails",
    color: 0x9badae,
    metalness: 0.65,
    roughness: 0.55,
  });
  const dark = new T.MeshStandardMaterial({
    name: "Prospect lighthouse — door seams",
    color: 0x394644,
    roughness: 0.9,
  });
  const add = (g: T.BufferGeometry, mat: T.Material, local = true) =>
    batch.add(local ? g.applyMatrix4(frame) : g, mat, x, z);
  const box = (
    px: number,
    py: number,
    pz: number,
    w: number,
    h: number,
    d: number,
    mat = white,
  ) => add(new T.BoxGeometry(w, h, d).translate(px, py, pz), mat);
  const tube = (a: number[], b: number[], radius = 0.025, mat = metal) => {
    const start = new T.Vector3(...(a as [number, number, number])),
      end = new T.Vector3(...(b as [number, number, number])),
      delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius, radius, delta.length(), 8);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...start.add(end).multiplyScalar(0.5).toArray());
    add(g, mat);
  };
  const base = walls(b.pts, 2.7),
    baseUV = base.getAttribute("uv");
  for (let i = 0; i < baseUV.count; i++)
    baseUV.setXY(i, baseUV.getX(i) * 12, baseUV.getY(i) * 25.6);
  // This mapped footprint is clockwise in XZ; walls() expects the opposite.
  // Keep the exterior faces visible instead of looking through to the far wall.
  const winding = footprint.reduce((area, p, i) => {
    const q = footprint[(i + 1) % footprint.length];
    return area + p[0] * q[2] - q[0] * p[2];
  }, 0);
  if (winding < 0) {
    const indices = base.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i);
      indices.setX(i, indices.getX(i + 2));
      indices.setX(i + 2, a);
    }
    base.computeVertexNormals();
  }
  add(base, white, false);
  add(flatPolygon(b.pts, [], 2.7, 2), white, false);
  const lanternY = Math.max(8.6, 11.5 - batch.offsetY),
    deckY = lanternY - 0.8;
  const rings = [
    [2.7, 4.45, 5.05],
    [2.95, 3.65, 4.05],
    [3.4, 2.95, 3.3],
    [4.4, 2.65, 2.95],
    [5.65, 2.3, 2.55],
    [deckY, 1.4, 1.6],
  ];
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      c = rings[i];
    add(
      taperedSegment(
        a[0],
        c[0],
        a[1],
        a[2],
        c[1],
        c[2],
        i === 1 ? footprint : undefined,
      ),
      i === 4 ? red : white,
    );
  }
  box(0, deckY + 0.08, 0, 3.05, 0.16, 3.05);
  box(0, deckY + 0.19, 0, 2.8, 0.08, 2.8, dark);
  // Closed workroom door, shallow framing panels, triangular lintel and hardware.
  box(0, 1.26, front(2.55), 1.31, 2.36, 0.04, dark);
  box(0, 1.26, front(2.58), 1.22, 2.28, 0.055);
  box(0, 1.3, front(2.618), 0.017, 2.18, 0.015, dark);
  for (const sx of [-1, 1]) {
    box(sx * 0.66, 1.27, front(2.6), 0.07, 2.46, 0.12);
    box(sx * 1.57, 0.35, front(2.57), 0.82, 0.055, 0.035);
    for (const px of [1.1, 2.03])
      box(sx * px, 1.32, front(2.57), 0.055, 1.94, 0.035);
    box(sx * 1.57, 2.29, front(2.57), 0.94, 0.055, 0.035);
    for (const py of [0.52, 1.84])
      box(sx * 0.57, py, front(2.625), 0.065, 0.16, 0.025, metal);
  }
  const pediment = new T.Shape();
  pediment.moveTo(-0.87, 2.47);
  pediment.lineTo(0.87, 2.47);
  pediment.lineTo(0, 2.85);
  pediment.closePath();
  add(
    new T.ExtrudeGeometry(pediment, {
      depth: 0.18,
      bevelEnabled: false,
    }).translate(0, 0, front(2.5)),
    white,
  );
  box(0.08, 1.05, front(2.66), 0.18, 0.25, 0.07, metal);
  const backZ = (footprint[2][2] + footprint[3][2]) / 2;
  const backPanel = new T.MeshStandardMaterial({
    color: 0xb4beb9,
    roughness: 0.92,
  });
  const oculus = new T.TorusGeometry(0.32, 0.055, 8, 24);
  oculus.translate(0, 1.75, backZ - 0.035);
  add(oculus, white);
  add(
    new T.CircleGeometry(0.27, 24)
      .rotateY(Math.PI)
      .translate(0, 1.75, backZ - 0.013),
    backPanel,
  );
  for (const sx of [-1, 1])
    box(sx * 1.75, 1.35, backZ - 0.02, 0.045, 2.12, 0.04);
  box(0, 2.42, backZ - 0.02, 3.52, 0.055, 0.04);
  // An external ladder follows the taper, with a lower guard and safety hoops.
  const ladderZ = (y: number) => 2.45 - (y - 2.7) * 0.21;
  for (const sx of [-0.31, 0.31])
    tube(
      [sx, 2.8, ladderZ(2.8)],
      [sx, deckY + 1.08, ladderZ(deckY + 1.08)],
      0.025,
    );
  for (let y = 2.9; y < deckY + 1; y += 0.29)
    tube([-0.31, y, ladderZ(y)], [0.31, y, ladderZ(y)], 0.022);
  for (const y of [4.0, 5.35, 6.7, 8.05]) {
    const g = new T.TorusGeometry(0.46, 0.022, 6, 18, Math.PI * 1.2);
    g.rotateX(Math.PI / 2);
    g.rotateY(Math.PI * 0.1);
    g.translate(0, y, ladderZ(y) + 0.17);
    add(g, metal);
  }
  for (const sx of [-0.5, 0.5]) {
    tube([sx, 2.8, 2.74], [sx, 3.8, 2.74]);
    tube([sx, 3.8, 2.74], [sx, 3.8, 2.2]);
  }
  tube([-0.5, 2.8, 2.74], [0.5, 2.8, 2.74]);
  for (const side of [-1, 1])
    for (const h of [0.58, 1.08]) {
      tube([side * 1.33, deckY + h, -1.33], [side * 1.33, deckY + h, 1.33]);
      tube([-1.33, deckY + h, side * 1.33], [1.33, deckY + h, side * 1.33]);
    }
  for (const sx of [-1.33, 1.33])
    for (const sz of [-1.33, 1.33])
      tube([sx, deckY + 0.15, sz], [sx, deckY + 1.12, sz], 0.035);
  for (const sx of [-1.17, 1.17]) {
    tube([sx, deckY, -0.9], [sx, deckY + 3.25, -0.9], 0.025);
    box(sx, deckY + 0.58, -0.92, 0.16, 0.3, 0.12, dark);
  }
  add(
    new T.CylinderGeometry(0.17, 0.24, 0.45, 16).translate(
      0,
      lanternY - 0.24,
      0,
    ),
    metal,
  );
  const lens = new T.MeshStandardMaterial({
    name: "Prospect Point red beacon",
    color: 0xac1713,
    emissive: 0xff2411,
    emissiveIntensity: 1,
    roughness: 0.3,
  });
  add(
    new T.SphereGeometry(0.15, 16, 10)
      .scale(1, 0.65, 1)
      .translate(0, lanternY, 0),
    lens,
  );
  const light = new T.PointLight(0xff311b, 0, 14, 2);
  light.position.set(0, lanternY, 0).applyMatrix4(frame);
  light.position.y += batch.offsetY;
  light.name = "Prospect Point beacon";
  batch.parent.add(light);
  m.beacons.push({ material: lens, light, period: 2 });
  // Two small horizontal signal horns on the seaward side.
  for (const y of [4.0, 6.35]) {
    const horn = new T.CylinderGeometry(0.13, 0.04, 0.33, 12, 1, true);
    horn.rotateZ(-Math.PI / 2);
    horn.translate(1.47, y, 0);
    add(horn, metal);
    tube([1.1, y, 0], [1.45, y, 0], 0.035);
  }
  return true;
}
