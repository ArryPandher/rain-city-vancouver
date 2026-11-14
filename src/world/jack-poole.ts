import * as T from "three";
import clipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
import { Batcher, flatPolygon } from "./geometry";
import {
  pointInPoly,
  segmentPoint,
  seeded,
  type CityData,
  type Point,
} from "./data";
import type { Materials } from "./materials";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import map from "./jack-poole-map.json";
import {
  JACK_BOUNDARY,
  JACK_UPPER,
  JACK_POOL,
  JACK_CAULDRON,
  JACK_ORCA,
  JACK_LEVEL,
  JACK_COAST,
  JACK_FLIGHTS,
  JACK_RAMPS,
  JACK_SURFACES,
  JACK_TRIANGLES,
  CACTUS_OUTLINE,
  CACTUS_ROOF,
  jackTriangleHeight,
  jackTriangleNormal,
  jackBaseHeight,
  jackGroundHeight,
  jackSurface,
  type PlazaSurface,
} from "./jack-poole-site";
import { partitionTriangle, ringTriangles } from "./triangle-partition";
import { pathRectangle } from "./prospect-lookout-site";
const polygon = (p: number[]): Polygon => [
  Array.from({ length: p.length / 2 }, (_, i) => [
    Math.round(p[i * 2] * 10000) / 10000,
    Math.round(p[i * 2 + 1] * 10000) / 10000,
  ]),
];
export type PlazaPiece = {
  pts: number[];
  holes: number[][];
  height: (x: number, z: number) => number;
  kind: string;
  normal?: (x: number, z: number) => number[];
};
/** The rendered construction is partitioned using the collision priority order. */
export function jackPieces() {
  const result: PlazaPiece[] = [];
  let occupied: MultiPolygon = [polygon(JACK_POOL)];
  for (const s of JACK_SURFACES) {
    const sources = s.steps
      ? Array.from({ length: s.steps }, (_, i) => {
          const a = s.a!,
            b = s.b!,
            at = (t: number) => a.map((v, j) => v + (b[j] - v) * t);
          const mid = at((i + 0.5) / s.steps!);
          return {
            pts: pathRectangle(
              at(i / s.steps!),
              at((i + 1) / s.steps!),
              s.width!,
            ),
            height: () => s.height(mid[0], mid[1]),
          };
        })
      : [s];
    const whole = polygon(s.pts);
    const remaining = clipping.difference(whole, occupied);
    for (const source of sources) {
      for (const [outer, ...holes] of clipping.intersection(
        polygon(source.pts),
        remaining,
      ))
        result.push({
          pts: outer.flat(),
          holes: holes.map((h) => h.flat()),
          height: source.height,
          kind: s.kind,
        });
    }
    occupied = clipping.union(occupied, whole);
  }

  const boundary = ringTriangles(JACK_BOUNDARY);
  const cutouts = [JACK_POOL, ...JACK_SURFACES.map((s) => s.pts)].flatMap(
    ringTriangles,
  );
  for (const t of JACK_TRIANGLES) {
    for (const outer of partitionTriangle(t.p, boundary, cutouts))
      result.push({
        pts: outer.flat(),
        holes: [],
        height: (x, z) => jackTriangleHeight(t, x, z).height,
        normal: (x, z) => jackTriangleNormal(t, x, z),
        kind: "ground",
      });
  }
  return result;
}
export function buildJackPoole(
  parent: T.Object3D,
  data: CityData,
  m: Materials,
  collision: CollisionWorld,
  reflections: ReflectionProbeSpec[],
) {
  const batch = new Batcher(parent, 100),
    random = seeded(648735254);
  const concrete = m.pbr("concrete_pavement", 0xbfc0b5, 0.94);
  concrete.name = "Jack Poole — plaza paving";
  concrete.side = T.DoubleSide;
  concrete.normalScale.set(0.22, 0.22);
  const mineral = new T.MeshStandardMaterial({
    name: "Jack Poole — concrete structure",
    color: 0xb7b9b4,
    roughness: 0.92,
    map: m.texture("cast-concrete/color.jpg", true),
    normalMap: m.texture("cast-concrete/normal.jpg"),
    normalScale: new T.Vector2(0.22, 0.22),
    side: T.DoubleSide,
  });
  const grass = m.grass.clone();
  grass.name = "Jack Poole — planted bank";
  grass.color.setHex(0x7a8050);
  grass.side = T.DoubleSide;
  const dark = new T.MeshStandardMaterial({
    name: "Jack Poole — dark stone and trim",
    color: 0x354345,
    roughness: 0.62,
    metalness: 0.25,
  });
  const steel = new T.MeshStandardMaterial({
    name: "Jack Poole — stainless steel",
    color: 0x9daeb3,
    roughness: 0.26,
    metalness: 0.86,
  });
  const black = new T.MeshStandardMaterial({
    name: "Digital Orca — black aluminium",
    color: 0x111d21,
    roughness: 0.34,
    metalness: 0.38,
  });
  const white = new T.MeshStandardMaterial({
    name: "Digital Orca — white aluminium",
    color: 0xe4e7df,
    roughness: 0.4,
    metalness: 0.2,
  });
  const wood = new T.MeshStandardMaterial({
    name: "Jack Poole — seating timber",
    color: 0x8f683f,
    roughness: 0.87,
    map: m.texture("houses/painted-wood-color.webp", true),
  });
  const glass = new T.MeshPhysicalMaterial({
    name: "Olympic cauldron — frosted crystalline glass",
    color: 0xaacacc,
    roughness: 0.36,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: false,
    opacity: 1,
    side: T.DoubleSide,
    depthWrite: true,
    vertexColors: true,
  });
  const cafeGlass = new T.MeshPhysicalMaterial({
    name: "Cactus Club — glass",
    color: 0x577774,
    roughness: 0.15,
    metalness: 0.3,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.58,
    side: T.DoubleSide,
    depthWrite: false,
  });
  cafeGlass.userData.castShadow = false;
  glass.userData.castShadow = false;
  const pool = new T.MeshPhysicalMaterial({
    name: "Jack Poole — reflecting pool",
    color: 0x24484c,
    roughness: 0.12,
    metalness: 0.58,
    clearcoat: 1,
  });
  const glow = new T.MeshStandardMaterial({
    color: 0xbfd8d6,
    emissive: 0x9cc5ca,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  m.neonMaterials.push({ material: glow, day: 0, night: 0.6 });
  const add = (g: T.BufferGeometry, mat: T.Material) => {
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new T.Vector3());
    batch.add(g, mat, c.x, c.z);
  };
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    angle = 0,
  ) {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateY(angle);
    g.translate(x, y, z);
    add(g, mat);
  }
  function beam(
    a: number[],
    b: number[],
    r: number,
    mat: T.Material = steel,
    sides = 8,
  ) {
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
    add(g, mat);
  }
  function quad(
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    mat: T.Material,
  ) {
    const g = new T.BufferGeometry(),
      p = [...a, ...b, ...c, ...d];
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        [
          0,
          0,
          Math.hypot(b[0] - a[0], b[2] - a[2]) / 2,
          0,
          Math.hypot(b[0] - a[0], b[2] - a[2]) / 2,
          Math.abs(c[1] - b[1]) / 2,
          0,
          Math.abs(d[1] - a[1]) / 2,
        ],
        2,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    add(g, mat);
  }
  function surface(p: PlazaPiece, mat: T.Material) {
    const g = flatPolygon(p.pts, p.holes, 0, 1.8),
      a = g.getAttribute("position");
    for (let i = 0; i < a.count; i++) a.setY(i, p.height(a.getX(i), a.getZ(i)));
    g.computeVertexNormals();
    if (p.normal) {
      const n = g.getAttribute("normal");
      for (let i = 0; i < a.count; i++) {
        const v = p.normal(a.getX(i), a.getZ(i));
        n.setXYZ(i, v[0], v[1], v[2]);
      }
    }
    add(g, mat);
  }
  const patches = data.areas
    .filter(
      (a) =>
        ["grass", "park", "forest", "wood", "meadow"].includes(a.kind) &&
        a.pts.some(
          (x, i) =>
            i % 2 === 0 &&
            x > -110 &&
            x < 285 &&
            a.pts[i + 1] > -850 &&
            a.pts[i + 1] < -500,
        ),
    )
    .map((a) => polygon(a.pts));
  patches.push(polygon(map.ways.w89118742.pts));
  const plantArea = patches.length
    ? clipping.union(patches[0], ...patches.slice(1))
    : [];
  for (const p of jackPieces()) {
    if (p.kind === "ground" && plantArea.length) {
      const poly: Polygon = [
        ...polygon(p.pts),
        ...p.holes.map((h) => polygon(h)[0]),
      ];
      for (const [outer, ...holes] of clipping.intersection(poly, plantArea))
        surface(
          { ...p, pts: outer.flat(), holes: holes.map((h) => h.flat()) },
          grass,
        );
      for (const [outer, ...holes] of clipping.difference(poly, plantArea))
        surface(
          { ...p, pts: outer.flat(), holes: holes.map((h) => h.flat()) },
          concrete,
        );
    } else if (p.kind === "roof") {
      const green = polygon(map.ways.w223634909.pts);
      for (const [outer, ...holes] of clipping.intersection(
        polygon(p.pts),
        green,
      ))
        surface(
          { ...p, pts: outer.flat(), holes: holes.map((h) => h.flat()) },
          grass,
        );
      for (const [outer, ...holes] of clipping.difference(
        polygon(p.pts),
        green,
      ))
        surface(
          { ...p, pts: outer.flat(), holes: holes.map((h) => h.flat()) },
          concrete,
        );
    } else surface(p, concrete);
  }
  // Panel joints are physical thin inlays, clipped to the upper plaza and pool.
  const paving = clipping.difference(
    polygon(JACK_UPPER),
    polygon(CACTUS_OUTLINE),
    polygon(JACK_POOL),
    ...JACK_FLIGHTS.map((f) => polygon(f.pts)),
  );
  const origin = JACK_CAULDRON,
    axis: Point = [0.925, 0.38],
    local = (u: number, v: number) => [
      origin[0] + u * axis[0] + v * axis[1],
      origin[1] + u * axis[1] - v * axis[0],
    ];
  for (let v = -60; v < 115; v += 2.4) {
    const a = local(-70, v),
      b = local(65, v);
    for (const [outer, ...holes] of clipping.intersection(
      paving,
      polygon(
        pathRectangle(a, b, Math.round(v / 2.4) % 5 === 0 ? 0.21 : 0.025),
      ),
    ))
      surface(
        {
          pts: outer.flat(),
          holes: holes.map((h) => h.flat()),
          height: () => JACK_LEVEL + 0.003,
          kind: "inlay",
        },
        dark,
      );
  }
  for (let u = -70; u < 70; u += 1.2) {
    const a = local(u, -60),
      b = local(u, 115);
    for (const [outer, ...holes] of clipping.intersection(
      paving,
      polygon(pathRectangle(a, b, 0.018)),
    ))
      surface(
        {
          pts: outer.flat(),
          holes: holes.map((h) => h.flat()),
          height: () => JACK_LEVEL + 0.003,
          kind: "inlay",
        },
        dark,
      );
  }
  // Visible tread risers and retaining structure share the exact collision heights.
  for (const s of JACK_FLIGHTS) {
    const a = s.a!,
      b = s.b!,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = ((dz / len) * s.width!) / 2,
      nz = ((-dx / len) * s.width!) / 2;
    for (let i = 0; i <= s.steps!; i++) {
      const t = i / s.steps!,
        x = a[0] + dx * t,
        z = a[1] + dz * t,
        after =
          i === s.steps!
            ? s.high!
            : s.height(
                a[0] + (dx * (i + 0.5)) / s.steps!,
                a[1] + (dz * (i + 0.5)) / s.steps!,
              ),
        before =
          i === 0
            ? s.low!
            : s.height(
                a[0] + (dx * (i - 0.5)) / s.steps!,
                a[1] + (dz * (i - 0.5)) / s.steps!,
              );
      if (Math.abs(after - before) < 1e-8) continue;
      quad(
        [x + nx, before, z + nz],
        [x - nx, before, z - nz],
        [x - nx, after, z - nz],
        [x + nx, after, z + nz],
        mineral,
      );
    }
  }
  function rail(
    a: Point,
    b: Point,
    height: (x: number, z: number) => number,
    skipOpenings = false,
    ownFlight?: PlazaSurface,
  ) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(len / 1.4);
    for (let i = 0; i < n; i++) {
      const t0 = i / n,
        t1 = (i + 1) / n,
        x = a[0] + (b[0] - a[0]) * t0,
        z = a[1] + (b[1] - a[1]) * t0,
        xx = a[0] + (b[0] - a[0]) * t1,
        zz = a[1] + (b[1] - a[1]) * t1;
      if (
        skipOpenings &&
        [...JACK_FLIGHTS, ...JACK_RAMPS]
          .filter((s) => s !== ownFlight)
          .some(
            (s) =>
              segmentPoint((x + xx) / 2, (z + zz) / 2, ...s.a!, ...s.b!).d <
              s.width! / 2 + 1,
          )
      )
        continue;
      const y = height(x, z),
        yy = height(xx, zz);
      beam([x, y, z], [x, y + 1.1, z], 0.04, dark);
      for (const h of [0.25, 0.65, 1.1])
        beam([x, y + h, z], [xx, yy + h, zz], 0.025, dark);
      collision.addBarrier(x, z, xx, zz, 0.04, Math.max(y, yy) + 1.1);
    }
  }
  for (let i = 0; i < JACK_COAST.length - 1; i++) {
    const a = JACK_COAST[i],
      b = JACK_COAST[i + 1],
      height = (x: number, z: number) => jackBaseHeight(x, z);
    rail(a, b, height);
    quad(
      [a[0], -0.6, a[1]],
      [b[0], -0.6, b[1]],
      [b[0], height(b[0], b[1]), b[1]],
      [a[0], height(a[0], a[1]), a[1]],
      mineral,
    );
  }
  // North upper edge, interrupted at both real stair flights.
  rail([165, -782], [239, -752], () => JACK_LEVEL, true);
  for (const s of JACK_FLIGHTS) {
    const a = s.a!,
      b = s.b!,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    for (const sign of [-1, 1]) {
      const ox = (dz / len) * (s.width! * 0.5 - 0.12) * sign,
        oz = (-dx / len) * (s.width! * 0.5 - 0.12) * sign;
      rail(
        [a[0] + ox, a[1] + oz],
        [b[0] + ox, b[1] + oz],
        (x, z) => s.height(x - ox, z - oz),
        true,
        s,
      );
    }
  }
  // Low cafe volume, its real mapped planted roof and exterior access stairs.
  for (let i = 0; i < CACTUS_OUTLINE.length; i += 2) {
    const j = (i + 2) % CACTUS_OUTLINE.length,
      a: [number, number] = [CACTUS_OUTLINE[i], CACTUS_OUTLINE[i + 1]],
      b: [number, number] = [CACTUS_OUTLINE[j], CACTUS_OUTLINE[j + 1]],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    quad(
      [a[0], JACK_LEVEL, a[1]],
      [b[0], JACK_LEVEL, b[1]],
      [b[0], CACTUS_ROOF - 0.25, b[1]],
      [a[0], CACTUS_ROOF - 0.25, a[1]],
      cafeGlass,
    );
    quad(
      [a[0], CACTUS_ROOF - 0.25, a[1]],
      [b[0], CACTUS_ROOF - 0.25, b[1]],
      [b[0], CACTUS_ROOF, a[1] === b[1] ? a[1] : b[1]],
      [a[0], CACTUS_ROOF, a[1]],
      dark,
    );
    for (let d = 0; d < len; d += 2.1) {
      const t = d / len,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam([x, JACK_LEVEL, z], [x, CACTUS_ROOF - 0.25, z], 0.055, dark);
    }
    rail(a, b, () => CACTUS_ROOF, true);
  }
  const blade = new T.MeshStandardMaterial({
    name: "Jack Poole — meadow blades",
    color: 0x777e3d,
    roughness: 1,
    side: T.DoubleSide,
  });
  // Planted roof tufts and the lower meadow retain their actual mapped boundaries.
  for (const [outline, height] of [
    [map.ways.w223634909.pts, () => CACTUS_ROOF],
    [
      map.ways.w89118742.pts,
      (x: number, z: number) => jackGroundHeight(x, z) ?? 0,
    ],
  ] as const) {
    const xs = outline.filter((_, i) => !(i % 2)),
      zs = outline.filter((_, i) => i % 2);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 1.35)
      for (let z = Math.min(...zs); z < Math.max(...zs); z += 1.35) {
        const xx = x + random(),
          zz = z + random();
        if (
          !pointInPoly(xx, zz, outline) ||
          [...JACK_FLIGHTS, ...JACK_RAMPS].some((s) =>
            pointInPoly(xx, zz, s.pts),
          )
        )
          continue;
        const y = height(xx, zz);
        for (let i = 0; i < 14; i++) {
          const angle = random() * Math.PI * 2,
            w = 0.018 + random() * 0.023,
            h = 0.24 + random() * 0.43;
          const bx = xx + (random() - 0.5) * 0.7,
            bz = zz + (random() - 0.5) * 0.7,
            dx = Math.cos(angle) * w,
            dz = Math.sin(angle) * w,
            lean = 0.06 + random() * 0.16;
          for (let j = 0; j < 3; j++) {
            const t = j / 3,
              tt = (j + 1) / 3;
            const centre = (q: number) => [
              bx + Math.sin(angle) * lean * q * q,
              y + h * q,
              bz - Math.cos(angle) * lean * q * q,
            ];
            const a = centre(t),
              b = centre(tt),
              wa = 1 - t,
              wb = Math.max(0.015, 1 - tt);
            quad(
              [a[0] - dx * wa, a[1], a[2] - dz * wa],
              [a[0] + dx * wa, a[1], a[2] + dz * wa],
              [b[0] + dx * wb, b[1], b[2] + dz * wb],
              [b[0] - dx * wb, b[1], b[2] - dz * wb],
              blade,
            );
          }
        }
      }
  }
  // Reflecting basin: restrained water and a raised granite coping protect the sculpture.
  surface(
    {
      pts: JACK_POOL,
      holes: [],
      height: () => JACK_LEVEL - 0.12,
      kind: "pool",
    },
    pool,
  );
  for (let i = 0; i < JACK_POOL.length; i += 2) {
    const j = (i + 2) % JACK_POOL.length,
      a: Point = [JACK_POOL[i], JACK_POOL[i + 1]],
      b: Point = [JACK_POOL[j], JACK_POOL[j + 1]],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    box(
      (a[0] + b[0]) / 2,
      JACK_LEVEL + 0.12,
      (a[1] + b[1]) / 2,
      len,
      0.3,
      0.48,
      mineral,
      -Math.atan2(dz, dx),
    );
    collision.addBarrier(...a, ...b, 0.25, JACK_LEVEL + 0.5);
  }
  const cauldron = new T.Vector3(
    JACK_CAULDRON[0],
    JACK_LEVEL,
    JACK_CAULDRON[1],
  );
  // Four 16.5 m crossed arms: a steel core, thin glass panels, seams and end caps.
  const makeArm = (sx: number, sz: number) => {
    const a = new T.Vector3(sx * 6.25, 0.25, sz * 6.25),
      b = new T.Vector3(-sx * 3.2, 10, -sz * 3.2),
      direction = b.clone().sub(a),
      len = direction.length(),
      q = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
      centre = a.clone().add(b).multiplyScalar(0.5).add(cauldron);
    const core = new T.BoxGeometry(0.32, len, 0.32);
    core.applyQuaternion(q);
    core.translate(...centre.toArray());
    add(core, steel);
    for (let panel = 0; panel < 18; panel++) {
      const length = len / 18 - 0.014,
        along = -len / 2 + ((panel + 0.5) * len) / 18,
        g = new T.BoxGeometry(1.2, length, 1.2);
      const p = g.getAttribute("position"),
        colors = [];
      for (let i = 0; i < p.count; i++) {
        const v = 0.97 + random() * 0.03;
        colors.push(v, v, Math.min(1, v + 0.025));
      }
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      g.translate(0, along, 0);
      g.applyQuaternion(q);
      g.translate(...centre.toArray());
      add(g, glass);
    }
    for (const x of [-0.61, 0.61])
      for (const z of [-0.61, 0.61]) {
        const p = new T.Vector3(x, -len / 2, z).applyQuaternion(q).add(centre),
          r = new T.Vector3(x, len / 2, z).applyQuaternion(q).add(centre);
        beam(p.toArray(), r.toArray(), 0.026, steel);
      }
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) makeArm(sx, sz);
  const stem = new T.BoxGeometry(1.2, 9.5, 1.2);
  stem.setAttribute(
    "color",
    new T.Float32BufferAttribute(
      Array(stem.getAttribute("position").count * 3).fill(0.98),
      3,
    ),
  );
  stem.rotateY(0.38);
  stem.translate(cauldron.x, JACK_LEVEL + 4.85, cauldron.z);
  add(stem, glass);
  // Original voxel interpretation of the neighbouring public sculpture.
  const pixels = [
    "........BBB.....",
    "......BBBBBB....",
    ".....BBWWWBBB...",
    ".....BBWWWBBB...",
    "..BBBBBWWWBB....",
    "...BBBBWWBBB....",
    "....BBBWWBB.....",
    "....BBBWWBB.....",
    ".....BBWWBB.....",
    ".....BBWWB......",
    "......BWWB......",
    "......BWWB......",
    "......BBWB......",
    "......BBBB......",
    ".....BBBB.......",
    "....BBBBB.......",
    "..BBBB.BBBB.....",
    ".BBBB...BBBB....",
  ];
  for (let row = 0; row < pixels.length; row++)
    for (let col = 0; col < pixels[row].length; col++) {
      const ch = pixels[row][col];
      if (ch === ".") continue;
      const x = (col - 7.5) * 0.43,
        z = 0,
        angle = -0.38;
      box(
        JACK_ORCA[0] + x * Math.cos(angle),
        JACK_LEVEL + (pixels.length - row - 0.5) * 0.43,
        JACK_ORCA[1] - x * Math.sin(angle),
        0.429,
        0.429,
        0.64,
        ch === "W" ? white : black,
        angle,
      );
    }
  box(
    JACK_ORCA[0],
    JACK_LEVEL + 0.08,
    JACK_ORCA[1],
    4.6,
    0.16,
    2.2,
    dark,
    -0.38,
  );
  collision.addBarrier(
    JACK_ORCA[0] - 2.4,
    JACK_ORCA[1],
    JACK_ORCA[0] + 2.4,
    JACK_ORCA[1],
    0.9,
    JACK_LEVEL + 8.2,
  );
  // Sparse fixed furniture leaves the event plaza and walking lines clear.
  for (const [x, z] of [
    [185, -775],
    [207, -766],
    [218, -748],
    [151, -682],
  ]) {
    const y = jackGroundHeight(x, z) ?? JACK_LEVEL;
    box(x, y + 0.48, z, 2.3, 0.14, 0.65, wood, -0.38);
    for (const dx of [-0.8, 0.8])
      box(x + dx, y + 0.22, z, 0.12, 0.44, 0.48, dark);
    collision.addBarrier(x - 1.1, z, x + 1.1, z, 0.34, y + 0.65);
  }
  for (const [x, z] of [
    [142, -672],
    [174, -770],
  ]) {
    const y = jackGroundHeight(x, z) ?? JACK_LEVEL;
    beam([x, y, z], [x - 1.5, y + 12, z - 0.6], 0.12, steel);
    beam([x - 1.5, y + 12, z - 0.6], [x + 1.6, y + 14, z - 0.8], 0.15, steel);
    box(x + 1.2, y + 13.5, z - 0.8, 0.7, 0.2, 0.5, glow);
  }
  reflections.push({
    name: "Jack Poole reflecting pool and cauldron",
    position: [JACK_CAULDRON[0], JACK_LEVEL + 0.6, JACK_CAULDRON[1]],
    materials: [pool, glass],
  });
  return batch.finish();
}
