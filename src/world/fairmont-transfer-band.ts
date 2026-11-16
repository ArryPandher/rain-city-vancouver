import * as T from "three";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import {
  FAIRMONT_ARCADE_DEPTH,
  type FairmontArcadeSite,
} from "./fairmont-arcade-site";
import { FAIRMONT_WATERFRONT_ROOM_BASE } from "./fairmont-waterfront-site";

/** Original exterior profile from MCM Waterfront-Centre-011, not survey data.
 * Web centres use the existing six structural piers, never glass-pane pitch. */
export const FAIRMONT_TRANSFER_BAND = {
  top: FAIRMONT_WATERFRONT_ROOM_BASE,
  webWidth: 1.12,
  backDepth: 0.68,
  coveDepth: 0.6,
  upperFascia: 1.35,
  coveSegments: 8,
  aboveCanopy: 0.48,
  recessBottomAboveCanopy: 0.08,
} as const;

type Section = FairmontArcadeSite["sections"][number];
/** Mitered inward strip; source corners use the same points on both faces. */
export function fairmontTransferPoint(
  section: Section,
  t: number,
  y: number,
  depth: number,
): Vertex3 {
  const front = facadeFrame(section.a, section.b).p(t * section.length, y),
    back = section.back(t, y),
    fraction = depth / FAIRMONT_ARCADE_DEPTH;
  return [
    front[0] + (back[0] - front[0]) * fraction,
    y,
    front[2] + (back[2] - front[2]) * fraction,
  ];
}

export function fairmontTransferWebs(
  section: Section,
  site: FairmontArcadeSite,
) {
  return site.piers
    .filter((p) => p.edge === section.edge)
    .map((p) => ({
      left: Math.max(
        0,
        (p.along - FAIRMONT_TRANSFER_BAND.webWidth / 2) / section.length,
      ),
      right: Math.min(
        1,
        (p.along + FAIRMONT_TRANSFER_BAND.webWidth / 2) / section.length,
      ),
    }));
}

/** Profile points run from upper room datum down to the existing soffit.
 * The public ceiling is never lowered and the old opaque band is not retained
 * behind the newly exposed cove. All recession stays inside the source envelope. */
export function fairmontTransferProfile(
  section: Section,
  site: FairmontArcadeSite,
  t: number,
  web = false,
): { depth: number; point: Vertex3 }[] {
  const d = FAIRMONT_TRANSFER_BAND,
    at = (depth: number, y: number) => ({
      depth,
      point: fairmontTransferPoint(section, t, y, depth),
    }),
    inset = fairmontTransferPoint(section, t, 0, d.coveDepth),
    lipY = site.canopyTopAt(inset[0], inset[2]) + d.recessBottomAboveCanopy,
    available = d.top - lipY,
    // Preserve a valid section for graded callers, rather than folding a
    // fixed-height cove through the room sill. Active Howe uses the full depth.
    coveDepth = Math.min(d.coveDepth, available * 0.24),
    lower =
      lipY +
      Math.min(d.aboveCanopy - d.recessBottomAboveCanopy, available * 0.18),
    upper = d.top - Math.min(d.upperFascia, available * 0.42);
  if (available <= 0.08)
    throw new Error("Fairmont canopy crosses the restored room datum");
  const points = [at(0, d.top), at(0, upper)];
  for (let i = 1; i <= d.coveSegments; i++) {
    const angle = ((i / d.coveSegments) * Math.PI) / 2;
    points.push(
      at(
        web ? 0 : coveDepth * (1 - Math.cos(angle)),
        lower + (upper - lower) * (1 - Math.sin(angle)),
      ),
    );
  }
  points.push(
    at(web ? 0 : coveDepth, lipY),
    at(0, lipY),
    at(0, section.ceilingAt(t)),
  );
  return points;
}

/** Smooth normal of the authored ellipse, including its graded longitudinal
 * tangent. Only cove strips use it; adjoining web/ledge normals stay hard. */
export function fairmontTransferCoveNormal(
  section: Section,
  site: FairmontArcadeSite,
  t: number,
  vertex: number,
): T.Vector3 {
  const d = FAIRMONT_TRANSFER_BAND,
    angle = ((vertex / d.coveSegments) * Math.PI) / 2,
    profile = fairmontTransferProfile(section, site, t),
    end = profile[d.coveSegments + 1],
    rise = profile[1].point[1] - end.point[1],
    front = fairmontTransferPoint(section, t, 0, 0),
    inward = new T.Vector3(...fairmontTransferPoint(section, t, 0, 1)).sub(
      new T.Vector3(...front),
    ),
    around = inward.multiplyScalar(end.depth * Math.sin(angle));
  around.y = -rise * Math.cos(angle);
  // Profile parameters vary linearly with the fitted canopy plane within each
  // section; this symmetric tangent also handles bounded graded callers.
  const h = 1e-5,
    along = new T.Vector3(
      ...fairmontTransferProfile(section, site, t + h)[vertex + 1].point,
    ).sub(
      new T.Vector3(
        ...fairmontTransferProfile(section, site, t - h)[vertex + 1].point,
      ),
    ),
    normal = along.cross(around).normalize(),
    f = facadeFrame(section.a, section.b),
    expected = new T.Vector3(
      f.outward[0] * Math.cos(angle),
      -Math.sin(angle),
      f.outward[1] * Math.cos(angle),
    );
  if (normal.dot(expected) < 0) normal.negate();
  return normal;
}

export function buildFairmontTransferBand(
  mesh: ArchitecturalMesh,
  material: T.Material,
  site: FairmontArcadeSite,
) {
  const d = FAIRMONT_TRANSFER_BAND;
  const quad = (
    points: Vertex3[],
    desired: T.Vector3,
    smooth?: T.Vector3[],
  ) => {
    const w = new T.Vector3(...points[0]).distanceTo(
        new T.Vector3(...points[1]),
      ),
      h = new T.Vector3(...points[0]).distanceTo(new T.Vector3(...points[3])),
      uv = [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
      positions: number[] = [],
      coordinates: number[] = [],
      normals: number[] = [];
    // A web cheek tapers to a point at the cove spring. Keep its valid
    // triangle, but never emit the collapsed half of that nominal quad.
    for (let face of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const n = new T.Vector3(...points[face[1]])
        .sub(new T.Vector3(...points[face[0]]))
        .cross(
          new T.Vector3(...points[face[2]]).sub(
            new T.Vector3(...points[face[0]]),
          ),
        );
      if (n.lengthSq() < 1e-12) continue;
      if (n.dot(desired) < 0) face = [face[0], face[2], face[1]];
      for (const i of face) {
        positions.push(...points[i]);
        coordinates.push(...uv[i]);
        if (smooth) normals.push(...smooth[i].toArray());
      }
    }
    if (!positions.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(coordinates, 2));
    if (smooth)
      g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    else g.computeVertexNormals();
    mesh.add(g, material);
  };
  for (const section of site.sections) {
    const f = facadeFrame(section.a, section.b),
      normal = new T.Vector3(f.outward[0], 0, f.outward[1]),
      along = new T.Vector3(
        section.b[0] - section.a[0],
        0,
        section.b[1] - section.a[1],
      ).normalize(),
      webs = fairmontTransferWebs(section, site),
      cuts = [
        ...new Set([0, 1, ...webs.flatMap((w) => [w.left, w.right])]),
      ].sort((a, b) => a - b),
      isWeb = (t: number) => webs.some((w) => t > w.left && t < w.right);
    for (let i = 1; i < cuts.length; i++) {
      const l = cuts[i - 1],
        r = cuts[i],
        web = isWeb((l + r) / 2),
        left = fairmontTransferProfile(section, site, l, web),
        right = fairmontTransferProfile(section, site, r, web);
      for (let j = 1; j < left.length; j++) {
        const delta = left[j].depth - left[j - 1].depth;
        // Horizontal pocket sill faces up; coved soffit faces out/down.
        const direction = normal.clone();
        if (Math.abs(left[j].point[1] - left[j - 1].point[1]) < 1e-8)
          direction.set(0, delta < 0 ? 1 : -1, 0);
        quad(
          [
            left[j - 1].point,
            right[j - 1].point,
            right[j].point,
            left[j].point,
          ],
          direction,
          !web && j >= 2 && j <= d.coveSegments + 1
            ? [
                fairmontTransferCoveNormal(section, site, l, j - 2),
                fairmontTransferCoveNormal(section, site, r, j - 2),
                fairmontTransferCoveNormal(section, site, r, j - 1),
                fairmontTransferCoveNormal(section, site, l, j - 1),
              ]
            : undefined,
        );
      }
      // Web cheeks close the change in depth; do not add a false web at a plan bend.
      for (const [t, sign, needed] of [
        [l, -1, i > 1],
        [r, 1, i < cuts.length - 1],
      ] as const) {
        if (!web || !needed) continue;
        const recessed = fairmontTransferProfile(section, site, t),
          front = fairmontTransferProfile(section, site, t, true);
        for (let j = 1; j < front.length; j++)
          quad(
            [
              front[j - 1].point,
              front[j].point,
              recessed[j].point,
              recessed[j - 1].point,
            ],
            along.clone().multiplyScalar(sign),
          );
      }
    }
    const backLow = (t: number): Vertex3 => {
      const p = fairmontTransferPoint(section, t, 0, d.backDepth);
      p[1] = site.canopyTopAt(p[0], p[2]) - 0.64;
      return p;
    };
    quad(
      [
        backLow(0),
        backLow(1),
        fairmontTransferPoint(section, 1, d.top, d.backDepth),
        fairmontTransferPoint(section, 0, d.top, d.backDepth),
      ],
      normal.clone().negate(),
    );
    quad(
      [
        fairmontTransferPoint(section, 0, d.top, 0),
        fairmontTransferPoint(section, 1, d.top, 0),
        fairmontTransferPoint(section, 1, d.top, d.backDepth),
        fairmontTransferPoint(section, 0, d.top, d.backDepth),
      ],
      new T.Vector3(0, 1, 0),
    );
    // The existing exact planar arcade soffit supplies the bottom. Emitting
    // another bottom here would duplicate its visible underside.
    for (const [t, terminal, sign] of [
      [0, section === site.sections[0], -1],
      [1, section === site.sections.at(-1), 1],
    ] as const) {
      if (!terminal) continue;
      const profile = fairmontTransferProfile(
          section,
          site,
          t,
          isWeb(t === 0 ? 1e-8 : 1 - 1e-8),
        ),
        backBottom = backLow(t),
        points = [
          ...profile.map((p) => p.point),
          backBottom,
          fairmontTransferPoint(section, t, d.top, d.backDepth),
        ],
        shape = [
          ...profile.map((p) => new T.Vector2(p.depth, p.point[1])),
          new T.Vector2(d.backDepth, backBottom[1]),
          new T.Vector2(d.backDepth, d.top),
        ],
        faces = T.ShapeUtils.triangulateShape(shape, []),
        g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.Float32BufferAttribute(points.flat(), 3),
      );
      const ix: number[] = [];
      for (let face of faces) {
        const n = new T.Vector3(...points[face[1]])
          .sub(new T.Vector3(...points[face[0]]))
          .cross(
            new T.Vector3(...points[face[2]]).sub(
              new T.Vector3(...points[face[0]]),
            ),
          );
        if (n.dot(along) * sign < 0) face = [face[0], face[2], face[1]];
        ix.push(...face);
      }
      g.setIndex(ix);
      g.computeVertexNormals();
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          shape.flatMap((p) => [p.x, p.y]),
          2,
        ),
      );
      // Ear clipping may discard collinear profile points. Remove their unused
      // attributes so every stored vertex has a real unit surface normal.
      const closedEnd = g.toNonIndexed();
      g.dispose();
      mesh.add(closedEnd, material);
    }
  }
}
