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
import { buildFairmontTransferBand } from "./fairmont-transfer-band";

/** Estimated visual lining behind fixed, collision-closed glazing. The MCM
 * photo establishes depth and pale/dark structure, not these dimensions. */
export const FAIRMONT_LOBBY_CAVITY = {
  lowerDepth: 1.35,
  wallDepth: 1.75,
  bayExtraDepth: 0.5,
  upperDepth: 1.9,
  lowerBand: 1,
  upperBand: 0.55,
  ribFront: 0.6,
  ribWidth: 0.34,
  divisionTop: 8,
  divisionThickness: 0.06,
} as const;

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
  // Broad centres follow the structural-pier bays, not individual glass leaves.
  // Short terminal remnants stay on the original wall plane.
  const bayRecesses = site.sections.map((section) => {
    const stations = [
      0,
      ...site.piers.filter((p) => p.edge === section.edge).map((p) => p.along),
      section.length,
    ].sort((a, b) => a - b);
    return stations.slice(1).flatMap((end, i) => {
      const start = stations[i],
        span = end - start;
      return span < 2.8
        ? []
        : [
            {
              left: (start + span * 0.25) / section.length,
              right: (end - span * 0.25) / section.length,
            },
          ];
    });
  });
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
    quad(
      m.panel,
      [[a[0], a[1] - 0.18, a[2]], [b[0], b[1] - 0.18, b[2]], b, a],
      normal,
    );
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
    // The former 8 cm dark backing made transmitted views read as black paint.
    // These connected planes form a closed, stepped visual cavity behind the
    // unchanged glass. There is no doorway or extension to the playable floor.
    const cavity = FAIRMONT_LOBBY_CAVITY,
      lowerTopL = a[1] + cavity.lowerBand,
      lowerTopR = b[1] + cavity.lowerBand,
      upperLowL = rearCeilingL - cavity.upperBand,
      upperLowR = rearCeilingR - cavity.upperBand;
    const wall = (
      mat: T.Material,
      loL: number,
      loR: number,
      hiL: number,
      hiR: number,
      inset: number,
    ) =>
      quad(
        mat,
        [
          back(l, loL, inset),
          back(r, loR, inset),
          back(r, hiR, inset),
          back(l, hiL, inset),
        ],
        normal,
      );
    const shelf = (
      mat: T.Material,
      yL: number,
      yR: number,
      front: number,
      rear: number,
      up: boolean,
    ) =>
      quad(
        mat,
        [
          back(l, yL, front),
          back(r, yR, front),
          back(r, yR, rear),
          back(l, yL, rear),
        ],
        [0, up ? 1 : -1, 0],
      );
    // Neutral lower lining, a farther grey field and a narrow dark upper zone
    // have different real depths; the window is not backed by one bright card.
    wall(m.lobbyLining, a[1], b[1], lowerTopL, lowerTopR, cavity.lowerDepth);
    const recesses = bayRecesses[panel.section],
      cuts = [
        l,
        ...recesses
          .flatMap((bay) => [bay.left, bay.right])
          .filter((t) => t > l + 1e-8 && t < r - 1e-8),
        r,
      ].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const left = cuts[i - 1],
        right = cuts[i],
        middle = (left + right) / 2,
        inset =
          cavity.wallDepth +
          (recesses.some((bay) => middle > bay.left && middle < bay.right)
            ? cavity.bayExtraDepth
            : 0),
        loL = section.heightAt(left) + cavity.lowerBand,
        loR = section.heightAt(right) + cavity.lowerBand,
        hiL = section.ceilingAt(left, true) - cavity.upperBand,
        hiR = section.ceilingAt(right, true) - cavity.upperBand;
      quad(
        m.lobbyRear,
        [
          back(left, loL, inset),
          back(right, loR, inset),
          back(right, hiR, inset),
          back(left, hiL, inset),
        ],
        normal,
      );
      quad(
        m.lobbyLining,
        [
          back(left, loL, cavity.lowerDepth),
          back(right, loR, cavity.lowerDepth),
          back(right, loR, inset),
          back(left, loL, inset),
        ],
        [0, 1, 0],
      );
      quad(
        m.lobbyLining,
        [
          back(left, hiL, inset),
          back(right, hiR, inset),
          back(right, hiR, cavity.upperDepth),
          back(left, hiL, cavity.upperDepth),
        ],
        [0, inset <= cavity.upperDepth ? 1 : -1, 0],
      );
      // Continue the retained cap lining into the deeper centre, so its
      // upper/lower sections stay closed behind the unchanged glass.
      const divisionBottom = cavity.divisionTop - cavity.divisionThickness;
      if (
        inset > cavity.upperDepth &&
        Math.max(section.heightAt(left), section.heightAt(right)) <
          divisionBottom &&
        Math.min(
          section.ceilingAt(left, true),
          section.ceilingAt(right, true),
        ) > cavity.divisionTop
      )
        quad(
          m.lobbyLining,
          [
            back(left, divisionBottom, cavity.upperDepth),
            back(right, divisionBottom, cavity.upperDepth),
            back(right, divisionBottom, inset),
            back(left, divisionBottom, inset),
          ],
          [0, -1, 0],
        );
    }
    wall(
      m.dark,
      upperLowL,
      upperLowR,
      rearCeilingL,
      rearCeilingR,
      cavity.upperDepth,
    );
    shelf(m.roof, a[1], b[1], 0, cavity.lowerDepth, true);
    shelf(
      m.lobbyLining,
      rearCeilingL,
      rearCeilingR,
      0,
      cavity.upperDepth,
      false,
    );
    // Existing podium cap remains at Y=8 behind the facade. Give its exposed
    // underside and edge thickness instead of leaving a one-sided roof sheet.
    const divisionBottom = cavity.divisionTop - cavity.divisionThickness;
    if (
      Math.max(a[1], b[1]) < divisionBottom &&
      Math.min(rearCeilingL, rearCeilingR) > cavity.divisionTop
    ) {
      shelf(
        m.lobbyLining,
        divisionBottom,
        divisionBottom,
        0.04,
        cavity.upperDepth,
        false,
      );
      wall(
        m.lobbyLining,
        divisionBottom,
        divisionBottom,
        cavity.divisionTop,
        cavity.divisionTop,
        0.04,
      );
    }
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
  buildFairmontTransferBand(mesh, m.panel, site);
  for (const section of site.sections) {
    const f = facadeFrame(section.a, section.b),
      windows = Math.max(1, Math.round(f.length / 2.1)),
      cavity = FAIRMONT_LOBBY_CAVITY,
      rear = (t: number, y: number, inset: number): Vertex3 => {
        const p = section.back(t, y);
        return [p[0] - f.outward[0] * inset, y, p[2] - f.outward[1] * inset];
      };
    for (const bay of bayRecesses[site.sections.indexOf(section)]) {
      for (const [t, direction] of [
        [bay.left, 1],
        [bay.right, -1],
      ] as const) {
        const low = section.heightAt(t) + cavity.lowerBand,
          high = section.ceilingAt(t, true) - cavity.upperBand;
        quad(
          m.lobbyLining,
          [
            rear(t, low, cavity.wallDepth),
            rear(t, low, cavity.wallDepth + cavity.bayExtraDepth),
            rear(t, high, cavity.wallDepth + cavity.bayExtraDepth),
            rear(t, high, cavity.wallDepth),
          ],
          [-f.outward[1] * direction, 0, f.outward[0] * direction],
        );
      }
    }
    // Close each section at its actual glass edge. Adjacent angled sections
    // meet behind these opaque returns, so oblique views never escape the shell.
    for (const [t, direction] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const low = section.heightAt(t),
        high = section.ceilingAt(t, true);
      quad(
        m.lobbyLining,
        [
          rear(t, low, 0),
          rear(t, low, cavity.upperDepth),
          rear(t, high, cavity.upperDepth),
          rear(t, high, 0),
        ],
        [-f.outward[1] * direction, 0, f.outward[0] * direction],
      );
    }
    // Restrained lining ribs align with the existing round-pier stations;
    // they are rear structure, never another row of public-space columns.
    for (const pier of site.piers.filter((p) => p.edge === section.edge)) {
      const t = Math.max(
          cavity.ribWidth / f.length,
          Math.min(1 - cavity.ribWidth / f.length, pier.along / f.length),
        ),
        l = t - cavity.ribWidth / (2 * f.length),
        r = t + cavity.ribWidth / (2 * f.length),
        lowL = section.heightAt(l),
        lowR = section.heightAt(r),
        highL = section.ceilingAt(l, true),
        highR = section.ceilingAt(r, true),
        n: Vertex3 = [f.outward[0], 0, f.outward[1]],
        along: Vertex3 = [-f.outward[1], 0, f.outward[0]];
      quad(
        m.lobbyLining,
        [
          rear(l, lowL, cavity.ribFront),
          rear(r, lowR, cavity.ribFront),
          rear(r, highR, cavity.ribFront),
          rear(l, highL, cavity.ribFront),
        ],
        n,
      );
      quad(
        m.lobbyLining,
        [
          rear(l, lowL, cavity.ribFront),
          rear(l, lowL, cavity.upperDepth),
          rear(l, highL, cavity.upperDepth),
          rear(l, highL, cavity.ribFront),
        ],
        along,
      );
      quad(
        m.lobbyLining,
        [
          rear(r, lowR, cavity.ribFront),
          rear(r, highR, cavity.ribFront),
          rear(r, highR, cavity.upperDepth),
          rear(r, lowR, cavity.upperDepth),
        ],
        along.map((v) => -v) as Vertex3,
      );
      quad(
        m.lobbyLining,
        [
          rear(l, lowL, cavity.ribFront),
          rear(r, lowR, cavity.ribFront),
          rear(r, lowR, cavity.upperDepth),
          rear(l, lowL, cavity.upperDepth),
        ],
        [0, -1, 0],
      );
      quad(
        m.lobbyLining,
        [
          rear(l, highL, cavity.ribFront),
          rear(l, highL, cavity.upperDepth),
          rear(r, highR, cavity.upperDepth),
          rear(r, highR, cavity.ribFront),
        ],
        [0, 1, 0],
      );
    }
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
      floor = section.heightAt(t) - 0.18,
      p = f.p(t * f.length, floor),
      b: Point = t ? section.backB : section.backA,
      ceiling = section.ceilingAt(t),
      rearCeiling = section.ceilingAt(t, true);
    quad(
      m.panel,
      [
        p,
        [b[0], floor, b[1]],
        [b[0], rearCeiling, b[1]],
        [p[0], ceiling, p[2]],
      ],
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
        bottom = floor - 0.14,
        top = site.canopyTopAt(x, z) - 0.64 + 0.12,
        t = position.getY(i) + 0.5;
      position.setXYZ(i, x, bottom + (top - bottom) * t, z);
    }
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
    mesh.add(geometry, m.panel);
  }
}
