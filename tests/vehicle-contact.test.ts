import test from "node:test";
import assert from "node:assert/strict";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import * as T from "three";
import {
  VEHICLE_FOOTPRINTS,
  contactMotionClearance,
  resolveVehicleContacts,
  vehicleOverlapDepth,
  type VehicleBody,
  type VehiclePose,
  type VehicleKind,
  type VehicleFootprint,
} from "../src/game/vehicle-contact";

const pose = (x = 0, z = 0, heading = 0, y = 8): VehiclePose => ({
  x,
  z,
  heading,
  y,
});
const body = (
  x = 0,
  z = 0,
  heading = 0,
  kind: VehicleKind = "car",
  y = 8,
): VehicleBody => ({ ...pose(x, z, heading, y), kind });
const clear = () => true;
const stopped = { vx: 0, vz: 0 };
const close = (actual: number, expected: number, tolerance = 0.005) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} should be near ${expected}`,
  );
function resolve(
  a: VehiclePose,
  b: VehiclePose,
  others: VehicleBody[],
  kind: VehicleKind = "car",
) {
  return resolveVehicleContacts(
    a,
    b,
    kind,
    others,
    { vx: b.x - a.x, vz: b.z - a.z },
    clear,
  );
}

test("footprints enclose the real normalized car assets, including protrusions", async () => {
  for (const name of ["car-concept", "car-traffic"]) {
    const document = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(`public/models/${name}.glb`);
    const box = new T.Box3(),
      point = new T.Vector3();
    for (const node of document.getRoot().listNodes()) {
      const matrix = new T.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute("POSITION")!;
        for (let i = 0; i < positions.getCount(); i++)
          box.expandByPoint(
            point.fromArray(positions.getElement(i, [])).applyMatrix4(matrix),
          );
      }
    }
    const size = box
      .getSize(new T.Vector3())
      .multiplyScalar(4.9 / (box.max.z - box.min.z));
    const footprint = VEHICLE_FOOTPRINTS.car;
    assert.ok(
      2 * footprint.halfWidth >= size.x &&
        2 * footprint.halfWidth - size.x < 0.01,
    );
    close(2 * footprint.halfLength, size.z, 1e-8);
    assert.ok(footprint.height >= size.y);
  }
  close(VEHICLE_FOOTPRINTS.bike.halfLength, 0.72 + 0.34 + 0.037, 1e-10);
  close(VEHICLE_FOOTPRINTS.bike.halfWidth, 0.32 + 0.025, 1e-10);
});

test("the recorded 1.362m arrival overlap separates even with zero speed", () => {
  const active = pose(
    487.7987927423008,
    -452.6178777038805,
    2.4440506464219784,
    8.191615242939228,
  );
  const parked = body(
    486.649999999808,
    -453.34999999977083,
    active.heading,
    "car",
    8.201762500004683,
  );
  close(
    Math.hypot(active.x - parked.x, active.z - parked.z),
    1.3622510126,
    1e-8,
  );
  assert.ok(vehicleOverlapDepth(active, "car", parked) > 1);
  let checked = 0;
  const result = resolveVehicleContacts(
    active,
    active,
    "car",
    [parked],
    stopped,
    () => {
      checked++;
      return true;
    },
  );
  assert.ok(result.hit && result.recovered && !result.blockedRecovery);
  assert.equal(vehicleOverlapDepth(result, "car", parked), 0);
  assert.ok(
    checked > 0,
    "recovery must consult street and pedestrian clearance",
  );
  assert.equal(result.vx, 0);
  assert.equal(result.vz, 0);
  assert.ok(
    Math.hypot(result.x - active.x, result.z - active.z) < 1.6,
    "shortest local escape",
  );
});

test("slow forward/reverse and high-speed movement stop at bumper contact", () => {
  for (const direction of [-1, 1]) {
    for (const [start, end] of [
      [4.95, 4.85],
      [20, -20],
    ]) {
      const parked = body();
      const a = pose(0, start * direction),
        b = pose(0, end * direction);
      const result = resolve(a, b, [parked]);
      assert.equal(result.hit, true);
      close(result.z, direction * 4.903);
      assert.equal(vehicleOverlapDepth(result, "car", parked), 0);
      close(result.vz, 0, 1e-8);
    }
  }
});

test("side and oblique contact preserve tangential velocity and slide distance", () => {
  const parked = body();
  const result = resolve(pose(-4, 0), pose(0, 3), [parked]);
  assert.equal(result.hit, true);
  close(result.x, -2.863);
  close(result.z, 3);
  close(result.vx, 0, 1e-9);
  close(result.vz, 3, 1e-9);
  assert.equal(vehicleOverlapDepth(result, "car", parked), 0);
  const angled = body(0, 0, Math.PI / 3);
  const hit = resolve(pose(-10, 0, -Math.PI / 4), pose(8, 0, -Math.PI / 4), [
    angled,
  ]);
  assert.ok(hit.hit);
  assert.equal(vehicleOverlapDepth(hit, "car", angled), 0);
});

test("touching vehicles can reverse away or travel parallel without sticky impulses", () => {
  const parked = body();
  const away = resolve(pose(-2.86, 0), pose(-4, 0), [parked]);
  assert.equal(away.hit, false);
  close(away.x, -4);
  close(away.vx, -1.14);
  const parallel = resolve(pose(-2.86, 0), pose(-2.86, 6), [parked]);
  assert.equal(parallel.hit, false);
  close(parallel.z, 6);
  close(parallel.vz, 6);
});

test("rotation is swept even when both endpoint footprints are clear", () => {
  for (const sign of [-1, 1]) {
    const parked = body(4.1 * sign, 0);
    const a = pose(),
      b = pose(0, 0, (sign * Math.PI) / 2);
    assert.equal(vehicleOverlapDepth(a, "car", parked), 0);
    assert.equal(vehicleOverlapDepth(b, "car", parked), 0);
    const result = resolve(a, b, [parked]);
    assert.ok(result.hit);
    assert.ok(
      Math.abs(result.heading) > 0.3 && Math.abs(result.heading) < Math.PI / 2,
    );
    assert.equal(vehicleOverlapDepth(result, "car", parked), 0);
  }
});

test("simultaneous translation/rotation and multiple nearby vehicles cannot tunnel", () => {
  const others = [body(0, 0, 0.4), body(-3, 7, -0.5), body(6, -1, 0.7)];
  const result = resolve(pose(-15, -3, -0.5), pose(15, 3, 1.2), others);
  assert.ok(result.hit);
  for (const other of others)
    assert.equal(vehicleOverlapDepth(result, "car", other), 0);
});

test("bike length, narrow handlebars and vertical separation use their own dimensions", () => {
  const parked = body();
  const bike = resolve(pose(0, -9), pose(0, 9), [parked], "bike");
  assert.ok(bike.hit);
  close(bike.z, -(2.45 + 1.097 + 0.003));
  const gap =
    VEHICLE_FOOTPRINTS.car.halfWidth + VEHICLE_FOOTPRINTS.bike.halfWidth + 0.02;
  assert.equal(
    resolve(pose(gap, -9), pose(gap, 9), [parked], "bike").hit,
    false,
  );
  assert.equal(
    resolve(pose(0, -9, 0, 12), pose(0, 9, 0, 12), [parked]).hit,
    false,
  );
  const descending = resolve(pose(0, -9, 0, 12), pose(0, 9, 0, 8), [parked]);
  assert.ok(
    descending.hit,
    "vertical separation must be evaluated over the sweep",
  );
  assert.equal(vehicleOverlapDepth(descending, "car", parked), 0);
});

test("recovery chooses an available side and never pushes through blocked world space", () => {
  const a = pose(),
    parked = body(1, 0);
  const alternative = resolveVehicleContacts(
    a,
    a,
    "car",
    [parked],
    stopped,
    (_from, to) => to.x >= 0 && Math.abs(to.z) < 0.1,
  );
  assert.ok(alternative.recovered);
  assert.ok(alternative.x > parked.x);
  assert.equal(vehicleOverlapDepth(alternative, "car", parked), 0);
  const trapped = resolveVehicleContacts(
    a,
    a,
    "car",
    [parked],
    stopped,
    () => false,
  );
  assert.ok(trapped.blockedRecovery);
  close(trapped.x, a.x);
  close(trapped.z, a.z);
  const escape = resolveVehicleContacts(
    a,
    pose(-0.05, 0),
    "car",
    [parked],
    { vx: -0.05, vz: 0 },
    (from, to) => Math.hypot(to.x - from.x, to.z - from.z) < 0.1,
  );
  assert.ok(
    vehicleOverlapDepth(escape, "car", parked) <
      vehicleOverlapDepth(a, "car", parked),
  );
  close(escape.vx, -0.05);
});

test("a slide cannot bypass the earlier static/pedestrian path", () => {
  const result = resolveVehicleContacts(
    pose(-4, 0),
    pose(0, 3),
    "car",
    [body()],
    { vx: 4, vz: 3 },
    () => false,
  );
  assert.ok(result.hit);
  assert.ok(
    result.z < 1,
    "retain first contact when its new slide path is obstructed",
  );
  assert.equal(vehicleOverlapDepth(result, "car", body()), 0);
  assert.equal(result.vx, 0);
  assert.equal(result.vz, 0);
});

test("clearance rechecks the swept street body, water/grade and real pedestrian capsules", () => {
  const street = {
    height: () => 8,
    water: () => false,
    blocked: () => false,
    move: (x: number, z: number, dx: number, dz: number) => ({
      x: x + dx,
      z: z + dz,
      hit: false,
    }),
  };
  assert.equal(
    contactMotionClearance(street, [], "car")(pose(), pose(3)),
    true,
  );
  assert.equal(
    contactMotionClearance(
      { ...street, move: (x, z) => ({ x, z, hit: true }) },
      [],
      "car",
    )(pose(), pose(3)),
    false,
  );
  assert.equal(
    contactMotionClearance(
      { ...street, water: () => true },
      [],
      "car",
    )(pose(), pose(3)),
    false,
  );
  assert.equal(
    contactMotionClearance(
      { ...street, height: () => 12 },
      [],
      "car",
    )(pose(), pose(3)),
    false,
  );
  assert.equal(
    contactMotionClearance(
      street,
      [{ x: 4, z: 0, y: 8, radius: 0.4, height: 1.8 }],
      "car",
    )(pose(), pose(7)),
    false,
  );
});

test("corrupt and unbounded motion fails closed without searching the world", () => {
  for (const invalid of [
    pose(101),
    pose(NaN),
    pose(0, 0, Infinity),
    pose(0, 0, 0, 99),
  ]) {
    const result = resolveVehicleContacts(
      pose(),
      invalid,
      "car",
      [],
      { vx: 12, vz: 4 },
      () => {
        throw new Error("invalid input must not query clearance");
      },
    );
    assert.ok(result.hit);
    close(result.x, 0);
    close(result.vx, 0);
    close(result.vz, 0);
  }
});

// A conservative fixture at the audited E30 scale, kept independent of its asset
// adapter. The legacy traffic body stays wider/longer throughout these checks.
const hero: VehicleFootprint = {
  halfWidth: 0.96,
  halfLength: 2.182,
  height: 1.4,
};
function resolveShape(
  from: VehiclePose,
  to: VehiclePose,
  others: VehicleBody[],
  footprint?: VehicleFootprint,
) {
  return resolveVehicleContacts(
    from,
    to,
    "car",
    others,
    { vx: to.x - from.x, vz: to.z - from.z },
    clear,
    footprint,
  );
}

test("mixed car footprints stop at their own bumper/side surfaces in both roles", () => {
  for (const sign of [-1, 1]) {
    const movingHero = resolveShape(
      pose(0, sign * 20),
      pose(0, -sign * 20),
      [body()],
      hero,
    );
    close(movingHero.z, sign * (hero.halfLength + 2.45 + 0.003), 1e-8);
    assert.equal(vehicleOverlapDepth(movingHero, "car", body(), hero), 0);
    const parkedHero = { ...body(), footprint: hero };
    const movingTraffic = resolveShape(
      pose(0, sign * 20),
      pose(0, -sign * 20),
      [parkedHero],
    );
    close(movingTraffic.z, movingHero.z, 1e-8);
    assert.equal(vehicleOverlapDepth(movingTraffic, "car", parkedHero), 0);
    const twoHeroes = resolveShape(
      pose(0, sign * 20),
      pose(0, -sign * 20),
      [parkedHero],
      hero,
    );
    close(twoHeroes.z, sign * (2 * hero.halfLength + 0.003), 1e-8);
  }
  const mixedGap = hero.halfWidth + VEHICLE_FOOTPRINTS.car.halfWidth + 0.04;
  assert.equal(
    resolveShape(pose(mixedGap, -12), pose(mixedGap, 12), [body()], hero).hit,
    false,
  );
  assert.equal(
    resolveShape(pose(mixedGap, -12), pose(mixedGap, 12), [
      { ...body(), footprint: hero },
    ]).hit,
    false,
  );
  assert.equal(
    resolveShape(pose(mixedGap, -12), pose(mixedGap, 12), [body()]).hit,
    true,
  );
  const slide = resolveShape(pose(-4), pose(0, 3), [body()], hero);
  close(slide.x, -(hero.halfWidth + 1.43 + 0.003));
  close(slide.z, 3);
  close(slide.vx, 0);
  close(slide.vz, 3);
});

test("custom moving and target footprints retain continuous angular collision", () => {
  for (const sign of [-1, 1]) {
    for (const [moving, target, distance] of [
      [hero, undefined, 3.73],
      [undefined, hero, 3.6],
    ] as const) {
      const parked = { ...body(sign * distance), footprint: target };
      const from = pose(),
        to = pose(0, 0, (sign * Math.PI) / 2);
      assert.equal(vehicleOverlapDepth(from, "car", parked, moving), 0);
      assert.equal(vehicleOverlapDepth(to, "car", parked, moving), 0);
      const hit = resolveShape(from, to, [parked], moving);
      assert.ok(
        hit.hit &&
          Math.abs(hit.heading) > 0.3 &&
          Math.abs(hit.heading) < Math.PI / 2,
      );
      assert.equal(vehicleOverlapDepth(hit, "car", parked, moving), 0);
    }
  }
});

test("each custom height participates in vertical separation and a descending sweep", () => {
  const raisedTraffic = body(0, 0, 0, "car", 9.5);
  assert.equal(
    resolveShape(pose(0, -9), pose(0, 9), [raisedTraffic], hero).hit,
    false,
  );
  assert.equal(
    resolveShape(pose(0, -9), pose(0, 9), [raisedTraffic]).hit,
    true,
  );
  const parkedHero = { ...body(), footprint: hero };
  assert.equal(
    resolveShape(pose(0, -9, 0, 9.5), pose(0, 9, 0, 9.5), [parkedHero]).hit,
    false,
  );
  const descending = resolveShape(
    pose(0, -9, 0, 12),
    pose(0, 9, 0, 8),
    [parkedHero],
    hero,
  );
  assert.ok(descending.hit);
  assert.equal(vehicleOverlapDepth(descending, "car", parkedHero, hero), 0);
});

test("custom footprint overlap recovery uses its dimensions and preserves all other bodies", () => {
  const start = pose(),
    parked = body(1);
  const result = resolveVehicleContacts(
    start,
    start,
    "car",
    [parked],
    stopped,
    clear,
    hero,
  );
  assert.ok(result.recovered && !result.blockedRecovery);
  close(result.x, -(hero.halfWidth + 1.43 - 1 + 0.003), 1e-8);
  assert.equal(vehicleOverlapDepth(result, "car", parked, hero), 0);
  const blocker = { ...body(-3), footprint: hero };
  const diverted = resolveVehicleContacts(
    start,
    start,
    "car",
    [parked, blocker],
    stopped,
    (_from, to) => Math.abs(to.z) < 0.1,
    hero,
  );
  assert.ok(diverted.recovered && diverted.x > 0);
  for (const other of [parked, blocker])
    assert.equal(vehicleOverlapDepth(diverted, "car", other, hero), 0);
  const trapped = resolveVehicleContacts(
    start,
    start,
    "car",
    [parked],
    stopped,
    () => false,
    hero,
  );
  assert.ok(trapped.blockedRecovery && !trapped.recovered);
  close(trapped.x, 0);
  const escape = resolveVehicleContacts(
    start,
    pose(-0.05),
    "car",
    [parked],
    { vx: -0.05, vz: 0 },
    (a, b) => Math.hypot(b.x - a.x, b.z - a.z) < 0.1,
    hero,
  );
  assert.ok(
    vehicleOverlapDepth(escape, "car", parked, hero) <
      vehicleOverlapDepth(start, "car", parked, hero),
  );
  close(escape.vx, -0.05);
});

test("custom clearance fits street probes while retaining conservative pedestrian contact", () => {
  const street = {
    height: () => 8,
    water: () => false,
    blocked: (x: number, _z: number, radius: number) =>
      Math.abs(x) + radius > 1.3,
    move: (x: number, z: number, dx: number, dz: number) => ({
      x: x + dx,
      z: z + dz,
      hit: false,
    }),
  };
  assert.equal(
    contactMotionClearance(street, [], "car", hero)(pose(), pose(0, 3)),
    true,
  );
  assert.equal(
    contactMotionClearance(street, [], "car")(pose(), pose(0, 3)),
    false,
  );
  // Fitted recovery must not restore the old 1.16m invisible side margin.
  assert.equal(
    contactMotionClearance(
      { ...street, blocked: (x, _z, r) => Math.abs(x) + r > 1.1 },
      [],
      "car",
      hero,
    )(pose(), pose(0, 3)),
    true,
  );
  assert.equal(
    contactMotionClearance(
      street,
      [{ x: 0, z: 4, y: 8, radius: 0.4, height: 1.8 }],
      "car",
      hero,
    )(pose(), pose(0, 5)),
    false,
  );
});

test("invalid model footprints fail closed without clearance calls or legacy mutation", () => {
  const legacy = JSON.stringify(VEHICLE_FOOTPRINTS);
  for (const bad of [
    { ...hero, halfWidth: 0 },
    { ...hero, halfLength: -1 },
    { ...hero, height: NaN },
    { ...hero, halfWidth: Infinity },
    { ...hero, halfWidth: 1.7e308, halfLength: 1.7e308 },
  ]) {
    const never = () => {
      throw new Error("invalid shape must not query world");
    };
    for (const target of [false, true]) {
      const result = resolveVehicleContacts(
        pose(),
        pose(0, 1),
        "car",
        target ? [{ ...body(8), footprint: bad }] : [],
        { vx: 0, vz: 1 },
        never,
        target ? hero : bad,
      );
      assert.ok(result.hit && result.blockedRecovery);
      close(result.x, 0);
      close(result.z, 0);
      close(result.vz, 0);
    }
    assert.equal(vehicleOverlapDepth(pose(), "car", body(), bad), Infinity);
  }
  assert.equal(JSON.stringify(VEHICLE_FOOTPRINTS), legacy);
});
