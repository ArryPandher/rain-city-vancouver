/** Collision subset keeps placement usable without a renderer or actor meshes. */
export type PlacementCollision = {
  safe(x: number, z: number, radius: number): [number, number];
  height(x: number, z: number, referenceY?: number): number;
  blocked?(x: number, z: number, radius: number, referenceY?: number): boolean;
  water?(x: number, z: number, referenceY?: number): boolean;
};
export type VehiclePosition = { x: number; z: number };
/** Use the same centre and nose/tail capsules as driving, on the current level. */
export function summonedVehicleSpot(
  collision: Required<PlacementCollision>,
  origin: VehiclePosition & { heading: number; y: number },
  kind: "car" | "bike",
  occupied: readonly VehiclePosition[],
): [number, number] | undefined {
  if (![origin.x, origin.z, origin.heading, origin.y].every(Number.isFinite))
    return;
  const samples =
    kind === "car"
      ? [
          [0, 1.16],
          [-1.35, 0.9],
          [1.35, 0.9],
        ]
      : [[0, 0.45]];
  for (const distance of [0, 4, -4, 8, -8, 12, -12, 20, -20, 30]) {
    for (const lateral of [0, 0.75, -0.75, 1.5, -1.5, 3, -3]) {
      const x =
        origin.x +
        Math.sin(origin.heading) * distance +
        Math.cos(origin.heading) * lateral;
      const z =
        origin.z +
        Math.cos(origin.heading) * distance -
        Math.sin(origin.heading) * lateral;
      if (occupied.some((p) => Math.hypot(p.x - x, p.z - z) <= 6)) continue;
      // Leave a short supported departure corridor, not merely a parked pose
      // whose nose touches an obstacle as soon as the player presses throttle.
      const departure =
        kind === "car" ? [0, 0.5, 1, 1.5, 2, 2.5, 3] : [0, 0.5, 1];
      const clear = departure.every((forward) =>
        samples.every(([offset, radius]) => {
          const along = offset + forward;
          const xx = x + Math.sin(origin.heading) * along;
          const zz = z + Math.cos(origin.heading) * along;
          const y = collision.height(xx, zz, origin.y);
          return (
            Number.isFinite(y) &&
            Math.abs(y - origin.y) <= 0.6 &&
            !collision.blocked(xx, zz, radius, origin.y) &&
            !collision.water(xx, zz, origin.y)
          );
        }),
      );
      if (clear) return [x, z];
    }
  }
}
export function startupBikeSpot(
  collision: PlacementCollision,
  spawn: VehiclePosition & { heading: number },
  occupied: readonly VehiclePosition[],
): [number, number] | undefined {
  const referenceY = collision.height(spawn.x, spawn.z);
  if (![spawn.x, spawn.z, spawn.heading, referenceY].every(Number.isFinite))
    return;
  const candidates = [
    [-8, 4],
    [-10, -4],
    [-12, 0],
    [-16, 4],
    [-16, -4],
  ];
  for (const [along, side] of candidates) {
    const [x, z] = collision.safe(
      spawn.x +
        Math.sin(spawn.heading) * along +
        Math.cos(spawn.heading) * side,
      spawn.z +
        Math.cos(spawn.heading) * along -
        Math.sin(spawn.heading) * side,
      1,
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    // Safe may project onto a road beside the car. Check the resolved result,
    // including the player's car even if the caller omitted it from occupied.
    if (
      [spawn, ...occupied].some(
        (p) =>
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.z) ||
          Math.hypot(x - p.x, z - p.z) < 5,
      )
    )
      continue;
    const y = collision.height(x, z, referenceY);
    if (!Number.isFinite(y) || Math.abs(y - referenceY) > 1.5) continue;
    if (collision.blocked?.(x, z, 1, y) || collision.water?.(x, z, y)) continue;
    return [x, z];
  }
}
/** Resolve only an approaching overlap on the same vertical level. A reversing
 * vehicle separating from an overlap must not be bounced back into it. */
export function approachingVehicleContact(
  moving: VehiclePosition & { y: number; vx: number; vz: number },
  other: VehiclePosition & { y: number },
): boolean {
  if (
    ![
      moving.x,
      moving.z,
      moving.y,
      moving.vx,
      moving.vz,
      other.x,
      other.z,
      other.y,
    ].every(Number.isFinite)
  )
    return false;
  const dx = other.x - moving.x,
    dz = other.z - moving.z;
  return (
    Math.hypot(dx, dz) < 2.1 &&
    Math.abs(other.y - moving.y) < 1.8 &&
    moving.vx * dx + moving.vz * dz > 0
  );
}
