import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { shortenChaseBoom } from "../src/game/chase-camera";

test("wall contact shortens the chase boom while retaining its direction and focus", () => {
  const focus = new Vector3(10, 1.52, 20);
  const original = new Vector3(14, 3.52, 24);
  const desired = original.clone();
  const fraction = shortenChaseBoom(focus, desired, (p) => p.x >= 12);
  assert.deepEqual(focus.toArray(), [10, 1.52, 20]);
  assert.ok(fraction > 0.45 && fraction < 0.5);
  assert.ok(
    desired.distanceTo(focus) > 2.7,
    "character retains a visible boom",
  );
  assert.ok(desired.x < 12, "camera remains in front of the wall");
  assert.ok(
    desired.clone().sub(focus).cross(original.sub(focus)).length() < 1e-8,
  );
});

test("clear walking, aiming and car booms preserve their exact endpoints", () => {
  const focus = new Vector3(-80, 3.07, -795);
  for (const distance of [1.2, 4.3, 8.7]) {
    const desired = focus.clone().add(new Vector3(distance, 1.1, -0.55));
    const original = desired.clone();
    assert.equal(
      shortenChaseBoom(focus, desired, () => false),
      1,
    );
    assert.ok(desired.equals(original));
  }
});

test("near walls and a thin wall on the car boom cannot be skipped or crossed by a minimum distance", () => {
  for (const wall of [0.15, 3.5, 8.69]) {
    const focus = new Vector3(0, 2, 0),
      desired = new Vector3(8.7, 2, 0);
    shortenChaseBoom(focus, desired, (p) => Math.abs(p.x - wall) < 0.25);
    assert.ok(desired.x <= Math.max(0, wall - 0.25));
    assert.ok(desired.x >= 0);
  }
});

test("recorded Harbour Green chase pose clears its real bench at camera height but still stops for a taller barrier", async () => {
  const T = await import("three");
  const { buildHarbourGreen } = await import("../src/world/harbour-green");
  const { HARBOUR_BOUNDARY } = await import("../src/world/harbour-green-site");
  const { CollisionWorld } = await import("../src/world/collision");
  const city = {
    buildings: [],
    roads: [],
    trees: [],
    ocean: [],
    areas: [
      { kind: "park", name: "Harbour Green Park", pts: HARBOUR_BOUNDARY },
    ],
  } as unknown as import("../src/world/data").CityData;
  const root = new T.Group(),
    collision = new CollisionWorld(city);
  // Actual mapped park geometry registers its bench, pier and railing obstacles.
  // Only texture I/O is replaced; the barrier positions/heights are not mocked.
  buildHarbourGreen(
    root,
    city,
    {
      texture: () => new T.Texture(),
      asphalt: new T.MeshStandardMaterial(),
      neonMaterials: [],
      animatedUniforms: [],
    } as unknown as import("../src/world/materials").Materials,
    collision,
    [],
  );
  const focus = new Vector3(-80.240934, 3.07, -795.327017);
  const yaw = -0.5645,
    pitch = 0.19,
    distance = 4.3;
  const original = focus
    .clone()
    .add(
      new Vector3(
        -Math.sin(yaw) * distance,
        Math.sin(pitch) * distance + 0.3,
        -Math.cos(yaw) * distance,
      ),
    );
  const sample = focus.clone().lerp(original, 0.15);
  assert.equal(
    collision.blocked(sample.x, sample.z, 0.25),
    true,
    "the old infinite-height query catches the mapped bench",
  );
  assert.equal(
    collision.blocked(sample.x, sample.z, 0.25, sample.y),
    false,
    "the camera sample is above the bench's authored top",
  );
  assert.equal(
    collision.blocked(sample.x, sample.z, 0.25, 2.6),
    true,
    "the same bench still blocks movement below its top",
  );
  const oldBoom = original.clone();
  assert.ok(
    shortenChaseBoom(focus, oldBoom, (p) => collision.blocked(p.x, p.z, 0.25)) <
      1,
  );
  const corrected = original.clone();
  assert.equal(
    shortenChaseBoom(focus, corrected, (p) =>
      collision.blocked(p.x, p.z, 0.25, p.y),
    ),
    1,
  );
  assert.ok(
    corrected.equals(original),
    "the complete recorded chase boom is clear",
  );

  const { segmentPoint } = await import("../src/world/data");
  const bench = collision.barriers
    .query(sample.x, sample.z, 0.25)
    .find(
      (b) =>
        Math.abs(b.top - 2.7) < 1e-8 &&
        Math.abs(b.radius - 0.3) < 1e-8 &&
        segmentPoint(sample.x, sample.z, b.ax, b.az, b.bx, b.bz).d <
          b.radius + 0.25,
    );
  assert.ok(bench, "source build supplies the bench, not a hardcoded proxy");
  const shift = original.clone().sub(focus).multiplyScalar(0.45);
  collision.addBarrier(
    bench.ax + shift.x,
    bench.az + shift.z,
    bench.bx + shift.x,
    bench.bz + shift.z,
    bench.radius,
    4.5,
  );
  const obstructed = original.clone();
  const fraction = shortenChaseBoom(focus, obstructed, (p) =>
    collision.blocked(p.x, p.z, 0.25, p.y),
  );
  assert.ok(
    fraction > 0 && fraction < 1,
    "a genuinely taller obstruction still shortens the boom",
  );
  assert.equal(
    collision.blocked(obstructed.x, obstructed.z, 0.25, obstructed.y),
    false,
    "shortened endpoint remains outside the taller obstruction",
  );
});
