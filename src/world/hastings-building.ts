import * as T from "three";
import clipping from "polygon-clipping";
import { ArchitecturalMesh, facadeFrame } from "./architectural-mesh";
import { Batcher } from "./geometry";
import { centroid, type Building, type Point } from "./data";
import type { Materials } from "./materials";
import type { CollisionWorld } from "./collision";
import type { ReflectionProbeSpec } from "../rendering/reflection-probes";
import source from "./hastings-building-map.json";

export const HASTINGS_BUILDING_ID = "w181355204";
export const HASTINGS_PART_IDS = new Set(
  source.parts.slice(1).map((p) => p.id),
);
const ring = (p: number[][]): Point[] => {
  let points = p.slice(0, -1) as Point[];
  const area = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area < 0) points = points.reverse();
  return [...points, points[0]];
};
export const HASTINGS_PARENT = ring(source.parts[0].pts);
export const HASTINGS_TOWER = ring(source.parts[1].pts);
// No source height for the small overlapping part: interpreted as roof equipment
// enclosure, never another full-height overlapping tower.
export const HASTINGS_ROOF_PART = clipping.intersection(
  [HASTINGS_TOWER],
  [ring(source.parts[2].pts)],
);
export const HASTINGS_HEIGHT = 48; // Existing 15 levels × 3.2 m; no surveyed height claim.
export const HASTINGS_LOBBY = 4.8;

/** Named original exterior; existing parent collision remains the authority. */
export function hastingsBuilding(
  b: Building,
  batch: Batcher,
  m: Materials,
  collision: CollisionWorld,
  refs: ReflectionProbeSpec[] = [],
) {
  if (HASTINGS_PART_IDS.has(b.id)) return true;
  if (b.id !== HASTINGS_BUILDING_ID) return false;
  const saved = batch.offsetY;
  batch.offsetY = 0;
  try {
    const centre = centroid(HASTINGS_PARENT.slice(0, -1).flat()),
      base = collision.groundHeight(...centre);
    const mesh = new ArchitecturalMesh(batch, ...centre);
    const material = (
      name: string,
      color: number,
      roughness: number,
      metalness = 0,
    ) =>
      new T.MeshStandardMaterial({
        name: `1199 West Hastings — ${name}`,
        color,
        roughness,
        metalness,
      });
    const stone = material("pale concrete slab edges", 0xb8b9b0, 0.83);
    stone.map = m.texture("cast-concrete/color.jpg", true);
    stone.normalMap = m.texture("cast-concrete/normal.jpg");
    stone.normalScale.set(0.055, 0.055);
    const band = material("dark horizontal spandrels", 0x3b4848, 0.59, 0.25);
    const metal = material("fine aluminium mullions", 0x7b8b8b, 0.4, 0.6);
    const shadow = material("recessed entrance backplanes", 0x253532, 0.93);
    shadow.side = T.DoubleSide;
    const roof = material("roof membrane", 0x67706d, 0.97);
    const glass = material(
      "continuous reflective blue-grey glazing",
      0x607b85,
      0.22,
      0.58,
    );
    glass.envMapIntensity = 0.34;
    // Keep glass opaque; fine geometry produces depth without a transparent pass.
    const front = (
      f: ReturnType<typeof facadeFrame>,
      mat: T.Material,
      a: number,
      z: number,
      lo: number,
      hi: number,
      depth = 0,
    ) =>
      mesh.quad(
        mat,
        f.p(a, base + lo, depth),
        f.p(a, base + hi, depth),
        f.p(z, base + hi, depth),
        f.p(z, base + lo, depth),
        [a / 2, lo / 2, a / 2, hi / 2, z / 2, hi / 2, z / 2, lo / 2],
      );
    const floorHeight = (HASTINGS_HEIGHT - HASTINGS_LOBBY) / 14;
    for (let i = 0; i < HASTINGS_TOWER.length - 1; i++) {
      const f = facadeFrame(HASTINGS_TOWER[i], HASTINGS_TOWER[i + 1]);
      if (f.length < 0.1) continue;
      for (let floor = 0; floor < 14; floor++) {
        const bottom = HASTINGS_LOBBY + floor * floorHeight,
          top = bottom + floorHeight;
        front(f, band, 0, f.length, bottom, bottom + 0.34);
        front(f, stone, 0, f.length, bottom + 0.04, bottom + 0.12, -0.005);
        front(f, glass, 0, f.length, bottom + 0.34, top - 0.075, 0.13);
        // Return ledges connect the inset window plane to its enclosing bands.
        mesh.quad(
          band,
          f.p(0, base + bottom + 0.34),
          f.p(f.length, base + bottom + 0.34),
          f.p(f.length, base + bottom + 0.34, 0.13),
          f.p(0, base + bottom + 0.34, 0.13),
        );
        mesh.quad(
          metal,
          f.p(0, base + top - 0.075, 0.13),
          f.p(f.length, base + top - 0.075, 0.13),
          f.p(f.length, base + top - 0.075),
          f.p(0, base + top - 0.075),
        );
        const panes = Math.max(1, Math.round(f.length / 1.5));
        for (let pane = 0; pane <= panes; pane++) {
          const along = (pane * f.length) / panes;
          front(
            f,
            metal,
            Math.max(0, along - 0.018),
            Math.min(f.length, along + 0.018),
            bottom + 0.34,
            top - 0.075,
            0.09,
          );
        }
      }
      front(
        f,
        band,
        0,
        f.length,
        HASTINGS_HEIGHT - 0.08,
        HASTINGS_HEIGHT + 0.3,
      );
      front(
        f,
        stone,
        0,
        f.length,
        HASTINGS_HEIGHT + 0.2,
        HASTINGS_HEIGHT + 0.3,
        -0.005,
      );
      // Raised tower and a recessed closed exterior shell: columns are scenery,
      // not an invitation into an enterable interior or changed collision volume.
      front(f, shadow, 0, f.length, 0.08, HASTINGS_LOBBY - 0.28, 0.8);
      const columns = Math.max(1, Math.round(f.length / 4.5));
      for (let c = 0; c < columns; c++) {
        const along = ((c + 0.5) * f.length) / columns,
          p = f.p(along, 0, 0.42);
        const ground = collision.groundHeight(p[0], p[2]);
        const top = base + HASTINGS_LOBBY - 0.16;
        const y0 = Math.min(ground - 0.08, top - 0.2);
        mesh.box(
          [p[0], (y0 + top) / 2, p[2]],
          0.4,
          top - y0,
          0.42,
          band,
          -Math.atan2(
            HASTINGS_TOWER[i + 1][1] - HASTINGS_TOWER[i][1],
            HASTINGS_TOWER[i + 1][0] - HASTINGS_TOWER[i][0],
          ),
        );
      }
    }
    mesh.cap([HASTINGS_TOWER], base + HASTINGS_LOBBY - 0.18, shadow);
    mesh.cap([HASTINGS_TOWER], base + HASTINGS_HEIGHT + 0.08, roof);
    // Only a low enclosure uses the second mapped outline; its height is authored.
    for (const poly of HASTINGS_ROOF_PART) {
      mesh.skin(
        poly as Point[][],
        base + HASTINGS_HEIGHT + 0.08,
        base + HASTINGS_HEIGHT + 1.05,
        band,
      );
      mesh.cap(poly as Point[][], base + HASTINGS_HEIGHT + 1.05, roof);
    }
    // Close the surrounding podium skirt to actual grades without widening paths.
    for (let i = 0; i < HASTINGS_PARENT.length - 1; i++) {
      const f = facadeFrame(HASTINGS_PARENT[i], HASTINGS_PARENT[i + 1]);
      const low =
        Math.min(
          collision.groundHeight(...HASTINGS_PARENT[i]),
          collision.groundHeight(...HASTINGS_PARENT[i + 1]),
        ) - 0.08;
      front(f, stone, 0, f.length, low - base, 0.12);
    }
    refs.push({
      name: "1199 West Hastings harbour-facing glass",
      position: [centre[0] + 14, base + 23, centre[1] - 30],
      materials: [glass],
      intensity: { day: 0.34, night: 0.16 },
    });
    mesh.finish();
    return true;
  } finally {
    batch.offsetY = saved;
  }
}
