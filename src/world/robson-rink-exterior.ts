import * as T from "three";
import Delaunator from "delaunator";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landmarkSurfaceUV } from "./landmark-surfaces";
import {
  ROBSON_RINK_EXTERIOR as D,
  robsonDomeXZ,
  robsonDomeRing,
} from "./robson-rink-exterior-data";

export type RobsonRinkExteriorGeometry = {
  concrete: T.BufferGeometry;
  steel: T.BufferGeometry;
  glass: T.BufferGeometry;
  stats: { triangles: number; glassTriangles: number; batches: number };
};

/** No scene/material/collision mutation. Caller must first apply the shared
 * opening polygons to all covering terrain layers and install closed guards. */
export function createRobsonRinkExteriorGeometry(): RobsonRinkExteriorGeometry {
  const concrete: number[] = [],
    glass: number[] = [],
    steel: T.BufferGeometry[] = [];
  type P = [number, number, number];
  const p = (xz: readonly number[], y: number): P => [xz[0], y, xz[1]];
  const triangle = (out: number[], a: P, b: P, c: P) =>
    out.push(...a, ...b, ...c);
  const quad = (out: number[], a: P, b: P, c: P, d: P) => {
    triangle(out, a, b, c);
    triangle(out, a, c, d);
  };
  const member = (a: P, b: P, radius: number) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius, radius, delta.length(), 6, 1);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.normalize(),
      ),
    );
    g.translate(...(start.add(end).multiplyScalar(0.5).toArray() as P));
    steel.push(g);
  };

  for (const dome of D.domes) {
    const inner = robsonDomeRing(dome, D.openingMargin);
    const outer = robsonDomeRing(dome, D.openingMargin + D.wallThickness);
    const guard = robsonDomeRing(dome, D.openingMargin + D.wallThickness / 2);
    const centre = robsonDomeXZ(dome, 0, 0),
      bottom = D.rinkY - D.floorThickness;
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      // Build consistently, then reverse the complete closed shell below.
      triangle(
        concrete,
        p(centre, D.rinkY),
        p(inner[i], D.rinkY),
        p(inner[j], D.rinkY),
      );
      triangle(
        concrete,
        p(centre, bottom),
        p(outer[j], bottom),
        p(outer[i], bottom),
      );
      quad(
        concrete,
        p(inner[i], D.rinkY),
        p(inner[i], D.rimY),
        p(inner[j], D.rimY),
        p(inner[j], D.rinkY),
      );
      quad(
        concrete,
        p(outer[i], bottom),
        p(outer[j], bottom),
        p(outer[j], D.rimY),
        p(outer[i], D.rimY),
      );
      quad(
        concrete,
        p(inner[i], D.rimY),
        p(outer[i], D.rimY),
        p(outer[j], D.rimY),
        p(inner[j], D.rimY),
      );
      for (const h of [D.guardHeight, D.guardHeight * 0.48])
        member(p(guard[i], D.rimY + h), p(guard[j], D.rimY + h), 0.025);
      if (i % 4 === 0)
        member(p(guard[i], D.rimY), p(guard[i], D.rimY + D.guardHeight), 0.032);
    }

    // Regular interior lattice plus exact perimeter: planar triangular panes
    // and real divided ribs, not a painted grid or per-pane material draws.
    const lattice: [number, number][] = [[0, 0]];
    for (let a = -8; a <= 8; a += 2)
      for (let b = -8; b <= 8; b += 2)
        if (
          (a !== 0 || b !== 0) &&
          (a / dome.radii[0]) ** 2 + (b / dome.radii[1]) ** 2 < 0.82
        )
          lattice.push([a, b]);
    const perimeterStart = lattice.length;
    for (let i = 0; i < D.segments; i++) {
      const t = (i * Math.PI * 2) / D.segments;
      lattice.push([Math.cos(t) * dome.radii[0], Math.sin(t) * dome.radii[1]]);
    }
    const vertices: P[] = lattice.map(([a, b]) => {
      const r2 = (a / dome.radii[0]) ** 2 + (b / dome.radii[1]) ** 2;
      return p(
        robsonDomeXZ(dome, a, b),
        D.roofLow + (D.roofHigh - D.roofLow) * Math.max(0, 1 - r2),
      );
    });
    const triangles = Delaunator.from(lattice).triangles,
      edges = new Set<string>();
    for (let i = 0; i < triangles.length; i += 3) {
      const ids = [triangles[i], triangles[i + 1], triangles[i + 2]];
      const vs = ids.map((j) => vertices[j]);
      const crossY =
        (vs[1][2] - vs[0][2]) * (vs[2][0] - vs[0][0]) -
        (vs[1][0] - vs[0][0]) * (vs[2][2] - vs[0][2]);
      if (crossY < 0) [vs[1], vs[2]] = [vs[2], vs[1]];
      triangle(glass, vs[0], vs[1], vs[2]);
      for (let k = 0; k < 3; k++) {
        const a = ids[k],
          b = ids[(k + 1) % 3],
          key = [Math.min(a, b), Math.max(a, b)].join(":");
        if (edges.has(key)) continue;
        edges.add(key);
        const rim =
          a >= perimeterStart &&
          b >= perimeterStart &&
          (Math.abs(a - b) === 1 || Math.abs(a - b) === D.segments - 1);
        member(vertices[a], vertices[b], rim ? 0.084 : 0.037);
      }
    }
  }
  const geometry = (positions: number[]) => {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    // Metric world projection for existing mineral/steel textures.
    g.setAttribute(
      "uv",
      new T.Float32BufferAttribute(
        positions.flatMap((_, i) =>
          i % 3 === 0 ? [positions[i], positions[i + 2]] : [],
        ),
        2,
      ),
    );
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  };
  for (let i = 0; i < concrete.length; i += 9)
    for (let k = 0; k < 3; k++)
      [concrete[i + 3 + k], concrete[i + 6 + k]] = [
        concrete[i + 6 + k],
        concrete[i + 3 + k],
      ];
  const concreteGeometry = geometry(concrete),
    glassGeometry = geometry(glass);
  landmarkSurfaceUV(concreteGeometry, [1, 1]);
  const steelGeometry = mergeGeometries(steel, false)!;
  for (const g of steel) g.dispose();
  steelGeometry.computeBoundingBox();
  return {
    concrete: concreteGeometry,
    steel: steelGeometry,
    glass: glassGeometry,
    stats: {
      triangles:
        concrete.length / 9 + glass.length / 9 + steelGeometry.index!.count / 3,
      glassTriangles: glass.length / 9,
      batches: 3,
    },
  };
}
