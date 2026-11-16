import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Building } from "./data";
import type { Batcher } from "./geometry";
import source from "./second-narrows-rail-source.json";

export const SECOND_NARROWS_RAIL = source;
type V = [number, number, number];
type Role = "steel" | "concrete" | "hardware" | "counterweight";
const roles: Role[] = ["steel", "concrete", "hardware", "counterweight"];
const points = source.railPoints;
const distances = [0];
for (let i = 1; i < points.length; i++)
  distances.push(
    distances[i - 1] +
      Math.hypot(
        points[i][0] - points[i - 1][0],
        points[i][1] - points[i - 1][1],
      ),
  );
export const SECOND_NARROWS_RAIL_LENGTH = distances.at(-1)!;
/** Metre station follows the retained railway polyline; no highway alignment reuse. */
export function secondNarrowsRailPoint(station: number, across = 0, y = 0): V {
  let i = 1;
  while (i < points.length - 1 && station > distances[i]) i++;
  const a = points[i - 1],
    b = points[i],
    length = distances[i] - distances[i - 1];
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const s = station - distances[i - 1];
  return [a[0] + dx * s + dz * across, y, a[1] + dz * s - dx * across];
}
export const SECOND_NARROWS_TOWER_STATIONS = source.towers.map((tower) => {
  const z =
    tower.pts.filter((_, i) => i % 2).reduce((a, b) => a + b) /
    (tower.pts.length / 2);
  const i = points.findIndex(
    (p, i) => i > 0 && z <= points[i - 1][1] && z >= p[1],
  );
  return (
    distances[i - 1] +
    ((z - points[i - 1][1]) / (points[i][1] - points[i - 1][1])) *
      (distances[i] - distances[i - 1])
  );
});
export function preflightSecondNarrowsRail(buildings: Building[]) {
  return source.towers.every((expected) => {
    const matches = buildings.filter((b) => b.id === expected.id);
    return (
      matches.length === 1 &&
      matches[0].kind === expected.kind &&
      matches[0].levels === expected.levels &&
      (matches[0].height === undefined || matches[0].height === 30) &&
      matches[0].pts.length === expected.pts.length &&
      matches[0].pts.every((v, i) => v === expected.pts[i])
    );
  });
}

export interface RailBridgePart {
  station: number;
  role: Role;
  geometry: T.BufferGeometry;
}
/** Static lowered lift span. Original closed-section geometry; research photos never become textures. */
export function createSecondNarrowsRailGeometry(): RailBridgePart[] {
  const result: RailBridgePart[] = [];
  let bins: Record<Role, T.BufferGeometry[]> = {
    steel: [],
    concrete: [],
    hardware: [],
    counterweight: [],
  };
  function box(size: V, point: V, role: Role = "steel") {
    const g = new T.BoxGeometry(...size);
    g.translate(...point);
    bins[role].push(g);
  }
  function beam(
    a: V,
    b: V,
    width: number,
    depth = width,
    flange = false,
    role: Role = "steel",
  ) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      d = bv.clone().sub(av);
    const q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      d.clone().normalize(),
    );
    const pieces = flange
      ? [
          new T.BoxGeometry(width * 0.2, d.length(), depth),
          new T.BoxGeometry(width, d.length(), depth * 0.16).translate(
            0,
            0,
            depth * 0.42,
          ),
          new T.BoxGeometry(width, d.length(), depth * 0.16).translate(
            0,
            0,
            -depth * 0.42,
          ),
        ]
      : [new T.BoxGeometry(width, d.length(), depth)];
    const centre = av.add(bv).multiplyScalar(0.5);
    for (const g of pieces) {
      g.applyQuaternion(q);
      g.translate(...centre.toArray());
      bins[role].push(g);
    }
  }
  function finish(station: number) {
    // Local coordinates are across/y/relative station; transform once into registered world coordinates.
    for (const role of roles)
      if (bins[role].length) {
        const geometry = mergeGeometries(bins[role])!;
        const positions = geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          const p = secondNarrowsRailPoint(
            station + positions.getZ(i),
            positions.getX(i),
            positions.getY(i),
          );
          positions.setXYZ(i, ...p);
        }
        geometry.computeVertexNormals();
        bins[role].forEach((g) => g.dispose());
        result.push({ station, role, geometry });
      }
    bins = { steel: [], concrete: [], hardware: [], counterweight: [] };
  }
  const e = source.elevation;
  function pier(full: boolean) {
    for (const x of [-3.7, 3.7]) {
      const g = new T.CylinderGeometry(
        full ? 1.8 : 1.2,
        full ? 2.05 : 1.45,
        11.6,
        12,
      );
      g.translate(x, 4.8, 0);
      bins.concrete.push(g);
    }
    box(
      [full ? 12.8 : 10.5, 1.4, full ? 11.8 : 3.5],
      [0, e.pierTop - 0.7, 0],
      "concrete",
    );
    for (const x of [-2.8, 2.8])
      box([0.85, 0.95, 1.8], [x, e.pierTop + 0.475, 0], "hardware");
    if (full) {
      // Open fender ring at waterline, not a new land island.
      for (const x of [-7, 7]) box([0.65, 1.8, 14], [x, 0.8, 0], "hardware");
      for (const z of [-7, 7]) box([14.65, 1.8, 0.65], [0, 0.8, z], "hardware");
    }
  }
  for (const station of SECOND_NARROWS_TOWER_STATIONS) {
    pier(true);
    const levels = [e.pierTop, 20.2, 29.65, 39.1, 48.55, e.frameTop];
    const width = (y: number) =>
      5.4 - ((y - e.pierTop) / (e.frameTop - e.pierTop)) * 0.55;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        beam(
          [sx * width(e.pierTop), e.pierTop, sz * 4.8],
          [sx * width(e.frameTop), e.frameTop, sz * 4.2],
          0.72,
          0.76,
          true,
        );
      }
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1],
        b = levels[i],
        za = 4.8 - (i - 1) * 0.12,
        zb = 4.8 - i * 0.12;
      for (const sign of [-1, 1]) {
        beam([sign * width(a), a, -za], [sign * width(b), b, zb], 0.32, 0.42);
        beam([sign * width(a), a, za], [sign * width(b), b, -zb], 0.32, 0.42);
        beam([sign * width(b), b, -zb], [sign * width(b), b, zb], 0.42, 0.46);
        // End faces leave the actual low rail portal open; no X through a train envelope.
        if (i > 1) {
          beam([-width(a), a, sign * za], [width(b), b, sign * zb], 0.3, 0.38);
          beam([width(a), a, sign * za], [-width(b), b, sign * zb], 0.3, 0.38);
        }
        beam([-width(b), b, sign * zb], [width(b), b, sign * zb], 0.42, 0.46);
      }
    }
    // Broad suspended counterweight is high in the photographed lowered configuration.
    box([7.1, 8, 2.4], [0, 48, 0], "counterweight");
    for (const x of [-3.4, 3.4])
      for (const z of [-2.2, 2.2])
        beam([x, 14, z], [x, 59, z], 0.07, 0.07, false, "hardware");
    // Small enclosed drive house with rounded roof shoulders, not a multi-storey facade.
    const shape = new T.Shape();
    shape.moveTo(-5.8, 58);
    shape.lineTo(5.8, 58);
    shape.lineTo(5.8, 62.6);
    shape.quadraticCurveTo(5.8, 64, 4.4, 64);
    shape.lineTo(-4.4, 64);
    shape.quadraticCurveTo(-5.8, 64, -5.8, 62.6);
    shape.closePath();
    const house = new T.ExtrudeGeometry(shape, {
      depth: 10.2,
      bevelEnabled: false,
      curveSegments: 4,
    });
    // Other primitives are indexed; preserve consistent merge attributes.
    const indexed = house.index
      ? house
      : house.setIndex(
          Array.from({ length: house.attributes.position.count }, (_, i) => i),
        );
    indexed.translate(0, 0, -5.1);
    bins.steel.push(indexed);
    for (const z of [-5.115, 5.115])
      for (const x of [-3.7, 0, 3.7])
        box([0.75, 1.5, 0.025], [x, 61, z], "hardware");
    finish(station);
  }
  const [south, north] = SECOND_NARROWS_TOWER_STATIONS;
  const spans: { a: number; b: number; main: boolean }[] = [
    { a: south, b: north, main: true },
  ];
  for (const [start, end, count] of [
    [0, south, source.southApproachSpans],
    [north, SECOND_NARROWS_RAIL_LENGTH, source.northApproachSpans],
  ])
    for (let i = 0; i < count; i++)
      spans.push({
        a: start + ((end - start) * i) / count,
        b: start + ((end - start) * (i + 1)) / count,
        main: false,
      });
  for (const { a, b, main } of spans) {
    const length = b - a,
      panels = main ? source.mainPanels : source.approachPanels;
    const station = (a + b) / 2,
      low = -length / 2,
      y = e.railTop - 0.3;
    const top = (i: number) =>
      y +
      (main
        ? 6 + 4.5 * Math.min(1, Math.min(i, panels - i) / 7)
        : Math.min(7.2, Math.min(i, panels - i) * 7.2));
    for (const sign of [-1, 1]) {
      const x = sign * 2.8;
      beam([x, y - 0.55, low], [x, y - 0.55, -low], 0.6, 0.8, true);
      for (let i = 0; i < panels; i++) {
        const z0 = low + (i * length) / panels,
          z1 = low + ((i + 1) * length) / panels;
        beam([x, top(i), z0], [x, top(i + 1), z1], 0.48, 0.65, true);
        if (i) beam([x, y, z0], [x, top(i), z0], 0.3, 0.36);
        beam(
          [x, i < panels / 2 ? top(i) : y, z0],
          [x, i < panels / 2 ? y : top(i + 1), z1],
          0.3,
          0.32,
        );
      }
    }
    for (let i = 0; i <= panels; i++) {
      const z = low + (i * length) / panels;
      beam([-2.8, y - 0.5, z], [2.8, y - 0.5, z], 0.35, 0.4);
      if (top(i) > y + 5) beam([-2.8, top(i), z], [2.8, top(i), z], 0.25, 0.3);
      if (i && top(i - 1) > y + 5 && top(i) > y + 5)
        beam(
          [-2.8, top(i - 1), z - length / panels],
          [2.8, top(i), z],
          0.18,
          0.22,
        );
    }
    // Stringers seat on the transverse floor beams and meet sleeper undersides.
    for (const x of [-0.7175, 0.7175])
      beam([x, e.railTop - 0.49, low], [x, e.railTop - 0.49, -low], 0.16, 0.3);
    for (const x of [-0.7175, 0.7175])
      beam(
        [x, e.railTop - 0.09, low],
        [x, e.railTop - 0.09, -low],
        0.085,
        0.18,
        false,
        "hardware",
      );
    for (let z = low + 0.4; z < -low; z += 0.8)
      box([2.5, 0.18, 0.22], [0, y + 0.03, z], "hardware");
    finish(station);
  }
  // Every fixed approach terminates at a real bearing; only the two mapped end abutments touch land.
  const supports = new Set(
    spans.filter((s) => !s.main).flatMap((s) => [s.a, s.b]),
  );
  for (const station of supports)
    if (
      !SECOND_NARROWS_TOWER_STATIONS.some((v) => Math.abs(v - station) < 1e-6)
    ) {
      pier(false);
      finish(station);
    }
  return result;
}

/** Atomic replacement: if either source tower changed, retain both generic shells. */
export function createSecondNarrowsRailAssembly(buildings: Building[]) {
  const valid = preflightSecondNarrowsRail(buildings);
  let emitted = false;
  return (building: Building, batch: Batcher) => {
    if (!valid || !source.towers.some((b) => b.id === building.id))
      return false;
    if (!emitted) {
      const colors: Record<Role, number> = {
        steel: 0x4b6150,
        concrete: 0x8c9087,
        hardware: 0x353c38,
        counterweight: 0x73534a,
      };
      const materials = Object.fromEntries(
        roles.map((role) => [
          role,
          new T.MeshStandardMaterial({
            name: `Second Narrows railway ${role}`,
            color: colors[role],
            roughness: role === "concrete" ? 0.93 : 0.76,
            metalness: role === "hardware" ? 0.45 : 0,
          }),
        ]),
      ) as Record<Role, T.MeshStandardMaterial>;
      for (const part of createSecondNarrowsRailGeometry()) {
        const p = secondNarrowsRailPoint(part.station);
        batch.add(
          part.geometry,
          materials[part.role],
          p[0],
          p[2],
          `second-narrows-rail-${part.role}`,
        );
      }
      emitted = true;
    }
    return true;
  };
}
