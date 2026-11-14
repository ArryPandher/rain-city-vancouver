import * as T from "three";
import { Building, centroid } from "./data";
import { Batcher, walls, flatPolygon } from "./geometry";
import { Materials, label } from "./materials";
import { shopWindow } from "./shop-interiors";

export const COMMODORE_ID = "w301876706";
/** The Granville edge, retaining its slight mapped angle rather than rounding to the city grid. */
export function commodoreFrame(b: Building) {
  let edge = 0,
    nearest = Infinity;
  for (let i = 0; i < b.pts.length; i += 2) {
    const j = (i + 2) % b.pts.length;
    const v = b.pts[i] + b.pts[i + 1] + b.pts[j] + b.pts[j + 1];
    if (v < nearest) {
      nearest = v;
      edge = i;
    }
  }
  const j = (edge + 2) % b.pts.length;
  let left = [b.pts[edge], b.pts[edge + 1]],
    right = [b.pts[j], b.pts[j + 1]];
  if (left[0] - left[1] < right[0] - right[1]) [left, right] = [right, left];
  const width = Math.hypot(right[0] - left[0], right[1] - left[1]);
  const sx = (right[0] - left[0]) / width,
    sz = (right[1] - left[1]) / width;
  const ox = -sz,
    oz = sx;
  return {
    edge,
    width,
    sx,
    sz,
    ox,
    oz,
    x: (px: number) => ((px - 180) / 1230) * width,
    y: (py: number) => ((480 - py) / 1230) * width,
    point: (s: number, y: number, depth: number): [number, number, number] => [
      left[0] + sx * s - ox * depth,
      y,
      left[1] + sz * s - oz * depth,
    ],
    matrix: (depth = 0) =>
      new T.Matrix4()
        .makeBasis(
          new T.Vector3(sx, 0, sz),
          new T.Vector3(0, 1, 0),
          new T.Vector3(ox, 0, oz),
        )
        .setPosition(left[0] - ox * depth, 0, left[1] - oz * depth),
  };
}
// Reference coordinates in the 1600 px panorama, converted to metres by the mapped frontage.
const crown = [
  [180, 150],
  [232, 150],
  [236, 141],
  [260, 132],
  [287, 134],
  [303, 143],
  [355, 143],
  [361, 158],
  [577, 158],
  [580, 130],
  [609, 120],
  [649, 124],
  [652, 76],
  [665, 76],
  [667, 112],
  [683, 112],
  [688, 80],
  [700, 80],
  [705, 111],
  [716, 111],
  [728, 80],
  [736, 73],
  [744, 84],
  [752, 112],
  [766, 112],
  [769, 89],
  [780, 89],
  [783, 119],
  [800, 119],
  [803, 77],
  [815, 77],
  [817, 130],
  [900, 141],
  [902, 155],
  [1163, 155],
  [1167, 118],
  [1224, 118],
  [1232, 104],
  [1286, 99],
  [1332, 103],
  [1338, 112],
  [1408, 112],
  [1410, 120],
];
export const COMMODORE_WINDOWS = [
  [225, 22, 212],
  [280, 48, 202],
  [330, 24, 211],
  [414, 48, 201],
  [505, 49, 197],
  [570, 22, 212],
  [610, 50, 195],
  [691, 20, 205],
  [741, 48, 197],
  [783, 18, 205],
  [832, 18, 205],
  [875, 49, 193],
  [921, 18, 203],
  [999, 54, 188],
  [1107, 54, 187],
  [1207, 31, 184],
  [1278, 66, 170],
  [1350, 32, 180],
];
function arch(center: number, bottom: number, width: number, top: number) {
  const r = width / 2,
    spring = top - r,
    p = new T.Shape();
  p.moveTo(center - r, bottom);
  p.lineTo(center + r, bottom);
  p.lineTo(center + r, spring);
  p.absarc(center, spring, r, 0, Math.PI, false);
  p.lineTo(center - r, bottom);
  return p;
}
export function commodore(
  b: Building,
  batch: Batcher,
  m: Materials,
  interiors?: Batcher,
  rooms: T.Material[] = [],
) {
  if (b.id !== COMMODORE_ID) return false;
  const f = commodoreFrame(b),
    [cx, cz] = centroid(b.pts);
  const add = (g: T.BufferGeometry, mat: T.Material) =>
    batch.add(g, mat, cx, cz);
  const put = (g: T.BufferGeometry, mat: T.Material, depth = 0) =>
    add(g.applyMatrix4(f.matrix(depth)), mat);
  const masonry = (id: string) =>
    new T.MeshStandardMaterial({
      name: `Commodore — ${id}`,
      map: m.texture(`commodore/${id}-color.webp`, true),
      normalMap: m.texture(`commodore/${id}-normal.webp`),
      roughnessMap: m.texture(`commodore/${id}-roughness.webp`),
      normalScale: new T.Vector2(0.6, 0.6),
      roughness: 0.94,
    });
  const brick = masonry("brick"),
    woven = masonry("woven-brick");
  const cream = new T.MeshStandardMaterial({
    name: "Commodore — ivory trim",
    color: 0xcecbb7,
    map: m.texture("theatres/plaster-color.webp", true),
    normalMap: m.texture("theatres/plaster-normal.webp"),
    normalScale: new T.Vector2(0.12, 0.12),
    roughness: 0.88,
  });
  const burgundy = new T.MeshStandardMaterial({
    color: 0x57282c,
    roughness: 0.57,
    metalness: 0.2,
  });
  const black = new T.MeshStandardMaterial({
    color: 0x1b2526,
    roughness: 0.62,
    metalness: 0.35,
  });
  const glass = new T.MeshPhysicalMaterial({
    name: "Commodore — recessed arched glazing",
    color: 0x25434c,
    roughness: 0.2,
    metalness: 0.3,
    clearcoat: 0.6,
    envMapIntensity: 1.15,
  });
  const tile = new T.MeshStandardMaterial({
    name: "Commodore — photographed tile frieze",
    map: m.texture("commodore/tile-frieze.webp", true),
    roughness: 0.56,
  });
  const rose = new T.MeshStandardMaterial({
    map: m.texture("commodore/rosette.webp", true),
    roughness: 0.87,
  });
  const uv = (g: T.BufferGeometry, mat: T.Material) => {
    if ([brick, woven, cream].includes(mat as T.MeshStandardMaterial)) {
      const p = g.getAttribute("position"),
        n = g.getAttribute("normal"),
        a = g.getAttribute("uv");
      for (let i = 0; i < p.count; i++)
        a.setXY(
          i,
          (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) /
            (mat === cream ? 2 : 5.2),
          (Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)) /
            (mat === cream ? 2 : 2.28),
        );
    }
    return g;
  };
  const box = (
    s: number,
    y: number,
    d: number,
    w: number,
    h: number,
    depth: number,
    mat: T.Material = cream,
  ) => {
    const g = uv(new T.BoxGeometry(w, h, depth), mat);
    g.translate(s, y, -d);
    put(g, mat);
  };
  const panel = (
    s: number,
    y: number,
    d: number,
    w: number,
    h: number,
    mat: T.Material,
  ) => {
    const g = new T.PlaneGeometry(w, h);
    g.translate(s, y, 0);
    put(g, mat, d);
  };
  const beam = (
    a: T.Vector3,
    b: T.Vector3,
    width: number,
    depth: number,
    mat: T.Material,
  ) => {
    const length = a.distanceTo(b);
    if (length < 0.001) return;
    const g = new T.BoxGeometry(width, length, depth);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      ),
    );
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
    put(g, mat);
  };
  const glow = (mat: T.MeshStandardMaterial, day: number, night: number) => {
    m.neonMaterials.push({ material: mat, day, night });
    return mat;
  };
  const warm = glow(
    new T.MeshStandardMaterial({
      color: 0xe0c497,
      emissive: 0xffcc7c,
      roughness: 0.5,
    }),
    0.05,
    1.2,
  );

  // Omit the Granville wall: the extruded façade below has actual recessed window openings.
  for (let i = 0; i < b.pts.length; i += 2) {
    if (i === f.edge) continue;
    const j = (i + 2) % b.pts.length;
    const g = walls([b.pts[i], b.pts[i + 1], b.pts[j], b.pts[j + 1]], f.y(155));
    const a = g.getAttribute("uv");
    for (let k = 0; k < a.count; k++)
      a.setXY(k, (a.getX(k) * 24) / 5.2, (a.getY(k) * 51.2) / 2.28);
    add(g, brick);
  }
  add(flatPolygon(b.pts, [], f.y(159), 5), m.roof);
  const front = new T.Shape();
  front.moveTo(0, f.y(341));
  front.lineTo(f.width, f.y(341));
  for (const [px, py] of [...crown].reverse()) front.lineTo(f.x(px), f.y(py));
  front.closePath();
  for (const [px, pw, pt] of COMMODORE_WINDOWS) {
    const shape = arch(f.x(px), f.y(277), (pw / 1230) * f.width, f.y(pt));
    front.holes.push(new T.Path(shape.getPoints(32)));
  }
  const face = new T.ExtrudeGeometry(front, {
    depth: 0.46,
    bevelEnabled: false,
    curveSegments: 20,
    steps: 1,
  });
  uv(face, brick);
  put(face, brick, 0.42);
  // The lower spandrel has a separate woven-brick bond visible in the actual building.
  box(
    f.width / 2,
    (f.y(341) + f.y(296)) / 2,
    0.05,
    f.width,
    f.y(296) - f.y(341),
    0.14,
    woven,
  );
  for (const y of [f.y(294), f.y(340)])
    box(f.width / 2, y, -0.15, f.width, 0.16, 0.45);

  for (const [px, pw, pt] of COMMODORE_WINDOWS) {
    const s = f.x(px),
      w = (pw / 1230) * f.width,
      bottom = f.y(277),
      top = f.y(pt),
      spring = top - w / 2;
    put(
      new T.ShapeGeometry(arch(s, bottom + 0.06, w - 0.1, top - 0.06), 24),
      glass,
      0.19,
    );
    const sillW = w + 0.32;
    box(s, bottom - 0.03, -0.17, sillW, 0.17, 0.58);
    for (const side of [-1, 1])
      box(
        s + side * (w / 2 - 0.055),
        (bottom + spring) / 2,
        0.16,
        0.065,
        spring - bottom,
        0.1,
        black,
      );
    box(s, (bottom + spring) / 2, 0.14, 0.065, spring - bottom, 0.1, black);
    for (const y of [bottom + (spring - bottom) * 0.58, spring])
      box(s, y, 0.14, w, 0.055, 0.1, black);
    // Radial muntins and individual arch bricks add changing highlights and real depth.
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        new T.Vector3(s, spring, -0.13),
        new T.Vector3(
          s + Math.cos(a) * (w / 2 - 0.08),
          spring + Math.sin(a) * (w / 2 - 0.08),
          -0.13,
        ),
        0.038,
        0.05,
        black,
      );
    }
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) * Math.PI) / 16,
        r = w / 2 + 0.09;
      const g = new T.BoxGeometry(((Math.PI * r) / 16) * 0.91, 0.19, 0.12);
      g.rotateZ(a - Math.PI / 2);
      g.translate(s + Math.cos(a) * r, spring + Math.sin(a) * r, 0.105);
      put(g, brick);
    }
    if (pw > 35) {
      panel(s, bottom - 0.43, -0.19, w + 0.3, 0.43, tile);
      box(s, bottom - 0.69, -0.14, w + 0.42, 0.1, 0.4);
    }
  }
  // Projecting stone piers and a continuous stepped coping follow the photographed silhouette.
  const profile = crown.map(([x, y]) => [f.x(x), f.y(y)]);
  const profileHeight = (s: number) => {
    let h = profile[0][1];
    for (let i = 1; i < profile.length; i++) {
      if (s < profile[i][0]) {
        const a = profile[i - 1],
          b = profile[i];
        return (
          a[1] + ((b[1] - a[1]) * (s - a[0])) / Math.max(0.001, b[0] - a[0])
        );
      }
      h = profile[i][1];
    }
    return h;
  };
  for (const px of [192, 309, 362, 453, 549, 658, 805, 947, 1050, 1154, 1401]) {
    const s = f.x(px),
      top = profileHeight(s);
    box(s, (top + f.y(308)) / 2, -0.14, 0.28, top - f.y(308), 0.25);
    box(s, top - 0.25, -0.2, 0.42, 0.46, 0.35);
    box(s, f.y(296), -0.21, 0.5, 0.45, 0.38);
  }
  for (let i = 1; i < profile.length; i++) {
    const [x0, y0] = profile[i - 1],
      [x1, y1] = profile[i];
    beam(
      new T.Vector3(x0, y0 - 0.08, 0.08),
      new T.Vector3(x1, y1 - 0.08, 0.08),
      0.22,
      0.62,
      cream,
    );
  }
  for (const px of [277, 1277]) {
    const s = f.x(px);
    panel(s, f.y(174), -0.1, 1.06, 1.06, rose);
  }
  const stoneName = new T.MeshStandardMaterial({
    map: label("COMMODORE", 1024, 160, "#d9ccaa", "#40372f", 97),
    roughness: 0.83,
  });
  panel(f.x(742), f.y(165), -0.18, 3.1, 0.55, stoneName);
  box(f.x(742), f.y(165) - 0.36, -0.14, 3.4, 0.1, 0.32);

  // Street floor: deep entry bays and glazed shops, beneath the ballroom's high floor.
  const entry = [f.x(271), f.x(1275)];
  const shopRanges = [
    [360, 450],
    [457, 545],
    [553, 653],
    [665, 795],
    [820, 940],
    [957, 1045],
    [1060, 1150],
  ];
  const groundTop = f.y(341);
  box(f.width / 2, groundTop / 2, 0.08, f.width, groundTop, 0.24, cream);
  for (let i = 0; i < shopRanges.length; i++) {
    const [a, b] = shopRanges[i],
      s = f.x((a + b) / 2),
      w = ((b - a) / 1230) * f.width,
      groundH = 3.15;
    if (interiors && rooms.length) {
      const [x, y, z] = f.point(s, 1.8, -0.08);
      interiors.add(
        shopWindow(x, y, z, w, groundH, Math.atan2(f.ox, f.oz), 5.5),
        rooms[i % rooms.length],
        cx,
        cz,
      );
    } else panel(s, 1.8, -0.09, w, groundH, glass);
    for (const side of [-1, 1])
      box(s + (side * w) / 2, 1.8, -0.13, 0.085, groundH, 0.18, black);
    box(s, 1.8, -0.14, 0.06, groundH, 0.17, black);
    box(s, 1.4, -0.25, 0.035, 0.6, 0.045, m.chrome);
    const signMat = new T.MeshStandardMaterial({
      map: label(
        [
          "VINYL & VINTAGE",
          "COFFEE",
          "GRANVILLE MARKET",
          "MUSIC",
          "CITY GOODS",
          "RECORDS",
          "CAFÉ",
        ][i],
        1024,
        128,
        "#eadfc9",
        "#283132",
        60,
      ),
      roughness: 0.8,
    });
    panel(s, 3.8, -0.23, w, 0.48, signMat);
    box(s, 4.35, -0.52, w + 0.05, 0.12, 1.15, black);
    for (const side of [-1, 1])
      beam(
        new T.Vector3(s + side * w * 0.43, 3.65, 0.05),
        new T.Vector3(s + side * w * 0.43, 4.32, 1.02),
        0.04,
        0.04,
        black,
      );
  }
  for (let n = 0; n < entry.length; n++) {
    const s = entry[n],
      w = 5.8;
    // Arched ornamental recess above double doors; sill stays at sidewalk elevation.
    put(new T.ShapeGeometry(arch(s, 0.08, w, 4.6), 24), black, -0.075);
    box(s, 1.43, -0.13, 3.5, 2.7, 0.09, burgundy);
    for (const side of [-1, 1]) {
      box(s + side * 0.88, 1.44, -0.185, 1.57, 2.53, 0.04, glass);
      box(s + side * 0.09, 1.15, -0.24, 0.03, 0.5, 0.04, m.chrome);
    }
    for (let i = 0; i < 32; i++) {
      const a = ((i + 0.5) * Math.PI) / 32,
        r = w / 2 + 0.07;
      const g = new T.BoxGeometry(((Math.PI * r) / 32) * 0.97, 0.14, 0.14);
      g.rotateZ(a - Math.PI / 2);
      g.translate(s + Math.cos(a) * r, 4.6 - w / 2 + Math.sin(a) * r, 0.16);
      put(g, burgundy);
    }
    const canopyWidth = 8.0,
      depth = 3.2,
      base = 4.65,
      rise = 1.25;
    const canopyProfile = (x: number) =>
      base + rise * (1 - (x / (canopyWidth / 2)) ** 2);
    // Curved opaque roof, ivory fascia and a burgundy frame, with enough head clearance.
    const cross = new T.Shape();
    cross.moveTo(s - canopyWidth / 2, base - 0.18);
    cross.lineTo(s + canopyWidth / 2, base - 0.18);
    for (let i = 32; i >= 0; i--) {
      const x = -canopyWidth / 2 + (i * canopyWidth) / 32;
      cross.lineTo(s + x, canopyProfile(x));
    }
    cross.closePath();
    put(
      new T.ExtrudeGeometry(cross, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      cream,
      0,
    );
    for (const d of [-depth - 0.035, -0.04]) {
      for (let i = 1; i <= 32; i++) {
        const a = -canopyWidth / 2 + ((i - 1) * canopyWidth) / 32,
          b = -canopyWidth / 2 + (i * canopyWidth) / 32;
        beam(
          new T.Vector3(s + a, canopyProfile(a), -d),
          new T.Vector3(s + b, canopyProfile(b), -d),
          0.095,
          0.09,
          burgundy,
        );
      }
      box(s, base - 0.12, d, canopyWidth, 0.14, 0.12, burgundy);
      for (const x of [-2, 0, 2])
        box(
          s + x,
          (base + canopyProfile(x)) / 2,
          d,
          0.09,
          canopyProfile(x) - base,
          0.11,
          burgundy,
        );
    }
    for (let x = -3.8; x <= 3.8; x += 0.3)
      box(s + x, base - 0.2, -depth + 0.12, 0.07, 0.07, 0.07, warm);
    box(s, base - 0.27, -1.7, 3.8, 0.045, 0.14, warm);
  }
  const neon = glow(
    new T.MeshStandardMaterial({
      name: "Commodore — photographed neon",
      map: m.texture("commodore/neon-color.webp", true),
      emissiveMap: m.texture("commodore/neon-emission.webp", true),
      emissive: 0xffffff,
      roughness: 0.58,
    }),
    0.1,
    1.4,
  );
  panel(entry[1], 3.52, -0.26, 2.58, 1.78, neon);
  const lanes = new T.MeshStandardMaterial({
    map: label("COMMODORE LANES", 1024, 128, "#ead9ba", "#4b2829", 78),
    roughness: 0.65,
  });
  panel(entry[0], 3.58, -0.25, 3.4, 0.45, lanes);
  const practical = new T.PointLight(0xffab73, 0, 14, 2);
  practical.name = "Commodore canopy lighting";
  practical.position.set(...f.point(entry[1], 4.1, -2));
  batch.parent.add(practical);
  m.practicalLights.push({ light: practical, day: 0, night: 14 });
  return true;
}
