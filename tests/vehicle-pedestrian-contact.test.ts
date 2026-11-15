import test from "node:test";
import assert from "node:assert/strict";
import {
  vehicleOverlapsPedestrians,
  vehiclePedestrianDepth,
  sweepVehiclePedestrians,
  type PedestrianBody,
} from "../src/game/vehicle-pedestrian-contact";
import { summonedVehicleSpot } from "../src/game/vehicle-placement";
const person = (x: number, z: number, y = 7.88): PedestrianBody => ({
  x,
  z,
  y,
  radius: 0.4,
  height: 1.8,
});
const pose = { x: 0, z: 0, y: 7.88, heading: 0 };
test("physical center/nose/tail prevent forward and reverse tunnelling at the exact contact distance", () => {
  for (const direction of [-1, 1]) {
    const ped = person(0, 5 * direction);
    const hit = sweepVehiclePedestrians(pose, { ...pose, z: 20 * direction }, [
      ped,
    ]);
    assert.equal(hit.hit, true);
    assert.ok(Math.abs(hit.z - 2.35 * direction) < 0.0001);
    assert.equal(vehicleOverlapsPedestrians(hit, [ped]), false);
  }
  const side = person(1.5, 0);
  assert.equal(vehicleOverlapsPedestrians(pose, [side]), true);
  assert.equal(
    vehicleOverlapsPedestrians(pose, [person(1.6, 0)]),
    false,
    "physical radius, not 3.2m yielding radius",
  );
});
test("overlap recovery separates the whole body without tail-disc traps or ignoring new people", () => {
  const embedded = person(0, 0);
  const escape = sweepVehiclePedestrians(pose, { ...pose, z: -5 }, [embedded]);
  assert.equal(escape.hit, false);
  assert.equal(vehicleOverlapsPedestrians(escape, [embedded]), false);
  const approaching = person(0, 1.5);
  assert.equal(
    sweepVehiclePedestrians(pose, { ...pose, z: 1 }, [approaching]).fraction,
    0,
  );
  const reverse = sweepVehiclePedestrians(pose, { ...pose, z: -5 }, [
    approaching,
    person(0, -5),
  ]);
  assert.equal(reverse.hit, true);
  assert.ok(Math.abs(reverse.z + 2.35) < 0.0001);
});
test("turning body, vertical levels, down actors, finite inputs and long steps", () => {
  const turn = sweepVehiclePedestrians(
    pose,
    { ...pose, heading: Math.PI / 2 },
    [person(2.2, 0)],
  );
  assert.equal(turn.hit, true);
  assert.ok(turn.heading > 0 && turn.heading < Math.PI / 2);
  assert.equal(
    sweepVehiclePedestrians(pose, { ...pose, z: 20 }, [person(0, 5, 0)]).hit,
    false,
  );
  assert.equal(
    sweepVehiclePedestrians(pose, { ...pose, z: 20 }, [
      { ...person(0, 5), height: 0.55, radius: 0.8 },
    ]).hit,
    true,
  );
  assert.equal(
    sweepVehiclePedestrians(pose, { ...pose, z: Infinity }, []).fraction,
    0,
  );
  assert.equal(
    sweepVehiclePedestrians(pose, { ...pose, z: 1000 }, []).fraction,
    0,
  );
  assert.equal(sweepVehiclePedestrians(pose, pose, [person(0, 0)]).hit, false);
});
test("summon rejects occupied body/departure and ignores the road below without mutating actors", () => {
  const flat = {
    safe: (x: number, z: number): [number, number] => [x, z],
    height: () => 7.88,
    blocked: () => false,
    water: () => false,
  };
  const peds = [person(0, 0), person(0, 7)];
  const before = structuredClone(peds);
  const spot = summonedVehicleSpot(flat, pose, "car", [], peds);
  assert.ok(spot);
  const placed = { ...pose, x: spot[0], z: spot[1] };
  assert.equal(vehicleOverlapsPedestrians(placed, peds), false);
  assert.equal(
    sweepVehiclePedestrians(placed, { ...placed, z: placed.z + 12 }, peds).hit,
    false,
  );
  assert.deepEqual(peds, before);
  assert.deepEqual(
    summonedVehicleSpot(flat, pose, "car", [], [person(0, 0, 0)]),
    [0, 0],
  );
});

test("physical body export leaves persistent progress, panic/down and render visibility unchanged", async () => {
  const { Actors } = await import("../src/game/actors");
  const peds = [
    {
      canadaDistance: 42,
      panic: 8,
      down: 0,
      character: {
        group: {
          position: { x: 478.6, y: 7.88, z: -588.45 },
          visible: false,
          rotation: { y: 0 },
        },
      },
    },
    {
      canadaDistance: 91,
      panic: 0,
      down: 3,
      character: {
        group: {
          position: { x: 481, y: 8.06, z: -590 },
          visible: true,
          rotation: { y: 0 },
        },
      },
    },
  ];
  const before = structuredClone(peds),
    actors = Object.assign(Object.create(Actors.prototype), { peds });
  const bodies = actors.pedestrianBodies();
  assert.deepEqual(peds, before);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].radius, 0.4);
  assert.equal(bodies[1].radius, 1);
  assert.equal(bodies[1].height, 0.55);
  assert.equal(
    vehicleOverlapsPedestrians(
      { x: 478.6, y: 7.88, z: -588.45, heading: 0 },
      bodies,
    ),
    true,
    "render-hidden actors still have physical occupancy",
  );
});

test("reviewed diagonal recovery must not deepen the exposed nose boundary", () => {
  const p = person(1.2, 1.35),
    to = { ...pose, x: 0.1, z: -0.1 };
  const before = vehiclePedestrianDepth(pose, p);
  const result = sweepVehiclePedestrians(pose, to, [p]);
  assert.equal(result.hit, true);
  assert.ok(result.fraction < 0.0001);
  assert.ok(vehiclePedestrianDepth(result, p) <= before + 1e-7);
});
test("fallen torso/head occupancy follows the rotated axis at headings zero and ninety", async () => {
  const { Actors } = await import("../src/game/actors");
  for (const heading of [0, Math.PI / 2]) {
    const actors = Object.assign(Object.create(Actors.prototype), {
      peds: [
        {
          down: 3,
          character: {
            group: {
              position: { x: 0, y: 8.06, z: 0 },
              rotation: { y: heading },
            },
          },
        },
      ],
    });
    const bodies = actors.pedestrianBodies();
    assert.ok(Math.abs(bodies[0].x + 0.9 * Math.cos(heading)) < 1e-12);
    assert.ok(Math.abs(bodies[0].z - 0.9 * Math.sin(heading)) < 1e-12);
    assert.equal(
      vehicleOverlapsPedestrians(
        {
          ...pose,
          x: -2.25 * Math.cos(heading),
          z: 2.25 * Math.sin(heading),
          heading,
        },
        bodies,
      ),
      true,
    );
  }
});

test("centred overlap escapes through the disc waist across many real simulation frames", () => {
  const p = person(0, 0);
  let current = { ...pose };
  for (let i = 0; i < 80; i++) {
    const result = sweepVehiclePedestrians(
      current,
      { ...current, z: current.z - 0.05 },
      [p],
    );
    assert.equal(result.hit, false, `recovery trapped at frame ${i}`);
    current = result;
  }
  assert.equal(vehicleOverlapsPedestrians(current, [p]), false);
});
