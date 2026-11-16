import * as T from "three";
import polygonClipping from "polygon-clipping";
import type { Building, Point } from "./data";
import { centroid } from "./data";
import type { Batcher } from "./geometry";
import type { Materials } from "./materials";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import { facadeFrame, type Vertex3 } from "./architectural-mesh";
import { createCathedralPlaceMaterials } from "./cathedral-place-materials";
import {
  CATHEDRAL_PLACE as D,
  CATHEDRAL_PLACE_ID as ID,
  CATHEDRAL_PLACE_RING as sourceRing,
  CATHEDRAL_PLACE_TIERS as tiers,
  cathedralPlaceLevel,
} from "./cathedral-place-data";

export type CathedralPlaceRole =
  | "stone"
  | "frame"
  | "backing"
  | "roof"
  | "glass";
const roles: CathedralPlaceRole[] = [
  "stone",
  "frame",
  "backing",
  "roof",
  "glass",
];
type Buffers = { p: number[]; uv: number[]; ix: number[] };
const vec = (p: Vertex3) => new T.Vector3(...p);
const openRing = (p: Point[]) =>
  p.length > 1 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]
    ? p.slice(0, -1)
    : p;

/** A five-batch closed exterior. No floor/grade, collision or adjacent building
 * is changed. The historic roof polygons replace the old seeded tower shrink. */
export function createCathedralPlaceGeometry(base = 0) {
  const empty = (): Buffers => ({ p: [], uv: [], ix: [] });
  const data: Record<CathedralPlaceRole, Buffers> = {
    stone: empty(),
    frame: empty(),
    backing: empty(),
    roof: empty(),
    glass: empty(),
  };
  let windows = 0;
  // Clip hidden cavity endpoints to the original convex footprint. At its
  // non-square corners a perpendicular wall inset alone can cross the adjacent
  // boundary by 27mm. This only trims inboard closures, never moves the skin out.
  const contained = (p: Vertex3): Vertex3 => {
    const q: Vertex3 = [...p];
    for (let pass = 0; pass < 4; pass++)
      for (let i = 0; i < sourceRing.length; i++) {
        const a = sourceRing[i],
          b = sourceRing[(i + 1) % sourceRing.length];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = Math.hypot(dx, dz);
        const nx = dz / length,
          nz = -dx / length;
        const distance = (q[0] - a[0]) * nx + (q[2] - a[1]) * nz;
        if (distance < 0) {
          q[0] -= nx * distance;
          q[2] -= nz * distance;
        }
      }
    return q;
  };
  const triangle = (
    role: CathedralPlaceRole,
    a: Vertex3,
    b: Vertex3,
    c: Vertex3,
    desired: Vertex3,
  ) => {
    a = contained(a);
    b = contained(b);
    c = contained(c);
    const n = vec(b)
      .sub(vec(a))
      .cross(vec(c).sub(vec(a)));
    if (n.lengthSq() < 1e-14) return;
    if (n.dot(vec(desired)) < 0) {
      [b, c] = [c, b];
      n.negate();
    }
    n.normalize();
    const q = data[role],
      i = q.p.length / 3;
    q.p.push(...a, ...b, ...c);
    // Stable metric planar coordinates across both triangles and all cells;
    // never restart the mineral texture at every window or diagonal.
    const horizontal = Math.hypot(n.x, n.z);
    for (const p of [a, b, c])
      q.uv.push(
        ...(Math.abs(n.y) > 0.7
          ? [p[0], p[2]]
          : [(p[0] * n.z - p[2] * n.x) / horizontal, p[1]]),
      );
    q.ix.push(i, i + 1, i + 2);
  };
  const quad = (role: CathedralPlaceRole, p: Vertex3[], desired: Vertex3) => {
    triangle(role, p[0], p[1], p[2], desired);
    triangle(role, p[0], p[2], p[3], desired);
  };
  const cap = (
    polygons: Point[][][],
    y: number,
    up = true,
    role: CathedralPlaceRole = "stone",
  ) => {
    for (const poly of polygons) {
      const rings = poly.map(openRing),
        points = rings.flat();
      const triangles = T.ShapeUtils.triangulateShape(
        rings[0].map((p) => new T.Vector2(...p)),
        rings.slice(1).map((r) => r.map((p) => new T.Vector2(...p))),
      );
      for (const ix of triangles)
        triangle(
          role,
          ...(ix.map((i) => [points[i][0], y, points[i][1]] as Vertex3) as [
            Vertex3,
            Vertex3,
            Vertex3,
          ]),
          [0, up ? 1 : -1, 0],
        );
    }
  };
  type Frame = ReturnType<typeof facadeFrame>;
  const face = (
    f: Frame,
    role: CathedralPlaceRole,
    l: number,
    r: number,
    lo: number,
    hi: number,
    d: number,
  ) => {
    if (r - l < 1e-5 || hi - lo < 1e-5) return;
    quad(
      role,
      [f.p(l, lo, d), f.p(r, lo, d), f.p(r, hi, d), f.p(l, hi, d)],
      [f.outward[0], 0, f.outward[1]],
    );
  };
  const edgeWall = (f: Frame, lo: number, hi: number) => {
    const out: Vertex3 = [f.outward[0], 0, f.outward[1]],
      depth = D.backingDepth;
    face(f, "backing", 0, f.length, lo, hi, depth);
    // Close edge ends. Shared tier caps close the horizontal surfaces once;
    // duplicating a wall-strip cap here would z-fight with those roof strips.
    quad(
      "stone",
      [f.p(0, lo), f.p(0, hi), f.p(0, hi, depth), f.p(0, lo, depth)],
      out,
    );
    quad(
      "stone",
      [
        f.p(f.length, hi),
        f.p(f.length, lo),
        f.p(f.length, lo, depth),
        f.p(f.length, hi, depth),
      ],
      out,
    );
  };
  const cell = (
    f: Frame,
    l: number,
    r: number,
    lo: number,
    hi: number,
    corner: boolean,
  ) => {
    const out: Vertex3 = [f.outward[0], 0, f.outward[1]];
    if (hi - lo < (corner ? 0.7 : 1.15) || r - l < 0.8) {
      face(f, "stone", l, r, lo, hi, D.stoneDepth);
      return;
    }
    const side = corner ? 0.055 : Math.min(0.56, (r - l) * 0.23),
      ol = l + side,
      or = r - side;
    const ob = lo + (corner ? 0.18 : 0.7),
      ot = hi - (corner ? 0.12 : 0.29),
      front = corner ? 0 : D.stoneDepth,
      pane = corner ? D.cornerPaneDepth : D.paneDepth;
    face(f, "stone", l, ol, lo, hi, front);
    face(f, "stone", or, r, lo, hi, front);
    face(f, corner ? "frame" : "stone", ol, or, lo, ob, front);
    face(f, corner ? "frame" : "stone", ol, or, ot, hi, front);
    const a = [
        f.p(ol, ob, front),
        f.p(or, ob, front),
        f.p(or, ot, front),
        f.p(ol, ot, front),
      ],
      b = [
        f.p(ol, ob, pane),
        f.p(or, ob, pane),
        f.p(or, ot, pane),
        f.p(ol, ot, pane),
      ];
    for (let j = 0; j < 4; j++)
      quad(
        corner ? "frame" : "stone",
        [a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]],
        out,
      );
    face(f, "glass", ol, or, ob, ot, pane);
    // A slim centre mullion and high transom: panes are not an opaque painted grid.
    const mid = (ol + or) / 2,
      transom = ob + (ot - ob) * 0.73,
      fw = D.frameWidth;
    face(f, "frame", mid - fw / 2, mid + fw / 2, ob, ot, pane - 0.018);
    face(f, "frame", ol, or, transom - fw / 2, transom + fw / 2, pane - 0.018);
    windows++;
  };
  let bottom = base;
  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti],
      top = base + tier.top;
    for (const poly of tier.polygons)
      for (const raw of poly) {
        const ring = openRing(raw);
        for (let i = 0; i < ring.length; i++) {
          const f = facadeFrame(ring[i], ring[(i + 1) % ring.length]);
          edgeWall(f, bottom, top);
          const splits = [
            bottom,
            ...Array.from(
              { length: 24 },
              (_, r) => base + cathedralPlaceLevel(r),
            ).filter((y) => y > bottom + 0.05 && y < top - 0.05),
            top,
          ];
          if (bottom >= base + D.mainBodyTop)
            splits.splice(1, 0, (bottom + top) / 2);
          if (f.length < 2) {
            face(f, "stone", 0, f.length, bottom, top, D.stoneDepth);
            continue;
          }
          const corner = f.length > 10 ? D.cornerWidth : 0;
          const start = corner,
            end = f.length - corner,
            n = Math.max(1, Math.round((end - start) / D.bayWidth));
          for (let row = 0; row < splits.length - 1; row++) {
            const lo = splits[row],
              hi = splits[row + 1];
            if (corner) {
              cell(f, 0, corner, lo, hi, true);
              cell(f, end, f.length, lo, hi, true);
            }
            for (let bay = 0; bay < n; bay++)
              cell(
                f,
                start + ((end - start) * bay) / n,
                start + ((end - start) * (bay + 1)) / n,
                lo,
                hi,
                false,
              );
          }
        }
      }
    // Only exposed terrace strips get caps; overlapping upper footprints are
    // removed analytically, avoiding duplicate coplanar floor surfaces.
    const next = tiers[ti + 1]?.polygons;
    const exposed = next
      ? (polygonClipping.difference(tier.polygons, next) as Point[][][])
      : tier.polygons;
    cap(exposed, top);
    bottom = top;
  }
  cap(tiers[0].polygons, base, false);
  const crown = openRing(tiers.at(-1)!.polygons[0][0]),
    centre = centroid(crown.flat());
  const peak: Vertex3 = [centre[0], base + D.roofPeak, centre[1]];
  for (let i = 0; i < crown.length; i++) {
    const a: Vertex3 = [crown[i][0], base + D.crownSpring, crown[i][1]],
      b: Vertex3 = [
        crown[(i + 1) % crown.length][0],
        base + D.crownSpring,
        crown[(i + 1) % crown.length][1],
      ];
    const n = vec(b)
      .sub(vec(a))
      .cross(vec(peak).sub(vec(a)));
    if (n.y < 0) n.negate();
    n.normalize();
    triangle("roof", a, b, peak, n.toArray() as Vertex3);
    // Physical raised standing seams converge to the pinnacle. No roof texture
    // or photographic reuse; depth survives the Gallery approach silhouette.
    const divisions = Math.max(2, Math.round(vec(a).distanceTo(vec(b)) / 0.65));
    for (let j = 0; j <= divisions; j++) {
      const t = j / divisions,
        at = vec(a).lerp(vec(b), t),
        across = vec(b).sub(vec(a)).normalize().multiplyScalar(0.023),
        lift = n.clone().multiplyScalar(0.025);
      const p0 = at.clone().sub(across).add(lift),
        p1 = at.clone().add(across).add(lift),
        p2 = vec(peak).add(lift);
      triangle(
        "frame",
        p0.toArray() as Vertex3,
        p1.toArray() as Vertex3,
        p2.toArray() as Vertex3,
        n.toArray() as Vertex3,
      );
    }
  }
  // Short four-sided finial, included within the retained overall height.
  const r = 0.095,
    y0 = base + D.roofPeak - 0.1,
    y1 = base + D.apex;
  const tip: Vertex3 = [centre[0], y1, centre[1]];
  const foot: Point[] = [
    [centre[0] - r, centre[1] - r],
    [centre[0] + r, centre[1] - r],
    [centre[0] + r, centre[1] + r],
    [centre[0] - r, centre[1] + r],
  ];
  for (let i = 0; i < 4; i++)
    triangle(
      "frame",
      [...foot[i].slice(0, 1), y0, foot[i][1]] as Vertex3,
      [foot[(i + 1) % 4][0], y0, foot[(i + 1) % 4][1]],
      tip,
      [0, 1, 0],
    );
  const parts = {} as Record<CathedralPlaceRole, T.BufferGeometry>;
  let triangles = 0;
  for (const role of roles) {
    const q = data[role],
      g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(q.p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(q.uv, 2));
    g.setIndex(q.ix);
    g.computeVertexNormals();
    g.computeBoundingBox();
    parts[role] = g;
    triangles += q.ix.length / 3;
  }
  return {
    parts,
    stats: { triangles, windows, batches: roles.length },
    base,
    apex: base + D.apex,
  };
}

/** Exact source dispatch; neighboring towers and the public grade stay owned
 * by their existing providers. Each geometry role is one static batch. */
export function cathedralPlace(
  building: Building,
  batch: Batcher,
  library: Materials,
  reflections: ReflectionProbeSpec[],
) {
  if (building.id !== ID) return false;
  // Reject altered/unregistered source rather than installing at a stale site.
  if (
    building.pts.length !== sourceRing.length * 2 ||
    sourceRing.some(
      (p, i) =>
        Math.hypot(p[0] - building.pts[i * 2], p[1] - building.pts[i * 2 + 1]) >
        0.03,
    )
  )
    return false;
  const geometry = createCathedralPlaceGeometry(),
    materials = createCathedralPlaceMaterials(library),
    [x, z] = centroid(building.pts);
  for (const role of roles)
    batch.add(geometry.parts[role], materials[role], x, z);
  reflections.push({
    name: "Cathedral Place Gallery-facing stone and glazing",
    position: [-31, 45 + batch.offsetY, -94],
    materials: [materials.glass, materials.frame, materials.roof],
    intensity: { day: 0.85, night: 0.85 },
  });
  return true;
}
