import * as T from "three";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { Point } from "./data";
import type { FairmontWaterfrontMaterials } from "./fairmont-waterfront-materials";
import {
  createFairmontArcadeSite,
  type FairmontArcadeSite,
} from "./fairmont-arcade-site";
import { FAIRMONT_WATERFRONT_HOWE_BASE_TOP } from "./fairmont-waterfront-site";

/** Open exterior arcade, closed by real rear glazing and side returns.
 * Collision uses the same floor triangles, pier centres and closed boundary. */
export function buildFairmontArcade(
  mesh: ArchitecturalMesh,
  m: FairmontWaterfrontMaterials,
  groundHeight: (x: number, z: number) => number,
  datum: number,
  preparedSite?: FairmontArcadeSite,
) {
  const site = preparedSite ?? createFairmontArcadeSite(groundHeight, datum);
  const quad = (mat: T.Material, p: Vertex3[], normal: Vertex3) => {
    const cross = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if (cross.dot(new T.Vector3(...normal)) < 0) p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(mat, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  };
  for (const panel of site.floorPanels) {
    const section = site.sections[panel.section],
      f = facadeFrame(section.a, section.b),
      normal: Vertex3 = [f.outward[0], 0, f.outward[1]],
      back = (t: number, y: number, inset = 0): Vertex3 => {
        const p = section.back(t, y);
        return [p[0] - f.outward[0] * inset, y, p[2] - f.outward[1] * inset];
      },
      [a, b] = panel.corners,
      l = panel.left,
      r = panel.right,
      // The photo supports pale low infill in the Canada Place end bay, behind the
      // piers. It never crosses the open public edge or invents a barrier.
      lowInfill = section.edge === 0 ? 0.6 : 0.09,
      lowL = a[1] + lowInfill,
      lowR = b[1] + lowInfill,
      ceilingL = section.ceilingAt(l),
      ceilingR = section.ceilingAt(r),
      rearCeilingL = section.ceilingAt(l, true),
      rearCeilingR = section.ceilingAt(r, true);
    quad(m.panel, panel.corners, [0, 1, 0]);
    // Below-floor vertical closure follows grade without a raised curb/step.
    quad(m.panel, [[a[0], 0, a[2]], [b[0], 0, b[2]], b, a], normal);
    quad(
      m.panel,
      [
        f.p(l * f.length, ceilingL),
        f.p(r * f.length, ceilingR),
        back(r, rearCeilingR),
        back(l, rearCeilingL),
      ],
      [0, -1, 0],
    );
    quad(
      m.dark,
      [
        back(l, 0, 0.08),
        back(r, 0, 0.08),
        back(r, rearCeilingR, 0.08),
        back(l, rearCeilingL, 0.08),
      ],
      normal,
    );
    quad(
      m.panel,
      [back(l, a[1]), back(r, b[1]), back(r, lowR), back(l, lowL)],
      normal,
    );
    quad(
      m.lobbyGlass,
      [
        back(l, lowL),
        back(r, lowR),
        back(r, rearCeilingR - 0.16),
        back(l, rearCeilingL - 0.16),
      ],
      normal,
    );
    const highL = Math.min(rearCeilingL - 0.4, lowL + 2.35),
      highR = Math.min(rearCeilingR - 0.4, lowR + 2.35);
    // Close the graded top of this base at the untouched fourth-level row.
    quad(
      m.panel,
      [
        f.p(l * f.length, ceilingL),
        f.p(r * f.length, ceilingR),
        f.p(r * f.length, FAIRMONT_WATERFRONT_HOWE_BASE_TOP),
        f.p(l * f.length, FAIRMONT_WATERFRONT_HOWE_BASE_TOP),
      ],
      normal,
    );
    for (const [loL, loR, hiL, hiR] of [
      [lowL, lowR, lowL + 0.07, lowR + 0.07],
      [highL, highR, highL + 0.06, highR + 0.06],
      [rearCeilingL - 0.16, rearCeilingR - 0.16, rearCeilingL, rearCeilingR],
    ])
      quad(
        m.metal,
        [
          back(l, loL, -0.015),
          back(r, loR, -0.015),
          back(r, hiR, -0.015),
          back(l, hiL, -0.015),
        ],
        normal,
      );
  }
  for (const section of site.sections) {
    const f = facadeFrame(section.a, section.b),
      windows = Math.max(1, Math.round(f.length / 2.1));
    for (let i = 0; i <= windows; i++) {
      const t = i / windows,
        ceiling = section.ceilingAt(t, true),
        low = section.heightAt(t) + (section.edge === 0 ? 0.6 : 0.09),
        p = section.back(t, (low + ceiling) / 2);
      p[0] += f.outward[0] * 0.025;
      p[2] += f.outward[1] * 0.025;
      mesh.box(
        p,
        0.06,
        ceiling - low,
        0.09,
        m.metal,
        -Math.atan2(
          section.backB[1] - section.backA[1],
          section.backB[0] - section.backA[0],
        ),
      );
    }
  }
  for (const [section, t, direction] of [
    [site.sections[0], 0, 1],
    [site.sections.at(-1)!, 1, -1],
  ] as const) {
    const f = facadeFrame(section.a, section.b),
      p = f.p(t * f.length, 0),
      b: Point = t ? section.backB : section.backA,
      ceiling = section.ceilingAt(t),
      rearCeiling = section.ceilingAt(t, true);
    quad(
      m.panel,
      [p, [b[0], 0, b[1]], [b[0], rearCeiling, b[1]], [p[0], ceiling, p[2]]],
      [-f.outward[1] * direction, 0, f.outward[0] * direction],
    );
  }
  for (const pier of site.piers) {
    // Warp both caps to the graded floor and planar soffit contract. A flat cylinder
    // cap otherwise leaves one edge floating or cuts through the sloping roof.
    const geometry = new T.CylinderGeometry(pier.radius, pier.radius, 1, 24),
      position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const x = pier.point[0] + position.getX(i),
        z = pier.point[1] + position.getZ(i),
        floor = site.floorAt(x, z) ?? site.floorAt(...pier.point)!,
        bottom = Math.max(0, floor - 0.14),
        top = site.canopyTopAt(x, z) - 0.64 + 0.12,
        t = position.getY(i) + 0.5;
      position.setXYZ(i, x, bottom + (top - bottom) * t, z);
    }
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
    mesh.add(geometry, m.panel);
  }
}
