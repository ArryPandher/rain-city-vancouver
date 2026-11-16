import {
  sweepVehiclePedestrians,
  vehicleContactCapsules,
  type PedestrianBody,
} from "./vehicle-pedestrian-contact";
/** Small kinematic vehicle contact solver. No renderer or world ownership. */
export type VehicleKind = "car" | "bike";
/** y is collision-ground height, not the visual model's road clearance. */
export type VehiclePose = { x: number; z: number; y: number; heading: number };
export type VehicleBody = VehiclePose & { kind: VehicleKind };
export type VehicleVelocity = { vx: number; vz: number };
export type VehicleContactClearance = (
  from: VehiclePose,
  to: VehiclePose,
) => boolean;
type ContactWorld = {
  height(x: number, z: number, referenceY: number): number;
  water(x: number, z: number, referenceY: number): boolean;
  blocked(x: number, z: number, radius: number, referenceY: number): boolean;
  move(
    x: number,
    z: number,
    dx: number,
    dz: number,
    radius: number,
    referenceY: number,
  ): { x: number; z: number; hit: boolean };
};

/** Reuse the existing street capsules and swept pedestrian rules for every
 * newly proposed recovery/slide. Check angular chords as well as endpoints. */
export function contactMotionClearance(
  world: ContactWorld,
  pedestrians: readonly PedestrianBody[],
  kind: VehicleKind,
): VehicleContactClearance {
  const shape = VEHICLE_FOOTPRINTS[kind];
  const probes: { along: number; side: number; radius: number }[] =
    vehicleContactCapsules(kind).map(([along, radius]) => ({
      along,
      side: 0,
      radius,
    }));
  // The historical driving capsules are narrower/shorter than the detailed
  // mesh. Its four corners must also clear walls during any corrective motion.
  for (const side of [-shape.halfWidth, shape.halfWidth])
    for (const along of [-shape.halfLength, shape.halfLength])
      probes.push({ along, side, radius: 0.02 });
  return (from, to) => {
    if (sweepVehiclePedestrians(from, to, pedestrians, kind).hit) return false;
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.z - from.z)),
      Math.ceil(Math.abs(angle(from.heading, to.heading)) / 0.03),
    );
    let a = from;
    for (let i = 1; i <= count; i++) {
      const b = at(from, to, i / count),
        y = world.height(b.x, b.z, a.y);
      if (
        !Number.isFinite(y) ||
        Math.abs(y - a.y) > 0.6 ||
        world.water(b.x, b.z, y)
      )
        return false;
      for (const { along, side, radius: r } of probes) {
        const ax =
            a.x + Math.sin(a.heading) * along + Math.cos(a.heading) * side,
          az = a.z + Math.cos(a.heading) * along - Math.sin(a.heading) * side,
          bx = b.x + Math.sin(b.heading) * along + Math.cos(b.heading) * side,
          bz = b.z + Math.cos(b.heading) * along - Math.sin(b.heading) * side;
        const moved = world.move(ax, az, bx - ax, bz - az, r, a.y);
        if (
          moved.hit ||
          Math.hypot(moved.x - bx, moved.z - bz) > 1e-5 ||
          world.blocked(bx, bz, r, y)
        )
          return false;
      }
      a = { ...b, y };
    }
    return true;
  };
}

// detailed-car.ts normalizes both committed GLBs to 4.9 m long. Their complete
// source bounds (including mirrors/tyres) are 2.8593 m wide and 1.292 m tall.
// The fallback car fits inside this envelope. makeBike has wheel centres ±.72,
// tyre radius .377, and a .64 m handlebar with .025 m tube radius.
export const VEHICLE_FOOTPRINTS = {
  car: { halfWidth: 1.43, halfLength: 2.45, height: 1.6 },
  bike: { halfWidth: 0.345, halfLength: 1.097, height: 1.3 },
} as const;
const SKIN = 0.003;
const EPS = 1e-9;
type Normal = { x: number; z: number };
type SweepHit = { fraction: number; normal: Normal; index: number };

function finite(p: VehiclePose) {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.heading)
  );
}
function angle(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
function at(a: VehiclePose, b: VehiclePose, t: number): VehiclePose {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    y: a.y + (b.y - a.y) * t,
    heading: a.heading + angle(a.heading, b.heading) * t,
  };
}
function axes(a: VehiclePose, b: VehiclePose): Normal[] {
  return [
    { x: Math.cos(a.heading), z: -Math.sin(a.heading) },
    { x: Math.sin(a.heading), z: Math.cos(a.heading) },
    { x: Math.cos(b.heading), z: -Math.sin(b.heading) },
    { x: Math.sin(b.heading), z: Math.cos(b.heading) },
  ];
}
function radius(p: VehiclePose, kind: VehicleKind, n: Normal) {
  const s = VEHICLE_FOOTPRINTS[kind],
    sin = Math.sin(p.heading),
    cos = Math.cos(p.heading);
  return (
    s.halfWidth * Math.abs(cos * n.x - sin * n.z) +
    s.halfLength * Math.abs(sin * n.x + cos * n.z)
  );
}
function sameLevel(a: VehiclePose, kind: VehicleKind, b: VehicleBody) {
  return (
    a.y < b.y + VEHICLE_FOOTPRINTS[b.kind].height - EPS &&
    a.y + VEHICLE_FOOTPRINTS[kind].height > b.y + EPS
  );
}

/** Exact oriented-rectangle overlap depth; zero includes touching/separate levels. */
export function vehicleOverlapDepth(
  a: VehiclePose,
  kind: VehicleKind,
  b: VehicleBody,
) {
  if (!sameLevel(a, kind, b)) return 0;
  let depth = Infinity;
  for (const n of axes(a, b)) {
    const d =
      radius(a, kind, n) +
      radius(b, b.kind, n) -
      Math.abs((a.x - b.x) * n.x + (a.z - b.z) * n.z);
    if (d <= EPS) return 0;
    depth = Math.min(depth, d);
  }
  return depth;
}

/** Continuous SAT slab intersection for translation, including vertical travel.
 * Touching bodies may move apart or along the contact plane without sticking. */
function translationSweep(
  a: VehiclePose,
  b: VehiclePose,
  kind: VehicleKind,
  other: VehicleBody,
  inflation = 0,
): Omit<SweepHit, "index"> | undefined {
  let entry = 0,
    exit = 1,
    normal: Normal = { x: 0, z: 0 },
    minimum = Infinity;
  for (const n of axes(a, other)) {
    const r = radius(a, kind, n) + radius(other, other.kind, n) + inflation;
    const q = (a.x - other.x) * n.x + (a.z - other.z) * n.z;
    const v = (b.x - a.x) * n.x + (b.z - a.z) * n.z;
    if (Math.abs(v) < EPS) {
      if (Math.abs(q) >= r - EPS) return;
    } else {
      const t0 = (-r - q) / v,
        t1 = (r - q) / v;
      const near = Math.min(t0, t1),
        far = Math.max(t0, t1);
      if (near >= entry) {
        entry = near;
        const sign = Math.sign(q + v * near) || 1;
        normal = { x: n.x * sign, z: n.z * sign };
      }
      exit = Math.min(exit, far);
      if (entry >= exit - EPS) return;
    }
    const depth = r - Math.abs(q);
    if (entry === 0 && depth < minimum) {
      minimum = depth;
      const sign = Math.sign(q) || 1;
      normal = { x: n.x * sign, z: n.z * sign };
    }
  }
  const low = other.y - VEHICLE_FOOTPRINTS[kind].height,
    high = other.y + VEHICLE_FOOTPRINTS[other.kind].height,
    vy = b.y - a.y;
  if (Math.abs(vy) < EPS) {
    if (a.y <= low + EPS || a.y >= high - EPS) return;
  } else {
    const t0 = (low - a.y) / vy,
      t1 = (high - a.y) / vy;
    entry = Math.max(entry, Math.min(t0, t1));
    exit = Math.min(exit, Math.max(t0, t1));
  }
  if (exit <= EPS || entry >= 1 || entry >= exit - EPS) return;
  return { fraction: Math.max(0, entry), normal };
}

function pairSweep(
  from: VehiclePose,
  to: VehiclePose,
  kind: VehicleKind,
  other: VehicleBody,
): Omit<SweepHit, "index"> | undefined {
  const turn = Math.abs(angle(from.heading, to.heading));
  if (turn < 1e-10) return translationSweep(from, to, kind, other);
  const f = VEHICLE_FOOTPRINTS[kind],
    reach = Math.hypot(f.halfWidth, f.halfLength);
  // Mid-angle rectangle plus the maximum corner arc bounds the entire rotating
  // sweep. Recursively refine only intersecting intervals. Translation is always
  // continuous, not an endpoint/sample test, even during long frames.
  const visit = (
    lo: number,
    hi: number,
    depth: number,
  ): Omit<SweepHit, "index"> | undefined => {
    const a = at(from, to, lo),
      b = at(from, to, hi),
      d = turn * (hi - lo),
      midHeading = (a.heading + b.heading) / 2;
    const envelope = translationSweep(
      { ...a, heading: midHeading },
      { ...b, heading: midHeading },
      kind,
      other,
      2 * reach * Math.sin(d / 4),
    );
    if (!envelope) return;
    const travel = Math.hypot(b.x - a.x, b.z - a.z) + reach * d;
    if (depth >= 22 || travel < 0.0001) {
      // At <0.1 mm corner travel, discard an envelope-only initial touch when
      // turning away. This prevents conservative angular padding from pinning a
      // car that is separating. Collision tolerance is much smaller than skin.
      const exact = translationSweep(
        a,
        { ...b, heading: a.heading },
        kind,
        other,
      );
      if (
        !exact &&
        !vehicleOverlapDepth(a, kind, other) &&
        !vehicleOverlapDepth(at(a, b, 0.5), kind, other) &&
        !vehicleOverlapDepth(b, kind, other)
      )
        return;
      return { fraction: lo, normal: exact?.normal ?? envelope.normal };
    }
    const mid = (lo + hi) / 2;
    return visit(lo, mid, depth + 1) ?? visit(mid, hi, depth + 1);
  };
  return visit(0, 1, 0);
}

function sweep(
  from: VehiclePose,
  to: VehiclePose,
  kind: VehicleKind,
  others: readonly VehicleBody[],
): SweepHit | undefined {
  let first: SweepHit | undefined;
  const f = VEHICLE_FOOTPRINTS[kind],
    reach = Math.hypot(f.halfWidth, f.halfLength);
  for (let i = 0; i < others.length; i++) {
    const other = others[i],
      o = VEHICLE_FOOTPRINTS[other.kind],
      r = reach + Math.hypot(o.halfWidth, o.halfLength);
    // Swept AABB broad phase needs no world query or distant-actor allocations.
    if (
      other.x < Math.min(from.x, to.x) - r ||
      other.x > Math.max(from.x, to.x) + r ||
      other.z < Math.min(from.z, to.z) - r ||
      other.z > Math.max(from.z, to.z) + r
    )
      continue;
    const hit = pairSweep(from, to, kind, other);
    if (hit && (!first || hit.fraction < first.fraction))
      first = { ...hit, index: i };
  }
  return first;
}

/** Separates a seeded overlap using the shortest available SAT face escape.
 * Every correction must clear the caller's swept street/pedestrian checks and
 * may neither introduce nor deepen contact with any other vehicle. */
function recover(
  start: VehiclePose,
  kind: VehicleKind,
  others: readonly VehicleBody[],
  clear: VehicleContactClearance,
) {
  let pose = { ...start },
    moved = false;
  for (let iteration = 0; iteration < 8; iteration++) {
    const depths = others.map((b) => vehicleOverlapDepth(pose, kind, b));
    if (!depths.some((d) => d > EPS)) return { pose, moved, blocked: false };
    const candidates: { pose: VehiclePose; distance: number }[] = [];
    for (let i = 0; i < others.length; i++) {
      if (depths[i] <= EPS) continue;
      const other = others[i];
      for (const n of axes(pose, other)) {
        const r = radius(pose, kind, n) + radius(other, other.kind, n),
          q = (pose.x - other.x) * n.x + (pose.z - other.z) * n.z;
        for (const sign of [-1, 1]) {
          const distance = r + SKIN - sign * q;
          candidates.push({
            distance,
            pose: {
              ...pose,
              x: pose.x + n.x * sign * distance,
              z: pose.z + n.z * sign * distance,
            },
          });
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const next = candidates.find((c) => {
      let improved = false;
      for (let i = 0; i < others.length; i++) {
        const d = vehicleOverlapDepth(c.pose, kind, others[i]);
        if (d > depths[i] + EPS) return false;
        if (d < depths[i] - EPS) improved = true;
        // Do not escape through a previously separate vehicle on the way.
        if (depths[i] === 0 && pairSweep(pose, c.pose, kind, others[i]))
          return false;
      }
      return improved && clear(pose, c.pose);
    });
    if (!next) return { pose, moved, blocked: true };
    pose = next.pose;
    moved = true;
  }
  return {
    pose,
    moved,
    blocked: others.some((b) => vehicleOverlapDepth(pose, kind, b) > EPS),
  };
}

/** Resolve a player vehicle against the small live vehicle pool. The caller has
 * already resolved ordinary static/pedestrian motion; clear() revalidates every
 * recovery or slide because those paths differ from that original motion. */
export function resolveVehicleContacts(
  from: VehiclePose,
  to: VehiclePose,
  kind: VehicleKind,
  others: readonly VehicleBody[],
  velocity: VehicleVelocity,
  clear: VehicleContactClearance,
) {
  let pose = { ...from },
    vx = velocity.vx,
    vz = velocity.vz;
  const finish = (
    hit: boolean,
    recovered = false,
    blockedRecovery = false,
    contactIndex = -1,
    impactSpeed = 0,
  ) => ({
    ...pose,
    vx,
    vz,
    hit,
    recovered,
    blockedRecovery,
    contactIndex,
    impactSpeed,
  });
  if (
    !finite(from) ||
    !finite(to) ||
    !Number.isFinite(vx) ||
    !Number.isFinite(vz) ||
    Math.hypot(to.x - from.x, to.z - from.z) > 100 ||
    Math.abs(to.y - from.y) > 10 ||
    others.some((b) => !finite(b) || !(b.kind in VEHICLE_FOOTPRINTS))
  ) {
    vx = vz = 0;
    return finish(true, false, true);
  }
  const recovery = recover(from, kind, others, clear);
  pose = recovery.pose;
  if (recovery.blocked) {
    // A trapped body must not be teleported through a wall or person to clear it.
    // Explicit separating motion may reduce penetration until an exit is free.
    const reduces =
      others.every(
        (b) =>
          vehicleOverlapDepth(to, kind, b) <=
          vehicleOverlapDepth(pose, kind, b) + EPS,
      ) &&
      others.some(
        (b) =>
          vehicleOverlapDepth(to, kind, b) <
          vehicleOverlapDepth(pose, kind, b) - EPS,
      );
    if (
      reduces &&
      clear(pose, to) &&
      !others.some(
        (b) =>
          vehicleOverlapDepth(pose, kind, b) === 0 &&
          pairSweep(pose, to, kind, b),
      )
    )
      pose = { ...to };
    else vx = vz = 0;
    return finish(true, recovery.moved, true);
  }
  let target = recovery.moved
    ? {
        ...to,
        x: to.x + pose.x - from.x,
        z: to.z + pose.z - from.z,
        y: pose.y + to.y - from.y,
      }
    : { ...to };
  let hitAny = recovery.moved,
    contactIndex = -1,
    impactSpeed = 0;
  let needsClearance = recovery.moved;
  for (let iteration = 0; iteration < 4; iteration++) {
    const hit = sweep(pose, target, kind, others);
    if (!hit) {
      if (!needsClearance || clear(pose, target)) pose = target;
      else {
        vx = vz = 0;
        hitAny = true;
      }
      break;
    }
    hitAny = true;
    contactIndex = hit.index;
    const dx = target.x - pose.x,
      dz = target.z - pose.z,
      angularTravel =
        Math.abs(angle(pose.heading, target.heading)) *
        Math.hypot(
          VEHICLE_FOOTPRINTS[kind].halfWidth,
          VEHICLE_FOOTPRINTS[kind].halfLength,
        ),
      fraction = Math.max(
        0,
        hit.fraction -
          SKIN / Math.max(SKIN, Math.hypot(dx, dz) + angularTravel),
      ),
      stopped = at(pose, target, fraction);
    // Even a shortened rotation can expose a corner which the earlier static
    // endpoint check did not visit. Validate it before committing that pose.
    if (!clear(pose, stopped)) {
      vx = vz = 0;
      break;
    }
    pose = stopped;
    const inward = vx * hit.normal.x + vz * hit.normal.z;
    if (inward < 0) {
      impactSpeed = Math.max(impactSpeed, -inward);
      vx -= inward * hit.normal.x;
      vz -= inward * hit.normal.z;
    }
    const remainingX = target.x - pose.x,
      remainingZ = target.z - pose.z,
      closing = Math.min(
        0,
        remainingX * hit.normal.x + remainingZ * hit.normal.z,
      ),
      slideX = remainingX - closing * hit.normal.x,
      slideZ = remainingZ - closing * hit.normal.z;
    // Rotation stops at contact. Translation may continue along the surface.
    target = { ...pose, x: pose.x + slideX, z: pose.z + slideZ };
    needsClearance = true;
    if (Math.hypot(slideX, slideZ) < SKIN) break;
  }
  return finish(hitAny, recovery.moved, false, contactIndex, impactSpeed);
}
