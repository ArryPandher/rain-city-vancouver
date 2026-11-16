import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { facadeFrame } from "./architectural-mesh";
import { centroid } from "./data";
import { GRANVILLE_SQUARE_TOWER_RING as ring } from "./granville-square-tower-data";
import { createExteriorLobbyGlass } from "./exterior-lobby-glass";

const frame = facadeFrame(ring[3], ring[0]),
  tangent = new T.Vector3(
    (ring[0][0] - ring[3][0]) / frame.length,
    0,
    (ring[0][1] - ring[3][1]) / frame.length,
  ),
  inward = new T.Vector3(-frame.outward[0], 0, -frame.outward[1]);
type Box = {
  u: number;
  d: number;
  width: number;
  depth: number;
  low: number;
  high: number;
};
type Roof = { left: number; right: number; back: number; front: number };

/** Source-backed first three of the four D→A base bays. Section dimensions are
 * bounded photo estimates; the fourth-bay 200 surround is deliberately absent
 * because its projected envelope overlaps the separately owned parkade. */
export const GRANVILLE_SQUARE_ENTRANCE = {
  bayWidth: frame.length / 4,
  edgeInset: 0.35,
  projection: 2.65,
  backY: 3.62,
  frontY: 3.4,
  glassThickness: 0.025,
  postWidth: 0.11,
  postInset: 0.2,
  beamDepth: 0.1,
  divisions: 5,
} as const;

export function createGranvilleSquareEntranceSite(
  groundHeight: (x: number, z: number) => number,
) {
  const D = GRANVILLE_SQUARE_ENTRANCE,
    base = groundHeight(...centroid(ring.flat())),
    roofs: Roof[] = [],
    posts: Box[] = [];
  const roofY = (d: number) =>
    base + D.backY + (d / D.projection) * (D.backY - D.frontY);
  for (let bay = 0; bay < 3; bay++) {
    const left = bay * D.bayWidth + D.edgeInset,
      right = (bay + 1) * D.bayWidth - D.edgeInset;
    roofs.push({ left, right, back: 0.015, front: -D.projection });
    for (const u of [left + D.postInset, right - D.postInset]) {
      const d = -D.projection + D.postInset,
        p = frame.p(u, 0, d);
      posts.push({
        u,
        d,
        width: D.postWidth,
        depth: D.postWidth,
        low: groundHeight(p[0], p[2]) - 0.025,
        high: roofY(d) - D.glassThickness / 2,
      });
    }
  }
  const local = (x: number, z: number) => ({
    u: (x - ring[3][0]) * tangent.x + (z - ring[3][1]) * tangent.z,
    d: (x - ring[3][0]) * inward.x + (z - ring[3][1]) * inward.z,
  });
  const distance = (
    u: number,
    d: number,
    l: number,
    r: number,
    b: number,
    f: number,
  ) => Math.hypot(Math.max(l - u, 0, u - r), Math.max(f - d, 0, d - b));
  return {
    base,
    roofs,
    posts,
    roofY,
    point: frame.p,
    local,
    support(x: number, z: number, referenceY = Infinity) {
      // Ordinary unspecified ground queries must not promote the public route
      // onto a canopy. Only a body already at roof level can land there.
      if (!Number.isFinite(referenceY)) return undefined;
      const { u, d } = local(x, z);
      if (
        !roofs.some(
          (r) => distance(u, d, r.left, r.right, r.back, r.front) < 1e-9,
        )
      )
        return undefined;
      const y = roofY(d);
      return referenceY >= y - 0.35 ? y : undefined;
    },
    blocked(
      x: number,
      z: number,
      radius: number,
      referenceY: number,
      camera = false,
    ) {
      const { u, d } = local(x, z);
      if (
        u < -radius ||
        u > 3 * D.bayWidth + radius ||
        d < -D.projection - radius ||
        d > radius + 0.1
      )
        return false;
      const y = Number.isFinite(referenceY) ? referenceY : groundHeight(x, z),
        low = camera ? y - radius : y,
        high = camera ? y + radius : y + 1.8;
      for (const p of posts)
        if (
          distance(
            u,
            d,
            p.u - p.width / 2,
            p.u + p.width / 2,
            p.d + p.depth / 2,
            p.d - p.depth / 2,
          ) < radius &&
          low < p.high &&
          high > p.low
        )
          return true;
      for (const r of roofs) {
        if (distance(u, d, r.left, r.right, r.back, r.front) > radius) continue;
        const nearestD = Math.max(r.front, Math.min(r.back, d)),
          top = roofY(nearestD),
          bottom = roofY(nearestD) - D.beamDepth;
        if (high > bottom && low < top && (camera || y < top - 0.03))
          return true;
      }
      return false;
    },
  };
}
export type GranvilleSquareEntranceSite = ReturnType<
  typeof createGranvilleSquareEntranceSite
>;

/** One shallow glass batch plus metal that can merge with the tower frames.
 * Everything uses world coordinates, as does the existing tower factory. */
export function createGranvilleSquareEntranceGeometry(
  site: GranvilleSquareEntranceSite,
) {
  const D = GRANVILLE_SQUARE_ENTRANCE,
    steel: T.BufferGeometry[] = [],
    glass: T.BufferGeometry[] = [];
  const beam = (a: T.Vector3, b: T.Vector3, width: number, depth: number) => {
    const delta = b.clone().sub(a),
      g = new T.BoxGeometry(width, delta.length(), depth);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
    steel.push(g);
  };
  const p = (u: number, d: number, offset = 0) =>
    new T.Vector3(...site.point(u, site.roofY(d) + offset, d));
  for (const box of site.posts) {
    const g = new T.BoxGeometry(box.width, box.high - box.low, box.depth),
      transform = new T.Matrix4().makeBasis(
        tangent,
        new T.Vector3(0, 1, 0),
        inward,
      );
    transform.setPosition(
      new T.Vector3(...site.point(box.u, (box.low + box.high) / 2, box.d)),
    );
    g.applyMatrix4(transform);
    steel.push(g);
  }
  for (const roof of site.roofs) {
    // A complete optical sheet uses a single DoubleSide surface, avoiding
    // double attenuation from drawing a separate underside at the same pane.
    const verts = [
      p(roof.left, roof.back),
      p(roof.right, roof.back),
      p(roof.right, roof.front),
      p(roof.left, roof.front),
    ];
    const positions: number[] = [],
      indices: number[] = [],
      uv: number[] = [];
    const face = (corners: T.Vector3[]) => {
      const start = positions.length / 3;
      corners.forEach((v) => positions.push(...v.toArray()));
      uv.push(
        0,
        0,
        0,
        D.projection,
        roof.right - roof.left,
        D.projection,
        roof.right - roof.left,
        0,
      );
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    // Roof support is exactly this rendered plane; collision also covers the
    // finite underside occupied by its physical supporting metal members.
    face(verts);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    glass.push(g);
    for (let i = 0; i <= D.divisions; i++) {
      const u = roof.left + ((roof.right - roof.left) * i) / D.divisions;
      beam(
        p(u, roof.back, -0.065),
        p(u, roof.front, -0.065),
        0.065,
        D.beamDepth,
      );
    }
    for (const d of [roof.back, (roof.front + roof.back) / 2, roof.front])
      beam(p(roof.left, d, -0.07), p(roof.right, d, -0.07), 0.07, D.beamDepth);
  }
  const merge = (parts: T.BufferGeometry[]) => {
    const g = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    return g;
  };
  return { frame: merge(steel), glass: merge(glass) };
}

export function createGranvilleSquareCanopyGlass() {
  const glass = createExteriorLobbyGlass(
    "Granville Square entrance canopy glass",
    0.88,
  );
  glass.side = T.DoubleSide;
  glass.forceSinglePass = true;
  glass.roughness = 0.1;
  return glass;
}
