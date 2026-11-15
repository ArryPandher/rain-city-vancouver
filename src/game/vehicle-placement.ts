/** Collision subset keeps placement usable without a renderer or actor meshes. */
export type PlacementCollision = {
  safe(x: number, z: number, radius: number): [number, number];
  height(x: number, z: number, referenceY?: number): number;
  blocked?(x: number, z: number, radius: number, referenceY?: number): boolean;
  water?(x: number, z: number, referenceY?: number): boolean;
};
export type VehiclePosition = { x: number; z: number };
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
