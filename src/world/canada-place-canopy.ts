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
/** One anchored entrance conservatory. Local model datum, three static batches;
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
  const frame = new T.MeshStandardMaterial({
    color: 0x93aca1,
    roughness: 0.36,
    metalness: 0.28,
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
      at(length, s.y, s.outward + 0.05),
      0.085,
    );
  }
  // Solid plinth and its capped threshold contact the unchanged source deck.
  quad(
    stone,
    [
      at(0, 7.65, 3),
      at(length, 7.65, 3),
      at(length, data.sill, 3),
      at(0, data.sill, 3),
    ],
    out,
  );
  quad(
    stone,
    [
      at(0, data.sill, 0),
      at(length, data.sill, 0),
      at(length, data.sill, 3),
      at(0, data.sill, 3),
    ],
    up,
  );
  // Both end walls are real glazed polygons, closed to the original HOTEL wall.
  for (const u of [0, length]) {
    const endNormal = along.clone().multiplyScalar(u === 0 ? -1 : 1);
    quad(
      stone,
      [
        at(u, 7.65, 0),
        at(u, 7.65, 3),
        at(u, data.sill, 3),
        at(u, data.sill, 0),
      ],
      endNormal,
    );
    for (let k = 1; k < sections.length; k++) {
      const a = sections[k - 1],
        b = sections[k];
      quad(
        glass,
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
    beam(at(u, data.sill, 0), at(u, data.sill, 3), 0.12);
    for (const y of [10.6, 12.4, 13.7]) {
      const theta = Math.asin((y - data.spring) / (data.crown - data.spring)),
        o = y <= data.spring ? 3 : 3 * Math.cos(theta);
      beam(at(u, y, 0), at(u, y, o), 0.07);
    }
  }
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
    const mesh = new T.Mesh(g, m);
    mesh.name = m.name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
