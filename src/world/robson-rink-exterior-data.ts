import { gridUV, gridXZ } from "./robson-site";

export type RobsonDome = {
  id: "north" | "south";
  centerUV: readonly [number, number];
  sourceRadii: readonly [number, number];
  radii: readonly [number, number];
  angle: number;
};

/** Opt-in exterior approximation. See docs/sources/robson-rink-exterior.md.
 * The corrected north trace excludes the adjacent sunken plaza/stair area.
 * South's tree-obscured closure is inferred from its visible glazed arc. */
export const ROBSON_RINK_EXTERIOR = {
  streetY: 0.08,
  rimY: 0.11,
  rinkY: -4.6,
  rinkDatumRange: [-5.2, -4] as const,
  roofLow: -4.6 + 3.6576,
  roofHigh: -4.6 + 6.5532,
  openingMargin: 0.18,
  wallThickness: 0.32,
  floorThickness: 0.2,
  guardHeight: 1.04,
  segments: 64,
  conservativeInset: 1.2,
  domes: [
    {
      id: "north",
      centerUV: [-103.52847066, 2.9859083],
      sourceRadii: [9.22164775, 8.07420181],
      radii: [9.22164775 - 1.2, 8.07420181 - 1.2],
      angle: Math.atan2(0.53519781, 0.84472676),
    },
    {
      id: "south",
      centerUV: [-139.98545773, 3.80643455],
      sourceRadii: [8.85754233, 7.72420371],
      radii: [8.85754233 - 1.2, 7.72420371 - 1.2],
      angle: Math.atan2(-0.19990804, 0.97981466),
    },
  ] as readonly RobsonDome[],
} as const;

export function robsonDomeXZ(
  dome: RobsonDome,
  a: number,
  b: number,
): [number, number] {
  const c = Math.cos(dome.angle),
    s = Math.sin(dome.angle);
  return gridXZ(
    dome.centerUV[0] + c * a - s * b,
    dome.centerUV[1] + s * a + c * b,
  );
}

export function robsonDomeCoordinates(
  dome: RobsonDome,
  x: number,
  z: number,
): [number, number] {
  const uv = gridUV(x, z),
    u = uv[0] - dome.centerUV[0],
    v = uv[1] - dome.centerUV[1];
  const c = Math.cos(dome.angle),
    s = Math.sin(dome.angle);
  return [c * u + s * v, -s * u + c * v];
}

export function robsonDomeRing(
  dome: RobsonDome,
  margin = 0,
): [number, number][] {
  return Array.from({ length: ROBSON_RINK_EXTERIOR.segments }, (_, i) => {
    const t = (i * Math.PI * 2) / ROBSON_RINK_EXTERIOR.segments;
    return robsonDomeXZ(
      dome,
      Math.cos(t) * (dome.radii[0] + margin),
      Math.sin(t) * (dome.radii[1] + margin),
    );
  });
}

/** Actual polygon used by the render exclusion, retaining wall, and floor.
 * There is deliberately no connecting under-street excavation or access. */
export const ROBSON_RINK_OPENINGS = ROBSON_RINK_EXTERIOR.domes.map((dome) => ({
  id: dome.id,
  polygon: robsonDomeRing(dome, ROBSON_RINK_EXTERIOR.openingMargin),
}));

export function robsonRinkOpeningAt(x: number, z: number) {
  for (const opening of ROBSON_RINK_OPENINGS) {
    let inside = false;
    const ring = opening.polygon;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a[1] > z !== b[1] > z &&
        x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    if (inside) return opening;
  }
}

/** Collision integration must be explicit: never lower an upper actor or road
 * simply because it shares XZ with a well. Guarded exterior has no new access. */
export function robsonRinkLowerSupport(
  x: number,
  z: number,
  referenceY: number,
) {
  if (referenceY > ROBSON_RINK_EXTERIOR.streetY - 0.3) return undefined;
  return robsonRinkOpeningAt(x, z) ? ROBSON_RINK_EXTERIOR.rinkY : undefined;
}

export const ROBSON_RINK_GUARDS = ROBSON_RINK_EXTERIOR.domes.flatMap((dome) => {
  const ring = robsonDomeRing(
    dome,
    ROBSON_RINK_EXTERIOR.openingMargin + ROBSON_RINK_EXTERIOR.wallThickness / 2,
  );
  return ring.map((a, i) => ({
    a,
    b: ring[(i + 1) % ring.length],
    minY: ROBSON_RINK_EXTERIOR.rimY,
    maxY: ROBSON_RINK_EXTERIOR.rimY + ROBSON_RINK_EXTERIOR.guardHeight,
  }));
});
