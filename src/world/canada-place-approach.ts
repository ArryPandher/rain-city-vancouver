import { HOWE_STATION_PAVING } from "./howe-station-site";
import { splitHoweStationPaving } from "./howe-station-paving";
import { createHoweStationPavingMaterials } from "./howe-station-paving-materials";
import { canadaPlaceGuardSegments } from "./canada-place-guards";
import * as T from "three";
import clipping from "polygon-clipping";
import { Batcher, flatPolygon } from "./geometry";
import {
  isStreet,
  pointInPoly,
  roadWidth,
  segmentPoint,
  type CityData,
  type Point,
  type Road,
} from "./data";
import type { Materials } from "./materials";
import { CANADA_PLACE_ENTRY_CONNECTOR } from "./canada-place-deck";
import type { CanadaPlaceSite } from "./canada-place-site";
import { CANADA_PLACE_WALK_OFFSET } from "./canada-place-site";
type Polygon = Point[][];
type Multi = Polygon[];
const open = (r: Point[]) =>
  r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1]
    ? r.slice(0, -1)
    : r;
function roadPolygons(r: Road): Multi {
  const radius = roadWidth(r) / 2,
    p: Point[] = Array.from({ length: r.pts.length / 2 }, (_, i) => [
      r.pts[i * 2],
      r.pts[i * 2 + 1],
    ]),
    parts: Multi = [];
  for (const a of p)
    parts.push([
      Array.from(
        { length: 16 },
        (_, i): Point => [
          a[0] + radius * Math.cos((i * Math.PI) / 8),
          a[1] + radius * Math.sin((i * Math.PI) / 8),
        ],
      ),
    ]);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-5) continue;
    const nx = ((b[1] - a[1]) / length) * radius,
      nz = (-(b[0] - a[0]) / length) * radius;
    parts.push([
      [
        [a[0] + nx, a[1] + nz],
        [b[0] + nx, b[1] + nz],
        [b[0] - nx, b[1] - nz],
        [a[0] - nx, a[1] - nz],
      ],
    ]);
  }
  return parts;
}
const inPolygons = (x: number, z: number, polys: Multi) =>
  polys.some(
    (p) =>
      pointInPoly(x, z, p[0].flat()) &&
      !p.slice(1).some((h) => pointInPoly(x, z, h.flat())),
  );
const surfaceMasks = new WeakMap<
  CanadaPlaceSite,
  {
    roads: readonly Road[];
    support: Multi;
    carriageway: Multi;
    sidewalks: Multi;
    sidewalkRings: number[][][];
  }
>();

/** Static source masks shared by paving and walking contact, not a new outline. */
export function canadaPlaceApproachMasks(
  data: Pick<CityData, "roads">,
  site: CanadaPlaceSite,
) {
  const cached = surfaceMasks.get(site);
  if (cached?.roads === data.roads) return cached;
  const support: Multi = site.supportPolygons.map((p) => [p.outer, ...p.holes]);
  const roads = data.roads.filter(
    (r) => (isStreet(r) || r.kind === "service") && site.intersects(r.pts),
  );
  const roadParts = roads.flatMap(roadPolygons);
  const carriageway: Multi = roadParts.length
    ? (clipping.union(roadParts[0], ...roadParts.slice(1)) as Multi)
    : [];
  let sidewalks: Multi = carriageway.length
    ? (clipping.difference(support, carriageway) as Multi)
    : support;
  const entry: Point[] = Array.from(
    { length: CANADA_PLACE_ENTRY_CONNECTOR.length / 2 },
    (_, i) => [
      CANADA_PLACE_ENTRY_CONNECTOR[i * 2],
      CANADA_PLACE_ENTRY_CONNECTOR[i * 2 + 1],
    ],
  );
  sidewalks = clipping.union(
    sidewalks,
    clipping.intersection(support, [entry]),
  ) as Multi;
  const result = {
    roads: data.roads,
    support,
    carriageway,
    sidewalks,
    sidewalkRings: sidewalks.map((p) => p.map((ring) => ring.flat())),
  };
  surfaceMasks.set(site, result);
  return result;
}

export function canadaPlacePavingHeight(
  data: Pick<CityData, "roads">,
  site: CanadaPlaceSite,
  x: number,
  z: number,
) {
  if (!site.contains(x, z)) return undefined;
  const masks = canadaPlaceApproachMasks(data, site);
  return (
    site.supportHeight(x, z) +
    (masks.sidewalkRings.some(
      (p) =>
        pointInPoly(x, z, p[0]) &&
        !p.some((h, i) => i > 0 && pointInPoly(x, z, h)),
    )
      ? CANADA_PLACE_WALK_OFFSET
      : 0.065)
  );
}
const geometry = (position: number[]) => {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(position, 3));
  const uv: number[] = [];
  for (let i = 0; i < position.length; i += 3)
    uv.push(position[i] / 4, position[i + 2] / 4);
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
};
/** Bounded road support, matching the site's shared height. No source pier/deck
 * is rebuilt here. Building holes remain holes, including retaining faces. */
export function canadaPlaceApproachGeometry(
  data: Pick<CityData, "roads" | "buildings">,
  site: CanadaPlaceSite,
  oldHeight: (x: number, z: number) => number,
) {
  const { support, carriageway, sidewalks } = canadaPlaceApproachMasks(
    data,
    site,
  );
  const pavement: number[] = [],
    retaining: number[] = [],
    retainingUV: number[] = [],
    curbs: number[] = [];
  const top = (polygons: Multi, offset: number) => {
    for (const poly of polygons) {
      const g = flatPolygon(
          open(poly[0]).flat(),
          poly.slice(1).map((h) => open(h).flat()),
        ),
        p = g.getAttribute("position"),
        ix = g.getIndex()!;
      const emit = (a: Point, b: Point, c: Point, depth = 0) => {
        const pts = [a, b, c],
          lengths = pts.map((a, i) =>
            Math.hypot(a[0] - pts[(i + 1) % 3][0], a[1] - pts[(i + 1) % 3][1]),
          );
        const longest = Math.max(...lengths),
          i = lengths.indexOf(longest),
          q = pts[i],
          r = pts[(i + 1) % 3],
          s = pts[(i + 2) % 3];
        const ys = pts.map((p) => site.supportHeight(...p));
        const centre: Point = [
          (a[0] + b[0] + c[0]) / 3,
          (a[1] + b[1] + c[1]) / 3,
        ];
        const heightError = Math.abs(
          site.supportHeight(...centre) - (ys[0] + ys[1] + ys[2]) / 3,
        );
        const edgeVector = new T.Vector3(
          b[0] - a[0],
          ys[1] - ys[0],
          b[1] - a[1],
        );
        const otherVector = new T.Vector3(
          c[0] - a[0],
          ys[2] - ys[0],
          c[1] - a[1],
        );
        const cross = edgeVector.cross(otherVector);
        const normalY = Math.abs(cross.y) / Math.max(1e-20, cross.length());
        // Curved approach fields need height-error subdivision as well as
        // distance subdivision. Thin clipping wedges can otherwise tilt almost
        // vertically despite all three vertices lying on a gentle grade.
        if (
          (longest > 2 || heightError > 0.015 || normalY < 0.82) &&
          depth < 26 &&
          longest > 0.025
        ) {
          const mid: Point = [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2];
          emit(q, mid, s, depth + 1);
          emit(mid, r, s, depth + 1);
          return;
        }
        const rounded = pts.map(
          (p) => [Math.fround(p[0]), Math.fround(p[1])] as Point,
        );
        const [u, v, w] = rounded;
        const area =
          (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
        if (Math.abs(area) < 1e-7) return;
        if (area > 0) rounded.reverse();
        for (const p of rounded)
          pavement.push(p[0], site.supportHeight(...p) + offset, p[1]);
      };
      for (let i = 0; i < ix.count; i += 3)
        emit(
          ...([0, 1, 2].map(
            (k) => [p.getX(ix.getX(i + k)), p.getZ(ix.getX(i + k))] as Point,
          ) as [Point, Point, Point]),
        );
      g.dispose();
    }
  };
  // A continuous structural top sits just below asphalt. Only shoulders/plaza
  // receive the +.15m walking finish, keeping the mapped road visible at +.092.
  top(support, 0.065);
  top(sidewalks, CANADA_PLACE_WALK_OFFSET);
  const quad = (
    out: number[],
    a: number[],
    b: number[],
    c: number[],
    d: number[],
  ) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const polygon of support)
    for (const sourceRing of polygon) {
      const ring = open(sourceRing);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let j = 0; j < n; j++) {
          const p: Point = [
              a[0] + ((b[0] - a[0]) * j) / n,
              a[1] + ((b[1] - a[1]) * j) / n,
            ],
            q: Point = [
              a[0] + ((b[0] - a[0]) * (j + 1)) / n,
              a[1] + ((b[1] - a[1]) * (j + 1)) / n,
            ];
          const offset = inPolygons(
            (p[0] + q[0]) / 2,
            (p[1] + q[1]) / 2,
            carriageway,
          )
            ? 0.065
            : 0.15;
          const py = site.supportHeight(...p) + offset,
            qy = site.supportHeight(...q) + offset,
            pl = Math.min(py, oldHeight(...p)),
            ql = Math.min(qy, oldHeight(...q));
          if (Math.max(py - pl, qy - ql) < 0.04) continue;
          const u0 = Math.hypot(p[0] - a[0], p[1] - a[1]) / 4,
            u1 = Math.hypot(q[0] - a[0], q[1] - a[1]) / 4;
          retainingUV.push(
            u0,
            py / 4,
            u1,
            qy / 4,
            u1,
            ql / 4,
            u0,
            py / 4,
            u1,
            ql / 4,
            u0,
            pl / 4,
          );
          quad(
            retaining,
            [p[0], py, p[1]],
            [q[0], qy, q[1]],
            [q[0], ql, q[1]],
            [p[0], pl, p[1]],
          );
        }
      }
    }
  const crossings = data.roads.filter(
    (r) => r.crossing && site.intersects(r.pts),
  );
  const crossingAt = (x: number, z: number) =>
    crossings.some((r) =>
      r.pts.some(
        (_, i) =>
          i % 2 === 0 &&
          i < r.pts.length - 2 &&
          segmentPoint(x, z, r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3])
            .d < 2,
      ),
    );
  // Unioned carriageways have no interior junction edges. Add kerbs only where
  // an actual supported sidewalk is outside that union; mapped crossings stay open.
  for (const polygon of carriageway)
    for (const sourceRing of polygon) {
      const ring = open(sourceRing);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 1e-5) continue;
        const nx = (b[1] - a[1]) / length,
          nz = -(b[0] - a[0]) / length,
          n = Math.ceil(length);
        for (let j = 0; j < n; j++) {
          const p: Point = [
              a[0] + ((b[0] - a[0]) * j) / n,
              a[1] + ((b[1] - a[1]) * j) / n,
            ],
            q: Point = [
              a[0] + ((b[0] - a[0]) * (j + 1)) / n,
              a[1] + ((b[1] - a[1]) * (j + 1)) / n,
            ];
          if (
            ![p, q].every(
              ([x, z]) =>
                site.contains(x + nx * 0.04, z + nz * 0.04) &&
                site.contains(x - nx * 0.28, z - nz * 0.28) &&
                !crossingAt(x, z) &&
                !pointInPoly(x, z, CANADA_PLACE_ENTRY_CONNECTOR),
            )
          )
            continue;
          const py = site.supportHeight(...p),
            qy = site.supportHeight(...q);
          quad(
            curbs,
            [p[0], py + 0.097, p[1]],
            [q[0], qy + 0.097, q[1]],
            [q[0], qy + 0.15, q[1]],
            [p[0], py + 0.15, p[1]],
          );
          quad(
            curbs,
            [
              p[0] - nx * 0.28,
              site.supportHeight(p[0] - nx * 0.28, p[1] - nz * 0.28) + 0.097,
              p[1] - nz * 0.28,
            ],
            [
              q[0] - nx * 0.28,
              site.supportHeight(q[0] - nx * 0.28, q[1] - nz * 0.28) + 0.097,
              q[1] - nz * 0.28,
            ],
            [q[0], qy + 0.097, q[1]],
            [p[0], py + 0.097, p[1]],
          );
        }
      }
    }
  const surface = geometry(pavement);
  // Polygon cuts can leave sub-millimetre sliver triangles. Use the shared
  // smooth grade derivative rather than unstable normals from those slivers.
  const positions = surface.getAttribute("position"),
    normals = surface.getAttribute("normal");
  const normal = new T.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      d = 0.05,
      // A derivative must sample one continuous field. At a hotel cut, the
      // generic sampler outside the apron falls back to a different datum;
      // differencing that fallback fabricates a near-vertical pavement normal.
      // Extend only the owning field for this 5 cm lighting derivative. Actual
      // pavement/collision bounds and emitted vertex heights remain unchanged.
      height = site.fairmontApron?.covers(x, z)
        ? site.fairmontApron.height
        : site.pwcApron?.covers(x, z)
          ? site.pwcApron.height
          : site.supportHeight;
    normal
      .set(
        -(height(x + d, z) - height(x - d, z)) / (2 * d),
        1,
        -(height(x, z + d) - height(x, z - d)) / (2 * d),
      )
      .normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const walls = geometry(retaining);
  walls.setAttribute("uv", new T.Float32BufferAttribute(retainingUV, 2));
  const steel: number[] = [];
  const bar = (a: T.Vector3, b: T.Vector3, width: number) => {
    const delta = b.clone().sub(a),
      g = new T.BoxGeometry(width, delta.length(), width).toNonIndexed();
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    steel.push(...g.getAttribute("position").array);
    g.dispose();
  };
  for (const r of canadaPlaceGuardSegments(data, site, oldHeight)) {
    bar(
      new T.Vector3(r.a[0], r.topA - 0.03, r.a[1]),
      new T.Vector3(r.b[0], r.topB - 0.03, r.b[1]),
      0.06,
    );
    for (const [p, base, top] of [
      [r.a, r.baseA, r.topA],
      [r.b, r.baseB, r.topB],
    ] as [Point, number, number][])
      bar(
        new T.Vector3(p[0], base, p[1]),
        new T.Vector3(p[0], top, p[1]),
        0.05,
      );
  }
  return {
    pavement: surface,
    retaining: walls,
    guards: geometry(steel),
    curbs: geometry(curbs),
  };
}
export function buildCanadaPlaceApproach(
  parent: T.Object3D,
  data: Pick<CityData, "roads" | "buildings">,
  materials: Materials,
  site: CanadaPlaceSite,
  oldHeight: (x: number, z: number) => number,
) {
  const parts = canadaPlaceApproachGeometry(data, site, oldHeight),
    batch = new Batcher(parent, 160),
    x = (site.bounds.minX + site.bounds.maxX) / 2,
    z = (site.bounds.minZ + site.bounds.maxZ) / 2;
  const paving = splitHoweStationPaving(
    parts.pavement,
    (x, z) => site.supportHeight(x, z) + CANADA_PLACE_WALK_OFFSET,
    HOWE_STATION_PAVING,
  );
  parts.pavement.dispose();
  batch.add(
    paving.remainder,
    materials.concrete,
    x,
    z,
    "canada-place-support-paving",
  );
  if (paving.field.getAttribute("position").count) {
    const material = createHoweStationPavingMaterials(
      materials,
      HOWE_STATION_PAVING,
    );
    // The source's rear polygon edges are visibility limits, not border courses.
    material.border.dispose();
    batch.add(
      paving.field,
      material.field,
      490,
      -445,
      "howe-station-patterned-paving",
    );
  } else paving.field.dispose();
  batch.add(
    parts.retaining,
    materials.stone,
    x,
    z,
    "canada-place-support-walls",
  );
  batch.add(parts.curbs, materials.concrete, x, z, "canada-place-kerbs");
  batch.add(
    parts.guards,
    materials.dark,
    x,
    z,
    "canada-place-perimeter-guards",
  );
  return batch.finish();
}
