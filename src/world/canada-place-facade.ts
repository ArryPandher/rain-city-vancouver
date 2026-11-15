import * as T from "three";
import site from "./canada-place-deck-data.json";
import { landmarkSurfaceUV } from "./landmark-surfaces";

/** Source-local metres. Only the trail-facing [0,1] edge of each sail podium.
 * Proportions are a bounded interpretation of pedestrian photographs, not a survey. */
export const CANADA_PLACE_WEST_FACES = site.sails.map((ring, index) => {
  const a = ring[0],
    b = ring[1],
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const area = ring.reduce(
    (s, p, i) =>
      s +
      p[0] * ring[(i + 1) % ring.length][1] -
      ring[(i + 1) % ring.length][0] * p[1],
    0,
  );
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    index,
    a,
    b,
    length,
    dx,
    dz,
    nx: area > 0 ? dz : -dz,
    nz: area > 0 ? -dx : dx,
    bays: Math.max(1, Math.round(length / 4.8)),
  };
});
export const CANADA_PLACE_FACADE_SOURCE = {
  file: "public/models/vancouver/canada-place.glb",
  sha256: "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  counts: {
    concrete: [8368, 11154],
    glass: [2424, 3384],
    trim: [34749, 54198],
  },
};
export function canadaPlaceFacadeCompatible(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const found = new Set<string>();
  let valid = true;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const name = (o.material as T.Material).name;
    const counts =
      CANADA_PLACE_FACADE_SOURCE.counts[
        name as keyof typeof CANADA_PLACE_FACADE_SOURCE.counts
      ];
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
    const p = o.geometry.getAttribute("position");
    const decoded = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++)
      decoded.set([p.getX(i), p.getY(i), p.getZ(i)], i * 3);
    const probe = new T.BufferGeometry().setAttribute(
      "position",
      new T.BufferAttribute(decoded, 3),
    );
    probe.setIndex(Array.from(o.geometry.getIndex()!.array));
    probe.applyMatrix4(o.matrixWorld);
    const expected = { concrete: 10, glass: 100, trim: 480 }[
      name as "concrete" | "glass" | "trim"
    ];
    if (replaceCanadaPlaceWestFaces(probe, name) !== expected) valid = false;
    probe.dispose();
  });
  return valid && found.size === 3;
}
/** Index-only removal; no source vertex, UV, sail, mast or lower pier is moved. */
export function replaceCanadaPlaceWestFaces(
  g: T.BufferGeometry,
  material: string,
) {
  if (!["concrete", "glass", "trim"].includes(material)) return 0;
  const p = g.getAttribute("position"),
    ix = g.getIndex(),
    kept: number[] = [];
  let removed = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j));
    const selected = CANADA_PLACE_WEST_FACES.some((f) => {
      const v = ids.map((j) => ({
        u: (p.getX(j) - f.a[0]) * f.dx + (p.getZ(j) - f.a[1]) * f.dz,
        o: (p.getX(j) - f.a[0]) * f.nx + (p.getZ(j) - f.a[1]) * f.nz,
        y: p.getY(j),
      }));
      if (material === "concrete")
        return (
          v.every(
            (q) =>
              q.u >= -0.012 &&
              q.u <= f.length + 0.012 &&
              Math.abs(q.o) < 0.012 &&
              q.y >= 7.638 &&
              q.y <= 17.662,
          ) &&
          Math.max(...v.map((q) => q.y)) - Math.min(...v.map((q) => q.y)) > 9.9
        );
      if (material === "glass")
        return v.every(
          (q) =>
            q.u >= -0.012 &&
            q.u <= f.length + 0.012 &&
            q.o >= 0.18 &&
            q.o <= 0.22 &&
            q.y >= 10.08 &&
            q.y <= 16.72,
        );
      // The existing projecting trim boxes terminate up to0.30m beyond each
      // face endpoint. Rotated horizontal bars extend beyond their nominal half-width;
      // decoded source vertices reach o=.80 and y=17.92. Membrane trim stays above18.
      return v.every(
        (q) =>
          q.u >= -0.31 &&
          q.u <= f.length + 0.31 &&
          q.o >= -0.06 &&
          q.o <= 0.83 &&
          q.y >= 8.0 &&
          q.y <= 17.94,
      );
    });
    if (selected) removed++;
    else kept.push(...ids);
  }
  g.setIndex(kept);
  return removed;
}
type V = [number, number, number];
export type CanadaPlaceFacadeOpening = {
  face: number;
  l: number;
  r: number;
  b: number;
  t: number;
  depth: number;
};
export const CANADA_PLACE_FACADE_OPENINGS: CanadaPlaceFacadeOpening[] =
  CANADA_PLACE_WEST_FACES.flatMap((f) => {
    const step = f.length / f.bays;
    return Array.from({ length: f.bays }, (_, i) => [
      {
        face: f.index,
        l: i * step + 0.19,
        r: (i + 1) * step - 0.19,
        b: 8.65,
        t: 12.15,
        depth: 0.34,
      },
      {
        face: f.index,
        l: i * step + 0.19,
        r: (i + 1) * step - 0.19,
        b: 15,
        t: 16.7,
        depth: 0.34,
      },
    ]).flat();
  });
export function canadaPlaceFacadePoint(
  face: number,
  u: number,
  y: number,
  depth = 0,
): T.Vector3 {
  const f = CANADA_PLACE_WEST_FACES[face];
  return new T.Vector3(
    f.a[0] + f.dx * u - f.nx * depth,
    y,
    f.a[1] + f.dz * u - f.nz * depth,
  );
}
/** Three shared material batches, opaque-backed reflective panes; no interiors,
 * probes, random room lights or changes to the rest of the landmark materials. */
export function addCanadaPlaceWestFacade(
  root: T.Group,
  source: Map<string, T.MeshStandardMaterial>,
) {
  const wall = (
    source.get("concrete") ??
    new T.MeshStandardMaterial({ color: 0xc9ceca, roughness: 0.8 })
  ).clone();
  if (source.has("concrete")) {
    wall.onBeforeCompile = source.get("concrete")!.onBeforeCompile;
    wall.customProgramCacheKey = source.get("concrete")!.customProgramCacheKey;
  }
  const frame = (source.get("trim") ?? new T.MeshStandardMaterial()).clone();
  frame.map = frame.normalMap = frame.roughnessMap = null;
  frame.color.setHex(0x77918a);
  frame.roughness = 0.38;
  frame.metalness = 0.25;
  const glass = (source.get("glass") ?? new T.MeshStandardMaterial()).clone();
  glass.color.setHex(0x91aaa2);
  glass.roughness = 0.14;
  glass.metalness = 0.58;
  glass.envMapIntensity = 1.65;
  for (const [name, m] of [
    ["canada-west-wall", wall],
    ["canada-west-frame", frame],
    ["canada-west-glass", glass],
  ] as const) {
    m.name = name;
    m.side = T.FrontSide;
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
  }
  const groups = new Map<T.Material, { p: number[]; ix: number[] }>();
  function quad(m: T.Material, v: V[], normal: V) {
    const n = new T.Vector3().crossVectors(
      new T.Vector3(...v[1]).sub(new T.Vector3(...v[0])),
      new T.Vector3(...v[2]).sub(new T.Vector3(...v[0])),
    );
    if (n.dot(new T.Vector3(...normal)) < 0) v = [v[0], v[3], v[2], v[1]];
    let g = groups.get(m);
    if (!g) groups.set(m, (g = { p: [], ix: [] }));
    const k = g.p.length / 3;
    g.p.push(...v.flat());
    g.ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  for (const f of CANADA_PLACE_WEST_FACES) {
    const at = (u: number, y: number, d = 0) =>
      canadaPlaceFacadePoint(f.index, u, y, d).toArray() as V;
    const front = (
      m: T.Material,
      l: number,
      r: number,
      b: number,
      t: number,
      d = 0,
    ) =>
      quad(
        m,
        [at(l, b, d), at(r, b, d), at(r, t, d), at(l, t, d)],
        [f.nx, 0, f.nz],
      );
    const box = (
      m: T.Material,
      l: number,
      r: number,
      b: number,
      t: number,
      frontD: number,
      backD: number,
    ) => {
      front(m, l, r, b, t, frontD);
      quad(
        m,
        [at(l, b, frontD), at(l, t, frontD), at(l, t, backD), at(l, b, backD)],
        [-f.dx, 0, -f.dz],
      );
      quad(
        m,
        [at(r, b, frontD), at(r, t, frontD), at(r, t, backD), at(r, b, backD)],
        [f.dx, 0, f.dz],
      );
      quad(
        m,
        [at(l, t, frontD), at(r, t, frontD), at(r, t, backD), at(l, t, backD)],
        [0, 1, 0],
      );
      quad(
        m,
        [at(l, b, frontD), at(r, b, frontD), at(r, b, backD), at(l, b, backD)],
        [0, -1, 0],
      );
    };
    const holes = CANADA_PLACE_FACADE_OPENINGS.filter(
      (h) => h.face === f.index,
    );
    const xs = [
      ...new Set([0, f.length, ...holes.flatMap((h) => [h.l, h.r])]),
    ].sort((a, b) => a - b);
    const ys = [
      ...new Set([7.65, 17.65, ...holes.flatMap((h) => [h.b, h.t])]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        const l = xs[i - 1],
          r = xs[i],
          b = ys[j - 1],
          t = ys[j];
        if (
          !holes.some(
            (h) =>
              (l + r) / 2 > h.l &&
              (l + r) / 2 < h.r &&
              (b + t) / 2 > h.b &&
              (b + t) / 2 < h.t,
          )
        )
          front(wall, l, r, b, t);
      }
    for (const h of holes) {
      const { l, r, b, t, depth } = h;
      front(glass, l, r, b, t, depth);
      // Reveal normals point INTO the aperture, observable from the trail.
      quad(
        wall,
        [at(l, b), at(l, t), at(l, t, depth), at(l, b, depth)],
        [f.dx, 0, f.dz],
      );
      quad(
        wall,
        [at(r, b), at(r, t), at(r, t, depth), at(r, b, depth)],
        [-f.dx, 0, -f.dz],
      );
      quad(
        wall,
        [at(l, t), at(r, t), at(r, t, depth), at(l, t, depth)],
        [0, -1, 0],
      );
      quad(
        wall,
        [at(l, b), at(r, b), at(r, b, depth), at(l, b, depth)],
        [0, 1, 0],
      );
      // Slender perimeter and secondary lights at approximately1.35m centres.
      const lights = Math.max(1, Math.round((r - l) / 1.35));
      for (let i = 0; i <= lights; i++) {
        const u = l + ((r - l) * i) / lights;
        box(
          frame,
          Math.max(l, u - 0.035),
          Math.min(r, u + 0.035),
          b,
          t,
          depth - 0.075,
          depth - 0.005,
        );
      }
      for (const y of [b, t])
        box(
          frame,
          l,
          r,
          Math.max(b, y - 0.035),
          Math.min(t, y + 0.035),
          depth - 0.075,
          depth - 0.005,
        );
      box(
        frame,
        l,
        r,
        (b + t) / 2 - 0.025,
        (b + t) / 2 + 0.025,
        depth - 0.06,
        depth - 0.005,
      );
      box(wall, l - 0.06, r + 0.06, b - 0.09, b, -0.075, 0.05);
    }
    // A restrained continuous head and slab-edge spandrel, replacing .6m bars.
    box(wall, 0, f.length, 14.25, 14.45, -0.07, 0.06);
    box(wall, 0, f.length, 17.38, 17.55, -0.08, 0.05);
  }
  const meshes: T.Mesh[] = [];
  for (const [m, q] of groups) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    landmarkSurfaceUV(g, [4, 4]);
    const mesh = new T.Mesh(g, m);
    mesh.name = m.name;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
