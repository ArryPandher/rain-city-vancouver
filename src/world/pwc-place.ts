import * as T from "three";
import type { Point } from "./data";
import { Batcher, flatPolygon } from "./geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
  type Vertex3,
} from "./architectural-mesh";
import type { PwcPlaceMaterials } from "./pwc-place-materials";
import { buildPwcLobbyFrontage } from "./pwc-lobby";
import { createPwcLobbySite } from "./pwc-lobby-site";
import {
  PWC_PLACE_ID as ID,
  PWC_PLACE_ORIGIN as centre,
  PWC_PLACE_RING as base,
  PWC_PLACE_TOWER_RING as tower,
  PWC_PLACE_SPINE_RING as spine,
  PWC_PLACE_CROWN_RING as crown,
  PWC_PLACE_BODY_ROOF as bodyRoof,
  PWC_PLACE_SPINE_ROOF as spineRoof,
  PWC_PLACE_LOBBY_TOP as lobbyTop,
  PWC_PLACE_BODY_TOP as bodyTop,
  PWC_PLACE_SPINE_TOP as spineTop,
  PWC_PLACE_HEIGHT as height,
  pwcPlaceFacadeStyle,
  pwcPlaceHeight,
  pwcPlaceLevel,
} from "./pwc-place-site";
export type { PwcPlaceMaterials } from "./pwc-place-materials";

/** Source-registered PwC tower only; the shared parkade remains a separate building. */
export function buildPwcPlace(
  batch: Batcher,
  building: { id: string; pts: number[] },
  m: PwcPlaceMaterials,
  groundHeight?: (x: number, z: number) => number,
) {
  if (building.id !== ID) return false;
  const mesh = new ArchitecturalMesh(batch, ...centre);
  const lobbySite = createPwcLobbySite(
    groundHeight ?? (() => batch.offsetY),
    batch.offsetY,
  );
  const quad = (material: T.Material, p: Vertex3[], normal: Vertex3) => {
    const cross = new T.Vector3(...p[1])
      .sub(new T.Vector3(...p[0]))
      .cross(new T.Vector3(...p[2]).sub(new T.Vector3(...p[0])));
    if (cross.dot(new T.Vector3(...normal)) < 0) p = [p[0], p[3], p[2], p[1]];
    const w = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[1])),
      h = new T.Vector3(...p[0]).distanceTo(new T.Vector3(...p[3]));
    mesh.quad(material, p[0], p[1], p[2], p[3], [0, 0, w, 0, w, h, 0, h]);
  };
  const face = (
    f: ReturnType<typeof facadeFrame>,
    material: T.Material,
    left: number,
    right: number,
    low: number,
    high: number,
    depth = 0,
  ) => {
    if (right - left < 0.001 || high - low < 0.001) return;
    quad(
      material,
      [
        f.p(left, low, depth),
        f.p(right, low, depth),
        f.p(right, high, depth),
        f.p(left, high, depth),
      ],
      [f.outward[0], 0, f.outward[1]],
    );
  };
  const fin = (
    f: ReturnType<typeof facadeFrame>,
    u: number,
    low: number,
    high: number,
    width: number,
    projection: number,
    material = m.metal,
  ) => {
    mesh.box(
      f.p(u, (low + high) / 2, (0.2 - projection) / 2),
      width,
      high - low,
      0.2 + projection,
      material,
      -Math.atan2(f.outward[0], -f.outward[1]),
    );
  };
  const rail = (
    f: ReturnType<typeof facadeFrame>,
    y: number,
    thick: number,
    projection: number,
    material = m.metal,
  ) => {
    mesh.box(
      f.p(f.length / 2, y, (0.2 - projection) / 2),
      f.length,
      thick,
      0.2 + projection,
      material,
      -Math.atan2(f.outward[0], -f.outward[1]),
    );
  };
  const cap = (rings: Point[][], y: number, material: T.Material) =>
    mesh.add(
      flatPolygon(
        rings[0].flat(),
        rings.slice(1).map((r) => r.flat()),
        y,
        1,
      ),
      material,
    );

  // The mapped outline stays fixed. Howe recesses stop at closed rear glazing;
  // no through-building passage or geometry beyond that outline is introduced.
  cap([base], 0, m.backing);
  cap([base], lobbyTop, m.roof);
  for (let i = 0; i < base.length; i++) {
    if (buildPwcLobbyFrontage(mesh, i, m, lobbySite)) continue;
    const f = facadeFrame(base[i], base[(i + 1) % base.length]),
      left = Math.min(0.9, f.length / 3),
      right = f.length - (i === base.length - 1 ? 2.2 : left);
    face(f, m.stone, 0, f.length, 0, 0.18);
    face(f, m.stone, 0, left, 0.18, 7.75);
    face(f, m.stone, right, f.length, 0.18, 7.75);
    face(f, m.backing, left, right, 0.18, 7.75, 1.9);
    face(f, m.lobbyGlass, left, right, 0.18, 7.75, 1.12);
    face(f, m.metal, 0, f.length, 7.75, lobbyTop);
    const along: Vertex3 = [-f.outward[1], 0, f.outward[0]];
    quad(
      m.stone,
      [
        f.p(left, 0.18),
        f.p(left, 0.18, 1.95),
        f.p(left, 7.75, 1.95),
        f.p(left, 7.75),
      ],
      along,
    );
    quad(
      m.stone,
      [
        f.p(right, 0.18),
        f.p(right, 7.75),
        f.p(right, 7.75, 1.95),
        f.p(right, 0.18, 1.95),
      ],
      along.map((v) => -v) as Vertex3,
    );
    for (const [y, normal] of [
      [0.18, [0, 1, 0]],
      [7.75, [0, -1, 0]],
    ] as const)
      quad(
        m.stone,
        [f.p(left, y), f.p(right, y), f.p(right, y, 1.95), f.p(left, y, 1.95)],
        [...normal],
      );
    const bays = Math.max(1, Math.round((right - left) / 2));
    for (let j = 0; j <= bays; j++) {
      const u = left + ((right - left) * j) / bays;
      mesh.box(
        f.p(u, 3.965, 1.08),
        0.065,
        7.57,
        0.12,
        m.metal,
        -Math.atan2(f.outward[0], -f.outward[1]),
      );
    }
    for (const y of [3.15, 6.8])
      face(f, m.metal, left, right, y, y + 0.09, 1.04);
    if (f.length < 6) continue;
    const columns =
      i === 0
        ? [1.1, 13.9, f.length - 1.1]
        : Array.from(
            { length: Math.max(2, Math.round(f.length / 6.5)) },
            (_, j) => j,
          );
    // Major columns are sparse structural anchors, rather than a column on
    // every vertex of the curved base. The Howe entry glazing stays between them.
    const locations =
      i === 0
        ? columns
        : columns.map(
            (_, j) =>
              1.6 +
              (j * (f.length - 1.6 - (i === base.length - 1 ? 2.8 : 1.6))) /
                Math.max(1, columns.length - 1),
          );
    for (const u of locations) {
      const g = new T.CylinderGeometry(0.48, 0.48, 7.75, 20),
        uv = g.getAttribute("uv");
      for (let j = 0; j < uv.count; j++)
        uv.setXY(j, uv.getX(j) * Math.PI * 0.96, uv.getY(j) * 7.75);
      g.translate(...f.p(u, 7.75 / 2, 0.53));
      mesh.add(g, m.stone);
    }
  }

  for (let i = 0; i < tower.length; i++) {
    const f = facadeFrame(tower[i], tower[(i + 1) % tower.length]),
      inward = f.p(f.length / 2, 0, 0.12),
      style = pwcPlaceFacadeStyle(inward[0], inward[2]),
      vertical = style === "vertical",
      pitch = vertical ? 1.016 : 1.25,
      bays = Math.max(1, Math.round(f.length / pitch));
    for (let level = 2; level < 20; level++) {
      const low = pwcPlaceLevel(level),
        high = pwcPlaceLevel(level + 1),
        sill = low + (vertical ? 0.7 : 0.62);
      face(f, m.backing, 0, f.length, low, high, 0.28);
      face(f, m.spandrel, 0, f.length, low, sill, 0.17);
      face(f, m.glass, 0, f.length, sill, high, 0.2);
      rail(f, low + 0.055, vertical ? 0.11 : 0.2, vertical ? 0.03 : 0.17);
      if (!vertical) rail(f, low + 0.35, 0.05, 0.13);
      // Every glass strip has an actual sill return into its shadow cavity.
      quad(
        m.metal,
        [
          f.p(0, sill, 0.17),
          f.p(f.length, sill, 0.17),
          f.p(f.length, sill, 0.28),
          f.p(0, sill, 0.28),
        ],
        [0, 1, 0],
      );
    }
    for (let j = 0; j <= bays; j++)
      fin(
        f,
        (j * f.length) / bays,
        lobbyTop,
        bodyTop,
        vertical ? 0.065 : 0.045,
        vertical ? 0.15 : 0.025,
      );
    rail(f, bodyTop - 0.07, 0.14, 0.12);
  }
  for (const polygon of bodyRoof) cap(polygon, bodyTop, m.roof);
  for (const polygon of spineRoof) cap(polygon, spineTop, m.roof);
  cap([crown], height, m.roof);
  for (const [ring, high] of [
    [spine, spineTop],
    [crown, height],
  ] as const) {
    for (let i = 0; i < ring.length; i++) {
      const f = facadeFrame(ring[i], ring[(i + 1) % ring.length]),
        outside = f.p(f.length / 2, 0, -0.04),
        hiddenHeight = pwcPlaceHeight(outside[0], outside[2]),
        low = Math.max(bodyTop, Math.min(high, hiddenHeight));
      if (high - low < 0.01) continue;
      face(f, m.backing, 0, f.length, low, high, 0.2);
      face(f, m.spandrel, 0, f.length, low, high, 0.13);
      const bays = Math.max(1, Math.round(f.length / 1.016));
      for (let j = 0; j <= bays; j++)
        fin(f, (j * f.length) / bays, low, high, 0.055, 0.08);
      rail(f, low + 0.08, 0.16, 0.06);
      rail(f, high - 0.08, 0.16, 0.06);
    }
  }
  mesh.finish();
  return true;
}
