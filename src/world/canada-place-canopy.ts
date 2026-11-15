import { CANADA_PLACE_ENTRANCE as entrance } from "./canada-place-entrance-data";
import {
  createCanadaPlaceCanopyGlazingPair,
  createCanadaPlaceCanopyGlazingMesh,
} from "./canada-place-canopy-glass";
import * as T from "three";
import data from "./canada-place-canopy-data.json";
import { geo } from "./data";
import { landmarkSurfaceUV } from "./landmark-surfaces";
export const CANADA_PLACE_CANOPY = data;
export const CANADA_PLACE_CANOPY_FOOTPRINT = data.footprint.flat();
const origin = geo(data.origin[1], data.origin[0]);
export const CANADA_PLACE_CANOPY_WORLD_FOOTPRINT = data.footprint.flatMap(
  ([x, z]) => [x + origin[0], z + origin[1]],
);
const length = Math.hypot(data.b[0] - data.a[0], data.b[1] - data.a[1]);
const dx = (data.b[0] - data.a[0]) / length,
  dz = (data.b[1] - data.a[1]) / length,
  nx = -dz,
  nz = dx;
export const CANADA_PLACE_CANOPY_LENGTH = length;
/** Estimated closed fixed-glazed southern return; no public interior access. */
export const CANADA_PLACE_RETURN_DEPTH = 0.7;
const returnBack = length - CANADA_PLACE_RETURN_DEPTH;
const returnHead = entrance.roofBackY - 0.06;
export function canadaPlaceCanopyPoint(u: number, y: number, outward: number) {
  return new T.Vector3(
    data.a[0] + dx * u + nx * outward,
    y,
    data.a[1] + dz * u + nz * outward,
  );
}
export function canadaPlaceCanopySection(theta: number) {
  return {
    outward: data.projection * Math.cos(theta),
    y: data.spring + (data.crown - data.spring) * Math.sin(theta),
  };
}
export const CANOPY_SOURCE_COUNTS = {
  concrete: [8368, 11154],
  glass: [2424, 3384],
  trim: [34749, 54198],
} as const;
/** Only HOTEL15→16 base facade, not the hotel tower/upper tiers or SAILS. */
export function replaceCanadaPlaceCanopyFaces(
  g: T.BufferGeometry,
  material: string,
) {
  if (!["concrete", "glass", "trim"].includes(material)) return 0;
  const p = g.getAttribute("position"),
    ix = g.getIndex(),
    kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j)),
      v = ids.map((j) => ({
        u: (p.getX(j) - data.a[0]) * dx + (p.getZ(j) - data.a[1]) * dz,
        o: (p.getX(j) - data.a[0]) * nx + (p.getZ(j) - data.a[1]) * nz,
        y: p.getY(j),
      }));
    const wall =
      material === "concrete" &&
      v.every(
        (q) =>
          q.u >= -0.012 &&
          q.u <= length + 0.012 &&
          Math.abs(q.o) < 0.012 &&
          q.y >= 7.63 &&
          q.y <= 14.82,
      ) &&
      Math.max(...v.map((q) => q.y)) - Math.min(...v.map((q) => q.y)) > 7;
    const pane =
      material === "glass" &&
      v.every(
        (q) =>
          q.u >= -0.012 &&
          q.u <= length + 0.012 &&
          q.o >= 0.16 &&
          q.o <= 0.2 &&
          q.y >= 8.88 &&
          q.y <= 13.57,
      );
    const trim =
      material === "trim" &&
      v.every(
        (q) =>
          q.u >= -0.3 &&
          q.u <= length + 0.3 &&
          q.o >= -0.04 &&
          q.o <= 0.7 &&
          q.y >= 7.98 &&
          q.y <= 14.85,
      );
    if (wall || pane || trim) removed++;
    else kept.push(...ids);
  }
  g.setIndex(kept);
  return removed;
}
export function canadaPlaceCanopyCompatible(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  let valid = true;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const name = (o.material as T.Material).name,
      counts = CANOPY_SOURCE_COUNTS[name as keyof typeof CANOPY_SOURCE_COUNTS];
    if (!counts) return;
    if (
      found.has(name) ||
      o.geometry.getAttribute("position").count !== counts[0] ||
      o.geometry.getIndex()?.count !== counts[1]
    ) {
      valid = false;
      return;
    }
    found.add(name);
    const p = o.geometry.getAttribute("position"),
      v = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++)
      v.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3);
    const g = new T.BufferGeometry().setAttribute(
      "position",
      new T.BufferAttribute(v, 3),
    );
    g.setIndex(Array.from(o.geometry.getIndex()!.array));
    g.applyMatrix4(o.matrixWorld);
    const expected = { concrete: 2, glass: 24, trim: 156 }[
      name as "concrete" | "glass" | "trim"
    ];
    if (replaceCanadaPlaceCanopyFaces(g, name) !== expected) valid = false;
    g.dispose();
  });
  return valid && found.size === 3;
}
/** One anchored entrance conservatory. Local model datum, shared static materials;
 * estimated3m projection requires the exported footprint as a new closed solid. */
export function addCanadaPlaceCanopy(
  root: T.Group,
  source: Map<string, T.MeshStandardMaterial>,
) {
  const stone = (
    source.get("concrete") ??
    new T.MeshStandardMaterial({ color: 0xcbd0ca, roughness: 0.8 })
  ).clone();
  const glass = new T.MeshStandardMaterial({
    color: 0x668d81,
    roughness: 0.2,
    metalness: 0.32,
    envMapIntensity: 1.25,
  });
  const endGlasses = [glass.clone(), glass.clone()];
  const glazingPair = createCanadaPlaceCanopyGlazingPair();
  const lining = new T.MeshStandardMaterial({
    name: "canada-canopy-lining",
    color: 0x666860,
    roughness: 0.86,
    metalness: 0,
    side: T.FrontSide,
  });
  const frame = new T.MeshStandardMaterial({
    // Pale painted framing, with the green cast supplied by the glazing.
    color: 0xd1d2c7,
    roughness: 0.42,
    metalness: 0,
  });
  stone.name = "canada-canopy-stone";
  glass.name = "canada-canopy-glass";
  frame.name = "canada-canopy-frame";
  for (const m of [stone, glass, frame]) {
    m.side = T.FrontSide;
    m.transparent = false;
    m.opacity = 1;
  }
  if (source.has("concrete")) {
    stone.onBeforeCompile = source.get("concrete")!.onBeforeCompile;
    stone.customProgramCacheKey = source.get("concrete")!.customProgramCacheKey;
  }
  const groups = new Map<
    T.Material,
    { p: number[]; n: number[]; ix: number[] }
  >();
  function append(m: T.Material, p: number[], ix: number[], normals: number[]) {
    let g = groups.get(m);
    if (!g) groups.set(m, (g = { p: [], n: [], ix: [] }));
    const offset = g.p.length / 3;
    g.p.push(...p);
    g.n.push(...normals);
    g.ix.push(...ix.map((i) => i + offset));
  }
  function quad(
    m: T.Material,
    p: T.Vector3[],
    normal: T.Vector3,
    normals?: T.Vector3[],
  ) {
    const cross = new T.Vector3().crossVectors(
      p[1].clone().sub(p[0]),
      p[2].clone().sub(p[0]),
    );
    if (cross.dot(normal) < 0) {
      p = [p[0], p[3], p[2], p[1]];
      if (normals) normals = [normals[0], normals[3], normals[2], normals[1]];
    }
    append(
      m,
      p.flatMap((v) => v.toArray()),
      [
        [0, 1, 2],
        [0, 2, 3],
      ]
        .filter(
          ([a, b, c]) =>
            new T.Vector3()
              .crossVectors(p[b].clone().sub(p[a]), p[c].clone().sub(p[a]))
              .lengthSq() > 1e-12,
        )
        .flat(),
      (normals ?? p.map(() => normal)).flatMap((v) => v.toArray()),
    );
  }
  function beam(a: T.Vector3, b: T.Vector3, width: number, m = frame) {
    const delta = b.clone().sub(a);
    if (delta.length() < 1e-6) return;
    const g = new T.BoxGeometry(width, width, delta.length());
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        delta.normalize(),
      ),
    );
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
    append(
      m,
      Array.from(g.getAttribute("position").array),
      Array.from(g.getIndex()!.array),
      Array.from(g.getAttribute("normal").array),
    );
    g.dispose();
  }
  const at = canadaPlaceCanopyPoint,
    out = new T.Vector3(nx, 0, nz),
    up = new T.Vector3(0, 1, 0),
    along = new T.Vector3(dx, 0, dz);
  const sections = [
    { outward: data.projection, y: data.sill, theta: 0 },
    { outward: data.projection, y: data.spring, theta: 0 },
    ...Array.from({ length: 16 }, (_, i) => {
      const theta = ((i + 1) * Math.PI) / 32;
      return { ...canadaPlaceCanopySection(theta), theta };
    }),
  ];
  const count = Math.ceil(length / 1.35);
  const normal = (theta: number) =>
    new T.Vector3(
      (nx * Math.cos(theta)) / data.projection,
      Math.sin(theta) / (data.crown - data.spring),
      (nz * Math.cos(theta)) / data.projection,
    ).normalize();
  for (let j = 0; j < count; j++) {
    const l = (length * j) / count,
      r = (length * (j + 1)) / count;
    for (let k = 1; k < sections.length; k++) {
      const a = sections[k - 1],
        b = sections[k];
      if (k === 1 && l >= entrance.start - 1e-6) continue;
      quad(
        glass,
        [
          at(l, a.y, a.outward),
          at(r, a.y, a.outward),
          at(r, b.y, b.outward),
          at(l, b.y, b.outward),
        ],
        normal((a.theta + b.theta) / 2),
        [normal(a.theta), normal(a.theta), normal(b.theta), normal(b.theta)],
      );
    }
  }
  for (let j = 0; j <= count; j++) {
    const u = (length * j) / count;
    for (let k = 1; k < sections.length; k++) {
      const a = sections[k - 1],
        b = sections[k];
      if (k === 1 && u > entrance.start + 1e-6) continue;
      beam(
        at(u, a.y, a.outward + 0.045),
        at(u, b.y, b.outward + 0.045),
        j % 4 === 0 ? 0.105 : 0.055,
      );
    }
  }
  for (const k of [0, 1, 5, 9, 13, 17]) {
    const s = sections[k];
    beam(
      at(0, s.y, s.outward + 0.05),
      at(k === 0 ? entrance.start : length, s.y, s.outward + 0.05),
      0.085,
    );
  }
  // Rabich2022 shows genuine inward curved webs and inboard uprights through
  // the southern glazed end. Repeat on existing primary ribs, not each pane.
  // 230mm web depth and post sections are explicit authored estimates.
  const webDepth = [0.05, 0.28];
  const primary = Array.from({ length: count + 1 }, (_, j) => j).filter(
    (j) => j % 4 === 0 || j === count,
  );
  function closedWeb(rings: T.Vector3[][]) {
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1],
        b = rings[i];
      const center = [...a, ...b]
        .reduce((v, p) => v.add(p), new T.Vector3())
        .multiplyScalar(0.125);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4,
          v = [a[j], a[k], b[k], b[j]];
        const n = v
          .reduce((v, p) => v.add(p), new T.Vector3())
          .multiplyScalar(0.25)
          .sub(center)
          .normalize();
        quad(frame, v, n);
      }
    }
    for (const end of [0, rings.length - 1]) {
      const here = rings[end],
        near = rings[end === 0 ? 1 : end - 1];
      const center = here
        .reduce((v, p) => v.add(p), new T.Vector3())
        .multiplyScalar(0.25);
      const other = near
        .reduce((v, p) => v.add(p), new T.Vector3())
        .multiplyScalar(0.25);
      quad(frame, here, center.sub(other).normalize());
    }
  }
  for (const j of primary) {
    const u = Math.max(0.055, Math.min(length - 0.055, (length * j) / count));
    const side = along.clone().multiplyScalar(0.05);
    const rings = (
      u > entrance.start + 1e-6 ? sections.slice(1) : sections
    ).map((section) => {
      const n = normal(section.theta),
        p = at(u, section.y, section.outward);
      const a = p.clone().addScaledVector(n, -webDepth[0]);
      const b = p.clone().addScaledVector(n, -webDepth[1]);
      return [
        a.clone().sub(side),
        a.clone().add(side),
        b.clone().add(side),
        b.clone().sub(side),
      ];
    });
    closedWeb(rings);
    // Inside post bears on the same floor and meets the curved web at crown.
    // Its plane remains inside the ellipse; no rectangular roof is introduced.
    beam(
      at(u, u > returnBack ? returnHead : data.sill, 0.28),
      at(u, data.crown - 0.28, 0.28),
      0.14,
    );
    beam(at(u, data.crown - 0.28, 0.02), at(u, data.crown - 0.28, 0.35), 0.12);
  }
  for (const k of [1, 9]) {
    const section = sections[k],
      n = normal(section.theta);
    const a = at(0.055, section.y, section.outward).addScaledVector(n, -0.23);
    const b = at(length - 0.055, section.y, section.outward).addScaledVector(
      n,
      -0.23,
    );
    beam(a, b, 0.09);
  }
  // Rabich's southern end view resolves overlapping upright/crossmember
  // planes, not a staircase. Narrow secondary planes follow alternate existing
  // outer ribs; primary140mm posts remain distinct. All depths are estimates.
  const interiorStations = Array.from(
    { length: count + 1 },
    (_, j) => j,
  ).filter((j) => j % 2 === 0 || j === count);
  for (const j of interiorStations) {
    const u = Math.max(0.075, Math.min(length - 0.075, (length * j) / count));
    const secondary = j % 4 !== 0 && j !== count;
    const width = secondary ? 0.09 : 0.11;
    if (secondary)
      beam(
        at(u, u > returnBack ? returnHead : data.sill, 0.28),
        at(u, data.crown - 0.28, 0.28),
        0.09,
      );
    // Outer upright is below the actual ellipse (14.42m atout1.25).
    // It joins three crossmembers; it does not terminate against free glass.
    beam(
      at(u, u > returnBack ? returnHead : data.sill, 1.25),
      at(u, 14.2, 1.25),
      width,
    );
    for (const y of [10.6, 12.4, 14.2])
      beam(at(u, y, 0.28), at(u, y, 1.25), width);
  }
  // Continuous rails tie every secondary plane back to the primary structure.
  for (const y of [10.6, 12.4, 14.2])
    beam(at(0.075, y, 1.25), at(length - 0.075, y, 1.25), 0.08);
  beam(
    at(0.075, data.crown - 0.28, 0.28),
    at(length - 0.075, data.crown - 0.28, 0.28),
    0.09,
  );
  // Exterior-visible closed backing, on the original wall line, with no
  // ceiling plane across the convex glazing. Floor is the existing sill slab.
  quad(
    lining,
    [
      at(0, data.sill, 0),
      at(length, data.sill, 0),
      at(length, data.crown, 0),
      at(0, data.crown, 0),
    ],
    out,
  );
  // Solid plinth and its capped threshold contact the unchanged source deck.
  quad(
    stone,
    [
      at(0, 7.65, 3),
      at(entrance.start, 7.65, 3),
      at(entrance.start, data.sill, 3),
      at(0, data.sill, 3),
    ],
    out,
  );
  quad(
    lining,
    [
      at(0, data.sill, 0),
      at(entrance.start, data.sill, 0),
      at(entrance.start, data.sill, 3),
      at(0, data.sill, 3),
    ],
    up,
  );
  // Both end walls are real glazed polygons, closed to the original HOTEL wall.
  for (const [endIndex, u] of [0, length].entries()) {
    const endNormal = along.clone().multiplyScalar(u === 0 ? -1 : 1);
    // The southern recess return already closes everything above deck level.
    // Retaining the former high plinth here creates two coplanar opaque faces.
    const endPlinthTop = u === length ? entrance.base : data.sill;
    quad(
      stone,
      [
        at(u, 7.65, 0),
        at(u, 7.65, u === length ? entrance.back : 3),
        at(u, endPlinthTop, u === length ? entrance.back : 3),
        at(u, endPlinthTop, 0),
      ],
      endNormal,
    );
    for (let k = 1; k < sections.length; k++) {
      const a = sections[k - 1],
        b = sections[k];
      if (u === length && k === 1) continue;
      quad(
        endGlasses[endIndex],
        [
          at(u, a.y, 0),
          at(u, a.y, a.outward),
          at(u, b.y, b.outward),
          at(u, b.y, 0),
        ],
        endNormal,
      );
    }
    beam(at(u, data.sill, 0), at(u, data.crown, 0), 0.14);
    if (u !== length) beam(at(u, data.sill, 0), at(u, data.sill, 3), 0.12);
    for (const y of [10.6, 12.4, 13.7]) {
      const theta = Math.asin((y - data.spring) / (data.crown - data.spring)),
        o = y <= data.spring ? 3 : 3 * Math.cos(theta);
      beam(at(u, y, 0), at(u, y, o), 0.07);
    }
  }
  // Southern lower entrance: closed recessed circulation frontage, not a
  // fictitious at-grade door pair. Roof attaches beneath the existing spring.
  const E = entrance;
  const roofY = (o: number) =>
    E.roofBackY +
    ((o - E.roofBack) / (E.roofFront - E.roofBack)) *
      (E.roofFrontY - E.roofBackY);
  const roofNormal = up
    .clone()
    .addScaledVector(
      out,
      (E.roofBackY - E.roofFrontY) / (E.roofFront - E.roofBack),
    )
    .normalize();
  const entranceRoofGlass = glass.clone(); // separate paired mesh: correct roof sorting
  const roofStations = Array.from(
    { length: 8 },
    (_, i) => E.start + ((E.end - E.start) * i) / 7,
  );
  for (let i = 1; i < roofStations.length; i++) {
    const l = roofStations[i - 1],
      r = roofStations[i];
    quad(
      entranceRoofGlass,
      [
        at(l, roofY(2.6), 2.6),
        at(r, roofY(2.6), 2.6),
        at(r, roofY(4), 4),
        at(l, roofY(4), 4),
      ],
      roofNormal,
    );
    // Recessed lower panes share the accepted optical pair; no old pane behind.
    quad(
      glass,
      [
        at(l, E.sill, E.front),
        at(r, E.sill, E.front),
        at(r, roofY(E.front) - 0.06, E.front),
        at(l, roofY(E.front) - 0.06, E.front),
      ],
      out,
    );
  }
  for (const u of roofStations) {
    beam(
      at(u, roofY(2.6), 2.6),
      at(u, roofY(4), 4),
      u === E.start || u === E.end ? 0.12 : 0.065,
    );
    beam(at(u, E.base, E.front), at(u, roofY(E.front), E.front), 0.075);
    // Short bearing into the existing spring frame; no post in public walk.
    beam(at(u, roofY(3) - 0.055, 3), at(u, data.spring, 3), 0.07);
  }
  for (const o of [2.6, 4])
    beam(at(E.start, roofY(o), o), at(E.end, roofY(o), o), 0.12);
  beam(at(E.start, E.sill, E.front), at(E.end, E.sill, E.front), 0.075);
  // Closed shallow lining volume; old8.65 floor retained only behind this back.
  quad(
    lining,
    [
      at(E.start, E.base, E.back),
      at(returnBack, E.base, E.back),
      at(returnBack, E.roofBackY, E.back),
      at(E.start, E.roofBackY, E.back),
    ],
    out,
  );
  quad(
    lining,
    [
      at(E.start, E.base, E.back),
      at(E.end, E.base, E.back),
      at(E.end, E.base, 3),
      at(E.start, E.base, 3),
    ],
    up,
  );
  quad(
    lining,
    [
      at(E.start, E.roofBackY, E.back),
      at(E.end, E.roofBackY, E.back),
      at(E.end, E.roofBackY, E.front),
      at(E.start, E.roofBackY, E.front),
    ],
    up.clone().negate(),
  );
  quad(
    lining,
    [
      at(E.start, data.sill, 0),
      at(returnBack, data.sill, 0),
      at(returnBack, data.sill, E.back),
      at(E.start, data.sill, E.back),
    ],
    up,
  );
  quad(
    stone,
    [
      at(E.start, E.base, E.front),
      at(E.end, E.base, E.front),
      at(E.end, E.sill, E.front),
      at(E.start, E.sill, E.front),
    ],
    out,
  );
  // Seal the thin band between projecting roof and unchanged curved spring.
  quad(
    frame,
    [
      at(E.start, roofY(3), 3),
      at(E.end, roofY(3), 3),
      at(E.end, data.spring, 3),
      at(E.start, data.spring, 3),
    ],
    out,
  );
  for (const u of [E.start, E.end]) {
    const n = along.clone().multiplyScalar(u === E.start ? -1 : 1);
    // Inward closure at ends joins original source-facing backing as well.
    if (u === E.start)
      quad(
        lining,
        [
          at(u, E.base, 0),
          at(u, E.base, E.front),
          at(u, E.roofBackY, E.front),
          at(u, E.roofBackY, 0),
        ],
        n,
      );
    quad(
      stone,
      [
        at(u, E.base, E.front),
        at(u, E.base, 3),
        at(u, E.sill, 3),
        at(u, E.sill, E.front),
      ],
      n,
    );
    quad(
      glass,
      [
        at(u, E.sill, E.front),
        at(u, E.sill, 3),
        at(u, roofY(3), 3),
        at(u, roofY(E.front), E.front),
      ],
      n,
    );
    beam(at(u, E.base, E.front), at(u, roofY(E.front), E.front), 0.12);
  }
  // Photographed lower end is framed glazing; preserve a closed exterior
  // with a real700mm cavity instead of the former coplanar grey closure.
  const southNormal = along.clone();
  for (const [l, r] of [
    [0, 1.3],
    [1.3, E.front],
  ])
    quad(
      endGlasses[1],
      [
        at(E.end, E.sill, l),
        at(E.end, E.sill, r),
        at(E.end, returnHead, r),
        at(E.end, returnHead, l),
      ],
      southNormal,
    );
  quad(
    stone,
    [
      at(E.end, E.base, 0),
      at(E.end, E.base, E.front),
      at(E.end, E.sill, E.front),
      at(E.end, E.sill, 0),
    ],
    southNormal,
  );
  quad(
    lining,
    [
      at(returnBack, E.sill, 0),
      at(returnBack, E.sill, E.front),
      at(returnBack, returnHead, E.front),
      at(returnBack, returnHead, 0),
    ],
    southNormal,
  );
  // Closed base/head/side returns. Only the first90mm rebate is pale.
  for (const [front, back, mat] of [
    [E.end, E.end - 0.09, frame],
    [E.end - 0.09, returnBack, lining],
  ] as const) {
    quad(
      mat,
      [
        at(front, E.sill, 0),
        at(front, E.sill, E.front),
        at(back, E.sill, E.front),
        at(back, E.sill, 0),
      ],
      up,
    );
    quad(
      mat,
      [
        at(front, returnHead, 0),
        at(front, returnHead, E.front),
        at(back, returnHead, E.front),
        at(back, returnHead, 0),
      ],
      up.clone().negate(),
    );
    for (const o of mat === frame ? [0.04, E.front - 0.04] : [0.04])
      quad(
        mat,
        [
          at(front, E.sill, o),
          at(back, E.sill, o),
          at(back, returnHead, o),
          at(front, returnHead, o),
        ],
        out.clone().multiplyScalar(o < 0.1 ? 1 : -1),
      );
  }
  for (const o of [0, 1.3, E.front])
    beam(
      at(E.end, E.sill, o),
      at(E.end, returnHead, o),
      o === 1.3 ? 0.075 : 0.12,
    );
  for (const y of [E.sill, returnHead])
    beam(at(E.end, y, 0), at(E.end, y, E.front), 0.12);
  // Opaque narrow header closes the gap into the existing upper end frame.
  quad(
    frame,
    [
      at(E.end, returnHead, 0),
      at(E.end, returnHead, E.front),
      at(E.end, data.spring, E.front),
      at(E.end, data.spring, 0),
    ],
    southNormal,
  );
  // Continuous crown flashing engages the original slab edge; its underside is
  // visible and front-sided. No source opaque wall remains behind curved panes.
  beam(at(0, data.crown, 0), at(length, data.crown, 0), 0.18, stone);
  quad(
    stone,
    [
      at(0, data.crown - 0.09, -0.15),
      at(length, data.crown - 0.09, -0.15),
      at(length, data.crown - 0.09, 0.1),
      at(0, data.crown - 0.09, 0.1),
    ],
    up.clone().negate(),
  );
  const meshes: T.Mesh[] = [];
  for (const [m, q] of groups) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(q.n, 3));
    g.setIndex(q.ix);
    landmarkSurfaceUV(g, [4, 4]);
    const isGlass =
      m === glass ||
      m === entranceRoofGlass ||
      endGlasses.includes(m as T.MeshStandardMaterial);
    const mesh = isGlass
      ? createCanadaPlaceCanopyGlazingMesh(g, glazingPair)
      : new T.Mesh(g, m);
    if (isGlass) g.dispose();
    else {
      mesh.name = m.name;
      mesh.castShadow = true;
    }
    mesh.receiveShadow = true;
    root.add(mesh);
    meshes.push(mesh);
  }
  glass.dispose();
  endGlasses.forEach((m) => m.dispose());
  return meshes;
}
