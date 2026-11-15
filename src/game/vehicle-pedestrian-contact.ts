/** Physical driving/placement capsules, not the larger pedestrian yielding zone. */
export type ContactPose = { x: number; z: number; y: number; heading: number };
export type PedestrianBody = {
  x: number;
  z: number;
  y: number;
  radius: number;
  height: number;
};
export function vehicleContactCapsules(kind: "car" | "bike") {
  return kind === "car"
    ? ([
        [0, 1.16],
        [-1.35, 0.9],
        [1.35, 0.9],
      ] as const)
    : ([[0, 0.45]] as const);
}
function finitePose(p: ContactPose) {
  return [p.x, p.y, p.z, p.heading].every(Number.isFinite);
}
function validBody(p: PedestrianBody) {
  return (
    [p.x, p.y, p.z, p.radius, p.height].every(Number.isFinite) &&
    p.radius >= 0 &&
    p.height > 0
  );
}
function sameLevel(pose: ContactPose, p: PedestrianBody) {
  return pose.y < p.y + p.height && pose.y + 1.6 > p.y;
}
export function vehicleOverlapsPedestrians(
  pose: ContactPose,
  peds: readonly PedestrianBody[],
  kind: "car" | "bike" = "car",
) {
  if (!finitePose(pose)) return true;
  return peds.some(
    (p) =>
      validBody(p) &&
      sameLevel(pose, p) &&
      vehicleContactCapsules(kind).some(
        ([offset, radius]) =>
          Math.hypot(
            p.x - pose.x - Math.sin(pose.heading) * offset,
            p.z - pose.z - Math.cos(pose.heading) * offset,
          ) <
          radius + p.radius,
      ),
  );
}
/** Distance to the exposed boundary of the union of pedestrian-inflated
 * vehicle discs. Hidden disc arcs are not exit boundaries of the whole body. */
export function vehiclePedestrianDepth(
  pose: ContactPose,
  p: PedestrianBody,
  kind: "car" | "bike" = "car",
) {
  if (!validBody(p) || !sameLevel(pose, p)) return 0;
  const circles = vehicleContactCapsules(kind).map(([offset, radius]) => ({
    x: pose.x + Math.sin(pose.heading) * offset,
    z: pose.z + Math.cos(pose.heading) * offset,
    r: radius + p.radius,
  }));
  if (!circles.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r)) return 0;
  let depth = Infinity;
  const candidate = (x: number, z: number) => {
    if (circles.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r - 1e-9))
      return;
    depth = Math.min(depth, Math.hypot(x - p.x, z - p.z));
  };
  for (const c of circles) {
    const dx = p.x - c.x,
      dz = p.z - c.z,
      d = Math.hypot(dx, dz);
    candidate(c.x + c.r * (d ? dx / d : 1), c.z + c.r * (d ? dz / d : 0));
  }
  for (let i = 0; i < circles.length; i++)
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i],
        b = circles[j],
        dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (!d || d > a.r + b.r || d < Math.abs(a.r - b.r)) continue;
      const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d),
        h = Math.sqrt(Math.max(0, a.r * a.r - along * along));
      const x = a.x + (along * dx) / d,
        z = a.z + (along * dz) / d;
      candidate(x - (h * dz) / d, z + (h * dx) / d);
      candidate(x + (h * dz) / d, z - (h * dx) / d);
    }
  return depth;
}
/** Convex envelope depth is used ONLY to recover an existing overlap. The
 * three physical discs have a small concave waist which otherwise traps a
 * frame-by-frame escape. Exposed circle support arcs and common outer tangent
 * support lines define their exact convex hull, with no sampled directions. */
function recoveryDepth(
  pose: ContactPose,
  p: PedestrianBody,
  kind: "car" | "bike",
) {
  if (!sameLevel(pose, p)) return 0;
  const circles = vehicleContactCapsules(kind).map(([offset, radius]) => ({
    x: pose.x + Math.sin(pose.heading) * offset,
    z: pose.z + Math.cos(pose.heading) * offset,
    r: radius + p.radius,
  }));
  let depth = Infinity;
  const support = (x: number, z: number) =>
    Math.max(...circles.map((c) => c.x * x + c.z * z + c.r));
  const candidate = (x: number, z: number, level: number) => {
    if (support(x, z) > level + 1e-9) return;
    depth = Math.min(depth, level - p.x * x - p.z * z);
  };
  for (const c of circles) {
    const dx = p.x - c.x,
      dz = p.z - c.z,
      d = Math.hypot(dx, dz),
      x = d ? dx / d : 1,
      z = d ? dz / d : 0;
    candidate(x, z, c.x * x + c.z * z + c.r);
  }
  for (let i = 0; i < circles.length; i++)
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i],
        b = circles[j],
        dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (!d || d <= Math.abs(a.r - b.r)) continue;
      const q = (a.r - b.r) / d,
        h = Math.sqrt(1 - q * q);
      for (const sign of [-1, 1]) {
        const x = (dx / d) * q + ((sign * dz) / d) * h,
          z = (dz / d) * q - ((sign * dx) / d) * h;
        candidate(x, z, a.x * x + a.z * z + a.r);
      }
    }
  return Math.max(0, depth);
}
/** Earliest entry of a moving circle into another; an existing overlap can
 * separate, but cannot deepen. This also permits reversing out of a seeded overlap. */
function entry(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  px: number,
  pz: number,
  r: number,
) {
  const x = ax - px,
    z = az - pz,
    dx = bx - ax,
    dz = bz - az,
    a = dx * dx + dz * dz,
    b = x * dx + z * dz,
    c = x * x + z * z - r * r;
  if (a < 1e-18) return 1;
  if (c <= 0) return b >= -1e-12 ? 1 : 0;
  if (b >= 0) return 1;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return 1;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t < 1 ? t : 1;
}
/** Sweeps center/nose/tail in both directions, including steering. Short angular
 * chords conservatively expand by their arc sagitta; no large-step tunnelling.
 * Static support and world collision remain the caller's responsibility. */
export function sweepVehiclePedestrians(
  from: ContactPose,
  to: ContactPose,
  peds: readonly PedestrianBody[],
  kind: "car" | "bike" = "car",
) {
  if (!finitePose(from) || !finitePose(to))
    return { ...from, fraction: 0, hit: true };
  const angle = Math.atan2(
    Math.sin(to.heading - from.heading),
    Math.cos(to.heading - from.heading),
  );
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  // A simulation step cannot legitimately span hundreds of metres. Fail closed
  // rather than allocate/work without bound on corrupted or teleport input.
  if (distance > 100 || Math.abs(to.y - from.y) > 10)
    return { ...from, fraction: 0, hit: true };
  const count = Math.max(
    1,
    Math.ceil(distance / 0.1),
    Math.ceil(Math.abs(angle) / 0.03),
  );
  const at = (t: number) => ({
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    y: from.y + (to.y - from.y) * t,
    heading: from.heading + angle * t,
  });
  const bodies = peds.filter(validBody);
  const initialDepths = bodies.map((p) =>
    vehicleOverlapsPedestrians(from, [p], kind)
      ? recoveryDepth(from, p, kind)
      : 0,
  );
  for (let i = 0; i < count; i++) {
    const a = at(i / count),
      b = at((i + 1) / count);
    let fraction = 1;
    for (const [bodyIndex, p] of bodies.entries()) {
      if (
        Math.max(a.y, b.y) + 1.6 <= p.y ||
        Math.min(a.y, b.y) >= p.y + p.height
      )
        continue;
      const initialDepth = initialDepths[bodyIndex];
      if (initialDepth > 0) {
        if (recoveryDepth(b, p, kind) > initialDepth + 1e-8) {
          let low = 0,
            high = 1;
          for (let j = 0; j < 24; j++) {
            const mid = (low + high) / 2;
            if (
              recoveryDepth(at((i + mid) / count), p, kind) >
              initialDepth + 1e-8
            )
              high = mid;
            else low = mid;
          }
          fraction = Math.min(fraction, low);
        }
        continue;
      }
      for (const [offset, radius] of vehicleContactCapsules(kind)) {
        const ax = a.x + Math.sin(a.heading) * offset,
          az = a.z + Math.cos(a.heading) * offset;
        const bx = b.x + Math.sin(b.heading) * offset,
          bz = b.z + Math.cos(b.heading) * offset;
        const sagitta = Math.abs(offset) * (1 - Math.cos(angle / count / 2));
        fraction = Math.min(
          fraction,
          entry(ax, az, bx, bz, p.x, p.z, radius + p.radius + sagitta),
        );
      }
    }
    if (fraction < 1) {
      const t = Math.max(0, (i + fraction) / count - 1e-6);
      return { ...at(t), fraction: t, hit: true };
    }
  }
  return { ...to, fraction: 1, hit: false };
}
