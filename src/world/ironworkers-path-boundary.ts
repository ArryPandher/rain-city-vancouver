import * as T from "three";
import {
  IRONWORKERS_ALIGNMENT as A,
  IRONWORKERS_DECK_STATIONS,
  IRONWORKERS_PLAN_LENGTH as LENGTH,
  ironworkersPoint,
  ironworkersFrame,
  ironworkersGradeT,
  ironworkersTAtDistance,
} from "./ironworkers-alignment";

type V = [number, number, number];
type P = [number, number];
export type PathTriangle = [V, V, V];
/** Only path width/fence height are documented; member sections are photo estimates.
 * Candidate only: this module is deliberately not imported by the live scene. */
export const IRONWORKERS_PATH = {
  inner: 15.3,
  outer: 17.8,
  rise: 0.12,
  approachFinish: 0.07,
  fenceSide: 17.85,
  fenceHeight: 3,
  picketPitch: 0.13,
  picketWidth: 0.05,
  picketDepth: 0.04,
  curbSide: 15.075,
  curbWidth: 0.45,
  curbHeight: 0.4,
  chunkLength: 64,
  nearDistance: 180,
  replacedCycleways: ["w35260598", "w62125826"],
} as const;
/** Exact vertices of the external mapped approaches, not new road coordinates. */
export const IRONWORKERS_PATH_TIES = [
  {
    end: "south",
    side: -1,
    source: "w503135269",
    point: [6825, -932.7] as P,
    tangent: [6821.6, -909.2] as P,
  },
  {
    end: "south",
    side: 1,
    source: "w336869485",
    point: [6795.7, -937.9] as P,
    tangent: [6797.4, -953.2] as P,
  },
  {
    end: "north",
    side: -1,
    source: "w62125827",
    point: [6784.6, -2308.2] as P,
    tangent: [6785.7, -2327.4] as P,
  },
  {
    end: "north",
    side: 1,
    source: "w336868165",
    point: [6751.5, -2307.4] as P,
    tangent: [6744.7, -2322.9] as P,
  },
] as const;
export type IronworkersMember = {
  kind: "curb" | "rail" | "post" | "picket";
  centre: V;
  axes: [V, V, V];
  half: V;
  min: V;
  max: V;
  matrix: T.Matrix4;
  station: number;
};
function box(
  kind: IronworkersMember["kind"],
  a: V,
  b: V,
  width: number,
  depth: number,
  station: number,
): IronworkersMember {
  const along = new T.Vector3(...b).sub(new T.Vector3(...a)),
    length = along.length();
  along.divideScalar(length);
  // Vertical posts use the shared plan orientation supplied through a small x/z axis.
  const across =
    Math.abs(along.y) > 0.999
      ? new T.Vector3(1, 0, 0)
      : new T.Vector3(along.z, 0, -along.x).normalize();
  const up = new T.Vector3().crossVectors(along, across).normalize();
  const axes = [across.toArray(), up.toArray(), along.toArray()] as [V, V, V];
  const centre = a.map((v, i) => (v + b[i]) / 2) as V,
    half: V = [width / 2, depth / 2, length / 2];
  const matrix = new T.Matrix4()
    .makeBasis(across, up, along)
    .scale(new T.Vector3(width, depth, length))
    .setPosition(...centre);
  const extent = [0, 1, 2].map((i) =>
    axes.reduce((sum, v, j) => sum + Math.abs(v[i]) * half[j], 0),
  );
  return {
    kind,
    centre,
    axes,
    half,
    matrix,
    station,
    min: centre.map((v, i) => v - extent[i]) as V,
    max: centre.map((v, i) => v + extent[i]) as V,
  };
}
/** Exact sphere/OBB squared distance: finite ends and diagonal top clearance. */
export function ironworkersMemberDistanceSquared(
  m: IronworkersMember,
  x: number,
  y: number,
  z: number,
) {
  const dx = x - m.centre[0],
    dy = y - m.centre[1],
    dz = z - m.centre[2];
  let d = 0;
  for (let i = 0; i < 3; i++) {
    const a = m.axes[i],
      v = Math.max(0, Math.abs(dx * a[0] + dy * a[1] + dz * a[2]) - m.half[i]);
    d += v * v;
  }
  return d;
}
/** Exact vertical-segment/OBB minimum: squared distance is piecewise quadratic. */
function capsuleDistance(
  m: IronworkersMember,
  x: number,
  z: number,
  lo: number,
  hi: number,
) {
  const a: number[] = [],
    b: number[] = [],
    cuts = [0, 1];
  for (let i = 0; i < 3; i++) {
    const v = m.axes[i];
    a.push(
      (x - m.centre[0]) * v[0] +
        (lo - m.centre[1]) * v[1] +
        (z - m.centre[2]) * v[2],
    );
    b.push((hi - lo) * v[1]);
    if (Math.abs(b[i]) > 1e-12)
      for (const h of [-m.half[i], m.half[i]]) {
        const t = (h - a[i]) / b[i];
        if (t > 0 && t < 1) cuts.push(t);
      }
  }
  cuts.sort((a, b) => a - b);
  let best = Infinity;
  const evalAt = (t: number) => {
    let d = 0;
    for (let i = 0; i < 3; i++) {
      const v = Math.max(0, Math.abs(a[i] + b[i] * t) - m.half[i]);
      d += v * v;
    }
    best = Math.min(best, d);
  };
  for (let j = 1; j < cuts.length; j++) {
    const l = cuts[j - 1],
      h = cuts[j],
      mid = (l + h) / 2;
    let aa = 0,
      bb = 0;
    for (let i = 0; i < 3; i++) {
      const v = a[i] + b[i] * mid;
      if (Math.abs(v) > m.half[i]) {
        aa += b[i] * b[i];
        bb += b[i] * (a[i] - Math.sign(v) * m.half[i]);
      }
    }
    evalAt(l);
    evalAt(h);
    if (aa) evalAt(Math.max(l, Math.min(h, -bb / aa)));
  }
  return best;
}
function triangleHeight(x: number, z: number, [a, b, c]: PathTriangle) {
  const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-12) return undefined;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
  return u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8
    ? u * a[1] + v * b[1] + (1 - u - v) * c[1]
    : undefined;
}
function geometry(tris: PathTriangle[]) {
  const g = new T.BufferGeometry();
  g.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      tris.flatMap((tri) =>
        tri.flatMap((p) => [p[0] - 6800, p[1], p[2] + 1600]),
      ),
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
}
/** deckHeight takes the unchanged original gradeT; approachHeight takes world x/z
 * and returns the EXISTING rendered approach finish (normally ground+.07). */
export function createIronworkersPathBoundary(
  deckHeight: (t: number) => number,
  approachHeight: (x: number, z: number) => number,
) {
  const d = IRONWORKERS_PATH,
    top: PathTriangle[] = [],
    sides: PathTriangle[] = [],
    members: IronworkersMember[] = [];
  const grid = new Map<string, number[]>(),
    surfaceGrid = new Map<string, number[]>(),
    cell = 4;
  function index(
    map: Map<string, number[]>,
    id: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ) {
    for (let x = Math.floor(minX / cell); x <= Math.floor(maxX / cell); x++)
      for (let z = Math.floor(minZ / cell); z <= Math.floor(maxZ / cell); z++) {
        const key = `${x},${z}`,
          v = map.get(key);
        if (v) v.push(id);
        else map.set(key, [id]);
      }
  }
  function add(m: IronworkersMember) {
    index(grid, members.length, m.min[0], m.max[0], m.min[2], m.max[2]);
    members.push(m);
  }
  const finish = (t: number, side: number) => {
    const [x, z] = ironworkersPoint(t, side),
      s = ironworkersFrame(t).distance,
      rise =
        d.approachFinish +
        (d.rise - d.approachFinish) * Math.min(1, s / 6, (LENGTH - s) / 6);
    return deckHeight(ironworkersGradeT(x, z)) + rise;
  };
  const vertex = (t: number, side: number): V => {
    const [x, z] = ironworkersPoint(t, side);
    return [x, finish(t, side), z];
  };
  function quad(out: PathTriangle[], a: V, b: V, c: V, e: V) {
    out.push([a, b, c], [a, c, e]);
  }
  function surface(a: V, b: V, c: V, e: V) {
    const n = new T.Vector3(...b)
      .sub(new T.Vector3(...a))
      .cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (n.y < 0) [b, e] = [e, b];
    quad(top, a, b, c, e);
  }
  const stations = [
    ...new Set([
      ...IRONWORKERS_DECK_STATIONS,
      ...Array.from({ length: Math.ceil(LENGTH / 3) + 1 }, (_, i) =>
        ironworkersTAtDistance((i * LENGTH) / Math.ceil(LENGTH / 3)),
      ),
    ]),
  ].sort((a, b) => a - b);
  for (const sign of [-1, 1]) {
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1],
        b = stations[i];
      surface(
        vertex(a, sign * d.inner),
        vertex(b, sign * d.inner),
        vertex(b, sign * d.outer),
        vertex(a, sign * d.outer),
      );
      for (const side of [d.inner, d.outer]) {
        const p = vertex(a, sign * side),
          q = vertex(b, sign * side);
        quad(sides, p, q, [q[0], q[1] - 0.12, q[2]], [p[0], p[1] - 0.12, p[2]]);
      }
      const s = ironworkersFrame((a + b) / 2).distance;
      for (const [side, offset, width, depth, kind] of [
        [d.curbSide, 0.14, d.curbWidth, 0.52, "curb"],
        [d.curbSide, 0.65, 0.09, 0.07, "rail"],
        [d.curbSide, 0.95, 0.09, 0.07, "rail"],
        [d.curbSide, 1.25, 0.12, 0.1, "rail"],
        [d.fenceSide, 0.08, 0.08, 0.08, "rail"],
        [d.fenceSide, 1.1, 0.1, 0.055, "rail"],
      ] as const) {
        const p = vertex(a, sign * side),
          q = vertex(b, sign * side);
        p[1] += offset;
        q[1] += offset;
        add(box(kind, p, q, width, depth, s));
      }
    }
    // Shared side/grade registration; each picket remains a finite physical box.
    const count = Math.ceil(LENGTH / d.picketPitch);
    for (let i = 0; i <= count; i++) {
      const s = (i * LENGTH) / count,
        t = ironworkersTAtDistance(s),
        p = vertex(t, sign * d.fenceSide),
        q: [number, number, number] = [p[0], p[1] + d.fenceHeight, p[2]],
        m = box("picket", p, q, d.picketWidth, d.picketDepth, s);
      // Rotate rectangular picket section to the shared frame, retaining world-up.
      const f = ironworkersFrame(t),
        n = new T.Vector3(f.nx, 0, f.nz).normalize(),
        u = new T.Vector3(-n.z, 0, n.x);
      m.axes = [u.toArray() as V, n.toArray() as V, [0, 1, 0]];
      m.matrix
        .makeBasis(u, n, new T.Vector3(0, 1, 0))
        .scale(new T.Vector3(d.picketWidth, d.picketDepth, d.fenceHeight))
        .setPosition(...m.centre);
      for (let j = 0; j < 3; j++) {
        const extent = m.axes.reduce(
          (v, a, k) => v + Math.abs(a[j]) * m.half[k],
          0,
        );
        m.min[j] = m.centre[j] - extent;
        m.max[j] = m.centre[j] + extent;
      }
      add(m);
    }
    for (let s = 0; s <= LENGTH; s += 3) {
      const t = ironworkersTAtDistance(s),
        p = vertex(t, sign * d.curbSide);
      add(box("post", p, [p[0], p[1] + 1.3, p[2]], 0.1, 0.1, s));
    }
  }
  // Four finite finish ties, using shared deck-end edges and exact external source vertices.
  const ties = IRONWORKERS_PATH_TIES.map((tie) => {
    const t = tie.end === "south" ? stations[0] : stations.at(-1)!,
      a = vertex(t, tie.side * d.inner),
      b = vertex(t, tie.side * d.outer),
      centre = ironworkersPoint(t, (tie.side * (d.inner + d.outer)) / 2),
      q = tie.point;
    const frame = ironworkersFrame(t),
      direction = tie.end === "north" ? 1 : -1;
    const startT = new T.Vector2(
      -frame.nz * direction,
      frame.nx * direction,
    ).normalize();
    const endT = new T.Vector2(
      tie.tangent[0] - q[0],
      tie.tangent[1] - q[1],
    ).normalize();
    if (endT.dot(new T.Vector2(q[0] - centre[0], q[1] - centre[1])) < 0)
      endT.negate();
    const length = Math.hypot(q[0] - centre[0], q[1] - centre[1]),
      straight = Math.min(0.5, length / 8);
    const p0 = new T.Vector2(...centre).addScaledVector(startT, straight),
      p3 = new T.Vector2(...q).addScaledVector(endT, -straight);
    const p1 = p0.clone().addScaledVector(startT, length / 3),
      p2 = p3.clone().addScaledVector(endT, -length / 3);
    const centres: P[] = [centre];
    const n = Math.max(8, Math.ceil(length));
    for (let i = 0; i <= n; i++) {
      const f = i / n,
        g = 1 - f;
      centres.push([
        g * g * g * p0.x +
          3 * g * g * f * p1.x +
          3 * g * f * f * p2.x +
          f * f * f * p3.x,
        g * g * g * p0.y +
          3 * g * g * f * p1.y +
          3 * g * f * f * p2.y +
          f * f * f * p3.y,
      ]);
    }
    centres.push([...q]);
    const tangents = centres
      .slice(1)
      .map((p, i) =>
        new T.Vector2(p[0] - centres[i][0], p[1] - centres[i][1]).normalize(),
      );
    const dist = [0];
    centres
      .slice(1)
      .forEach((p, i) =>
        dist.push(
          dist.at(-1)! + Math.hypot(p[0] - centres[i][0], p[1] - centres[i][1]),
        ),
      );
    const orientation =
      -startT.y * (b[0] - a[0]) + startT.x * (b[2] - a[2]) > 0 ? 1 : -1;
    const sections: [V, V][] = centres.map((p, i) => {
      if (i === 0) return [a, b];
      const before = tangents[i - 1],
        after = tangents[Math.min(i, tangents.length - 1)],
        nx = -(before.y + after.y),
        nz = before.x + after.x,
        den = nx * -after.y + nz * after.x;
      const normal = new T.Vector2(nx / den, nz / den).multiplyScalar(
          orientation * 1.25,
        ),
        f = dist[i] / dist.at(-1)!;
      return [-1, 1].map((sign) => {
        const x = p[0] + sign * normal.x,
          z = p[1] + sign * normal.y,
          startY = sign < 0 ? a[1] : b[1];
        return [x, startY * (1 - f) + approachHeight(x, z) * f, z] as V;
      }) as [V, V];
    });
    for (let i = 1; i < sections.length; i++)
      surface(
        sections[i - 1][0],
        sections[i][0],
        sections[i][1],
        sections[i - 1][1],
      );
    return {
      ...tie,
      endKind: tie.end,
      start: sections[0],
      end: sections.at(-1)!,
      sections,
      centres,
    };
  });

  // Rendering uses a nearby origin; keep exact source endpoints for support.
  top.forEach((tri, i) =>
    index(
      surfaceGrid,
      i,
      Math.min(...tri.map((p) => p[0])),
      Math.max(...tri.map((p) => p[0])),
      Math.min(...tri.map((p) => p[2])),
      Math.max(...tri.map((p) => p[2])),
    ),
  );
  const supportAt = (x: number, z: number) => {
    let best: number | undefined;
    for (const i of surfaceGrid.get(
      `${Math.floor(x / cell)},${Math.floor(z / cell)}`,
    ) ?? []) {
      const h = triangleHeight(x, z, top[i]);
      if (h !== undefined && (best === undefined || h > best)) best = h;
    }
    return best;
  };
  const visited = new Uint32Array(members.length);
  let visit = 0;
  const blockedAt = (
    x: number,
    z: number,
    r: number,
    y: number,
    camera: boolean,
    bodyHeight = 1.8,
  ) => {
    if (!Number.isFinite(x + z + r + y) || r < 0) return false;
    const lo = camera ? y : y + r,
      hi = camera ? y : Math.max(lo, y + bodyHeight - r);
    visit = (visit + 1) >>> 0;
    if (visit === 0) {
      visited.fill(0);
      visit = 1;
    }
    for (
      let ix = Math.floor((x - r) / cell);
      ix <= Math.floor((x + r) / cell);
      ix++
    )
      for (
        let iz = Math.floor((z - r) / cell);
        iz <= Math.floor((z + r) / cell);
        iz++
      )
        for (const id of grid.get(`${ix},${iz}`) ?? []) {
          if (visited[id] === visit) continue;
          visited[id] = visit;
          const m = members[id];
          if (
            x + r < m.min[0] ||
            x - r > m.max[0] ||
            z + r < m.min[2] ||
            z - r > m.max[2] ||
            hi + r < m.min[1] ||
            lo - r > m.max[1]
          )
            continue;
          if (
            (camera
              ? ironworkersMemberDistanceSquared(m, x, y, z)
              : capsuleDistance(m, x, z, lo, hi)) <=
            r * r
          )
            return true;
        }
    return false;
  };
  /** Each chunk has one near instanced box batch and one far instanced flat batch.
   * Same picket centres/width/heights; distant faces retain visible spacing at2tri/picket.
   * No opacity wall and no thousands of individual Object3Ds. */
  const createRenderGroup = (concrete: T.Material, steel: T.Material) => {
    const group = new T.Group(),
      unit = new T.BoxGeometry(1, 1, 1),
      plane = new T.PlaneGeometry(1, 1),
      path = new T.Mesh(geometry([...top, ...sides]), concrete);
    path.position.set(6800, 0, -1600);
    group.add(path);
    const farMaterial = steel.clone();
    farMaterial.side = T.DoubleSide;
    farMaterial.forceSinglePass = true;
    const staticMembers = members.filter((m) => m.kind !== "picket"),
      curbs = staticMembers.filter((m) => m.kind === "curb"),
      rails = staticMembers.filter((m) => m.kind !== "curb");
    for (const [list, mat] of [
      [curbs, concrete],
      [rails, steel],
    ] as const) {
      const mesh = new T.InstancedMesh(unit, mat, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m.matrix));
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    let chunks = 0;
    for (let start = 0; start < LENGTH; start += d.chunkLength) {
      const list = members.filter(
          (m) =>
            m.kind === "picket" &&
            m.station >= start &&
            m.station < start + d.chunkLength,
        ),
        lod = new T.LOD(),
        t = ironworkersTAtDistance(Math.min(LENGTH, start + d.chunkLength / 2)),
        [x, z] = ironworkersPoint(t),
        y = deckHeight(ironworkersGradeT(x, z));
      lod.position.set(x, y, z);
      const near = new T.InstancedMesh(unit, steel, list.length),
        far = new T.InstancedMesh(plane, farMaterial, list.length),
        translation = new T.Matrix4().makeTranslation(-x, -y, -z);
      list.forEach((m, i) => {
        near.setMatrixAt(
          i,
          new T.Matrix4().multiplyMatrices(translation, m.matrix),
        );
        const u = new T.Vector3(...m.axes[0]),
          v = new T.Vector3(0, 1, 0),
          n = new T.Vector3().crossVectors(u, v),
          matrix = new T.Matrix4()
            .makeBasis(u, v, n)
            .scale(new T.Vector3(d.picketWidth, d.fenceHeight, 1))
            .setPosition(m.centre[0] - x, m.centre[1] - y, m.centre[2] - z);
        far.setMatrixAt(i, matrix);
      });
      near.computeBoundingSphere();
      far.computeBoundingSphere();
      lod.addLevel(near, 0);
      lod.addLevel(far, d.nearDistance, 0.1);
      group.add(lod);
      chunks++;
    }
    return {
      group,
      stats: {
        chunks,
        maxDrawCalls: chunks + 3,
        pickets: members.filter((m) => m.kind === "picket").length,
        pathTriangles: top.length + sides.length,
      },
    };
  };
  return {
    topTriangles: top,
    members,
    ties,
    supportAt,
    blockedAt,
    createRenderGroup,
  };
}
