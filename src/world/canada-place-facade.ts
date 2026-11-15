import { addCanadaPlaceSolidBays } from "./canada-place-solid-bays";
import {
  canadaPlaceSolidBayAt,
  canadaPlaceUpperFasciaAt,
  CANADA_PLACE_DOOR_INTERVALS,
} from "./canada-place-concourse-layout";
import { CanadaPlaceGlazingDepth } from "./canada-place-glazing-depth";
import { addCanadaPlaceDoorFrontage } from "./canada-place-door-frontage";
import { createCanadaPlaceConcourseGlass } from "./canada-place-concourse-glass";
import * as T from "three";
import concourse from "./canada-place-concourse-data.json";
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
export const CANADA_PLACE_CONCOURSE_FOOTPRINTS = [concourse.worldFootprint];
export const CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS = [
  concourse.groundWorldFootprint,
];
/** Source-local bounds; landmark placement adds its existing +0.08m Y. */
export const CANADA_PLACE_CONCOURSE_GROUND_BOUNDS = {
  baseY: concourse.groundGlassBaseY,
  headY: concourse.groundGlassHeadY,
  outward: concourse.groundOutward,
};
export const CANADA_PLACE_CONCOURSE_PROFILE = concourse.profile;
export const CANADA_PLACE_CONCOURSE_STATIONS = concourse.stations;
export function canadaPlaceConcoursePoint(
  station: number,
  outward: number,
  y: number,
): T.Vector3 {
  const points = concourse.stations;
  let i = 1;
  while (i < points.length - 1 && points[i].s < station) i++;
  const a = points[i - 1],
    b = points[i],
    t = Math.max(0, Math.min(1, (station - a.s) / (b.s - a.s)));
  const x = a.x + (b.x - a.x) * t,
    z = a.z + (b.z - a.z) * t,
    nx = a.nx + (b.nx - a.nx) * t,
    nz = a.nz + (b.nz - a.nz) * t;
  return new T.Vector3(x + nx * outward, y, z + nz * outward);
}
/** The full west strip is a continuous three-step section. Highest glazing is
 * concentrated in one broad central stretch; end fascias are upright solid sections. Exact
 * transition stations/sections are estimates from the documented photos. */
/** Three upper material batches plus the ground-door assembly. The landmark
 * loader attaches the existing local reflection capture to the receiving panes. */
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
  const glass = createCanadaPlaceConcourseGlass();
  const endGlass = glass.clone();
  endGlass.name = "canada-west-closed-end-glass";
  endGlass.transparent = false;
  endGlass.opacity = 1;
  endGlass.depthWrite = true;
  endGlass.userData.castShadow = true;
  const upperFrame = frame.clone();
  upperFrame.name = "canada-west-pale-upper-frame";
  upperFrame.color.setHex(0xa8b4a3);
  const depth = new CanadaPlaceGlazingDepth();
  for (const [name, m] of [
    ["canada-west-wall", wall],
    ["canada-west-frame", frame],
    ["canada-west-glass", glass],
  ] as const) {
    m.name = name;
    m.side = T.FrontSide;
    if (m !== glass) {
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
    }
  }
  const groups = new Map<
    T.Material,
    { p: number[]; ix: number[]; n: Map<number, V> }
  >();
  function quad(m: T.Material, v: V[], normal: V, smooth?: V[]) {
    const n = new T.Vector3().crossVectors(
      new T.Vector3(...v[1]).sub(new T.Vector3(...v[0])),
      new T.Vector3(...v[2]).sub(new T.Vector3(...v[0])),
    );
    if (n.dot(new T.Vector3(...normal)) < 0) {
      v = [v[0], v[3], v[2], v[1]];
      if (smooth) smooth = [smooth[0], smooth[3], smooth[2], smooth[1]];
    }
    let g = groups.get(m);
    if (!g) groups.set(m, (g = { p: [], ix: [], n: new Map() }));
    const k = g.p.length / 3;
    g.p.push(...v.flat());
    if (smooth) smooth.forEach((normal, j) => g.n.set(k + j, normal));
    g.ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const stations = concourse.stations,
    profile = concourse.profile;
  const at = (i: number, k: number, fascia = false): V =>
    canadaPlaceConcoursePoint(
      stations[i].s,
      (k === 0
        ? concourse.groundOutward
        : fascia && k >= 18 && k <= 25
          ? profile[17][0]
          : profile[k][0]) * stations[i].scale,
      profile[k][1],
    ).toArray() as V;
  const beam = (a: V, b: V, width = 0.065) => {
    const p = new T.Vector3(...a),
      q = new T.Vector3(...b),
      v = q.clone().sub(p);
    if (v.length() < 0.0001) return;
    const geom = new T.BoxGeometry(width, v.length(), width);
    geom.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    geom.translate(...p.add(q).multiplyScalar(0.5).toArray());
    let g = groups.get(upperFrame);
    if (!g) groups.set(upperFrame, (g = { p: [], ix: [], n: new Map() }));
    const offset = g.p.length / 3,
      ix = geom.getIndex()!;
    g.p.push(...Array.from(geom.getAttribute("position").array));
    for (let i = 0; i < ix.count; i++) g.ix.push(offset + ix.getX(i));
    geom.dispose();
  };
  const scaleAt = (s: number) => {
    let i = 1;
    while (i < stations.length - 1 && stations[i].s < s) i++;
    const a = stations[i - 1],
      b = stations[i],
      t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
    return a.scale + (b.scale - a.scale) * t;
  };
  // Separate analytic normals per quarter-round: smooth within a pane ribbon,
  // but never across the physical tier reset, end cap or upper terrace crease.
  const curveNormal = (i: number, k: number, tier: number): V => {
    const st = stations[i],
      theta = (((k - (1 + tier * 8)) / 8) * Math.PI) / 2,
      [out, y] = profile[k];
    const lo = Math.max(0, st.s - 0.01),
      hi = Math.min(concourse.length, st.s + 0.01);
    const along = canadaPlaceConcoursePoint(hi, out * scaleAt(hi), y).sub(
      canadaPlaceConcoursePoint(lo, out * scaleAt(lo), y),
    );
    const tangent = new T.Vector3(
      st.nx * (((-2.3 * 14.4) / 14.8) * Math.sin(theta) * st.scale),
      2.3 * Math.cos(theta),
      st.nz * (((-2.3 * 14.4) / 14.8) * Math.sin(theta) * st.scale),
    );
    return tangent.cross(along).normalize().toArray() as V;
  };
  for (let i = 1; i < stations.length; i++) {
    const middle = (stations[i - 1].s + stations[i].s) / 2;
    if (canadaPlaceSolidBayAt(middle)) continue;
    const fasciaSection = canadaPlaceUpperFasciaAt(middle);
    const sectionAt = (j: number, k: number) => at(j, k, fasciaSection);
    for (let k = 2; k < profile.length; k++) {
      const [rawA, ya] = profile[k - 1],
        [rawB, yb] = profile[k];
      const oa =
        fasciaSection && k - 1 >= 18 && k - 1 <= 25 ? profile[17][0] : rawA;
      const ob = fasciaSection && k >= 18 && k <= 25 ? profile[17][0] : rawB;
      const roof = k === profile.length - 2,
        back = k === profile.length - 1;
      const upperFascia = k > 17 && fasciaSection;
      const m = roof || back || upperFascia ? wall : glass;
      const nx = (stations[i].nx + stations[i - 1].nx) / 2,
        nz = (stations[i].nz + stations[i - 1].nz) / 2;
      const outward: V = back
        ? [-nx, 0, -nz]
        : [nx * (yb - ya), oa - ob, nz * (yb - ya)];
      const lowerA = sectionAt(i - 1, k - 1),
        lowerB = sectionAt(i, k - 1);
      const tier = Math.floor((k - 2) / 8);
      const smooth =
        m === glass && k >= 2 && k <= 25
          ? [
              curveNormal(i - 1, k - 1, tier),
              curveNormal(i, k - 1, tier),
              curveNormal(i, k, tier),
              curveNormal(i - 1, k, tier),
            ]
          : undefined;
      const upperA = sectionAt(i - 1, k),
        upperB = sectionAt(i, k);
      quad(m, [lowerA, lowerB, upperB, upperA], outward, smooth);
      if (m === glass && smooth)
        depth.addPane(
          [lowerA, lowerB, upperB, upperA],
          smooth,
          (k - 2) % 8 === 0,
          (k - 1) % 8 === 0,
        );
      // Horizontal glazing rails follow the curved profile and station offsets.
      if (
        !back &&
        (!upperFascia || roof) &&
        (k <= 2 || (k - 1) % 2 === 0 || roof)
      )
        beam(sectionAt(i - 1, k - 1), sectionAt(i, k - 1), roof ? 0.11 : 0.045);
    }
    const doorHead = (j: number): V =>
      canadaPlaceConcoursePoint(
        stations[j].s,
        concourse.groundOutward * stations[j].scale,
        concourse.groundGlassHeadY,
      ).toArray() as V;
    quad(
      wall,
      [doorHead(i - 1), doorHead(i), at(i, 1), at(i - 1, 1)],
      [0, -1, 0],
    );
    // Grounded mineral sill at the outer doors, rather than a floating glass edge.
    const a = at(i - 1, 0),
      b = at(i, 0),
      c = [...b] as V,
      d = [...a] as V;
    c[1] += 0.17;
    d[1] += 0.17;
    quad(wall, [a, b, c, d], [stations[i].nx, 0, stations[i].nz]);
  }
  for (let i = 0; i < stations.length; i++) {
    const solidBefore = !!canadaPlaceSolidBayAt(stations[i].s - 0.001);
    const solidAfter = !!canadaPlaceSolidBayAt(stations[i].s + 0.001);
    if (solidBefore && solidAfter) continue;
    const bayBoundary = solidBefore !== solidAfter;
    // Finish the projecting glass-side perimeter, not the recessed wall plane.
    const glassStation =
      stations[i].s + (solidBefore ? 0.001 : solidAfter ? -0.001 : 0);
    const fascia = canadaPlaceUpperFasciaAt(glassStation);
    for (let k = 2; k < profile.length - 1; k++) {
      if (fascia && k > 17 && k < 26) continue;
      beam(
        at(i, k - 1, fascia),
        at(i, k, fascia),
        bayBoundary || i === 0 || i === stations.length - 1 ? 0.1 : 0.055,
      );
    }
  }
  // Solid cheek returns close the difference between upright fascia and curved
  // glazing at the two explicitly estimated longitudinal transitions.
  const cheek = [...profile.slice(17, 26), [profile[17][0], profile[25][1]]];
  const cheekTriangles = T.ShapeUtils.triangulateShape(
    cheek.map(([o, y]) => new T.Vector2(o, y)),
    [],
  );
  const fasciaTransitions = concourse.upperFasciaRanges
    .flat()
    .filter(
      (s) =>
        s > 0 &&
        s < concourse.length &&
        !canadaPlaceSolidBayAt(s - 0.001) &&
        !canadaPlaceSolidBayAt(s + 0.001),
    );
  for (const boundary of fasciaTransitions) {
    const i = stations.findIndex((st) => Math.abs(st.s - boundary) < 0.0001);
    const st = stations[i];
    const sign = canadaPlaceUpperFasciaAt(boundary - 0.001) ? 1 : -1;
    const n: V = [-st.nz * sign, 0, st.nx * sign];
    for (const tri of cheekTriangles) {
      const v = tri.map(
        (j) =>
          canadaPlaceConcoursePoint(
            st.s,
            cheek[j][0] * st.scale,
            cheek[j][1],
          ).toArray() as V,
      );
      quad(wall, [v[0], v[1], v[2], v[2]], n);
    }
  }
  // Opaque lateral returns join recessed full-height bays to the adjacent
  // projecting glass/door section; no invisible ground barrier remains outside.
  for (const [a, b] of concourse.solidBays)
    for (const boundary of [a, b]) {
      const i = stations.findIndex((st) => Math.abs(st.s - boundary) < 0.00001),
        st = stations[i];
      const fascia = canadaPlaceUpperFasciaAt(
        boundary + (boundary === a ? -0.001 : 0.001),
      );
      const capProfile = [
        [concourse.groundOutward, 7.8],
        [concourse.groundOutward, concourse.groundGlassHeadY],
        ...profile
          .slice(1, 26)
          .map(([o, y], j) => [
            Math.max(
              fascia && j + 1 >= 18 ? profile[17][0] : o,
              concourse.solidBayOutward,
            ),
            y,
          ]),
        [0, 17.65],
        [0, 7.8],
      ];
      const triangles = T.ShapeUtils.triangulateShape(
        capProfile.map(([o, y]) => new T.Vector2(o, y)),
        [],
      );
      const sign = boundary === a ? 1 : -1,
        n: V = [-st.nz * sign, 0, st.nx * sign];
      for (const tri of triangles) {
        const v = tri.map(
          (k) =>
            canadaPlaceConcoursePoint(
              boundary,
              capProfile[k][0] * st.scale,
              capProfile[k][1],
            ).toArray() as V,
        );
        quad(wall, [v[0], v[1], v[2], v[2]], n);
      }
    }
  // Closed glazed ends expose the tiered section, with tapered plan depth and
  // opaque upper fascia instead of a fifteen-metre blank end wall.
  const endProfile = [
    [concourse.groundOutward, profile[0][1]],
    [concourse.groundOutward, concourse.groundGlassHeadY],
    ...profile
      .slice(1)
      .map(([o, y], j) => [j + 1 >= 18 && j + 1 <= 25 ? profile[17][0] : o, y]),
  ];
  const triangles = T.ShapeUtils.triangulateShape(
    endProfile.map(([o, y]) => new T.Vector2(o, y)),
    [],
  );
  for (const i of [0, stations.length - 1]) {
    const near = stations[i === 0 ? 1 : i - 1],
      here = stations[i];
    const direction: V = [here.x - near.x, 0, here.z - near.z];
    for (const tri of triangles) {
      const v = tri.map(
        (k) =>
          canadaPlaceConcoursePoint(
            here.s,
            endProfile[k][0] * here.scale,
            endProfile[k][1],
          ).toArray() as V,
      );
      quad(endGlass, [v[0], v[1], v[2], v[2]], direction);
    }
  }
  const meshes: T.Mesh[] = [];
  for (const [m, q] of groups) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    const normal = g.getAttribute("normal");
    for (const [i, n] of q.n) normal.setXYZ(i, ...n);
    landmarkSurfaceUV(g, [4, 4]);
    const mesh = new T.Mesh(g, m);
    mesh.name = m.name;
    mesh.castShadow = m.userData.castShadow !== false;
    mesh.receiveShadow = true;
    root.add(mesh);
    meshes.push(mesh);
  }
  meshes.push(depth.finish(root));
  meshes.push(
    ...addCanadaPlaceSolidBays(root, wall, (s, out, y) =>
      canadaPlaceConcoursePoint(s, out * scaleAt(s), y),
    ),
  );
  const doors = addCanadaPlaceDoorFrontage(
    root,
    { glass: source.get("door-glass") ?? endGlass, frame },
    (s, y, offset) =>
      canadaPlaceConcoursePoint(
        s,
        concourse.groundOutward * scaleAt(s) + offset,
        y,
      ),
    stations.map((st) => st.s),
    CANADA_PLACE_DOOR_INTERVALS,
  );
  return [...meshes, ...doors];
}
