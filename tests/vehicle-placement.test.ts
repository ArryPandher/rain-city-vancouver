import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  startupBikeSpot,
  approachingVehicleContact,
  type PlacementCollision,
} from "../src/game/vehicle-placement";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
const flat: PlacementCollision = { safe: (x, z) => [x, z], height: () => 0 };
test("startup bike prefers behind the car and validates every occupied position after safe projection", () => {
  const spawn = { x: 0, z: 0, heading: 0 };
  assert.deepEqual(startupBikeSpot(flat, spawn, []), [4, -8]);
  assert.deepEqual(startupBikeSpot(flat, spawn, [{ x: 4, z: -8 }]), [-4, -10]);
  assert.equal(
    startupBikeSpot({ ...flat, safe: () => [0, 1] }, spawn, []),
    undefined,
  );
  const calls: number[] = [];
  const projected = {
    ...flat,
    safe: () => {
      calls.push(1);
      return calls.length === 1
        ? ([20, 20] as [number, number])
        : ([-4, -10] as [number, number]);
    },
  };
  assert.deepEqual(
    startupBikeSpot(projected, spawn, [{ x: 20, z: 20 }]),
    [-4, -10],
  );
});
test("placement rejects unsupported, wet, invalid and wrong-level candidates without unsafe fallback", () => {
  const spawn = { x: 0, z: 0, heading: 0 };
  assert.equal(
    startupBikeSpot(
      { ...flat, height: (x, z) => (x === 0 && z === 0 ? 0 : 2) },
      spawn,
      [],
    ),
    undefined,
  );
  assert.equal(
    startupBikeSpot({ ...flat, blocked: () => true }, spawn, []),
    undefined,
  );
  assert.equal(
    startupBikeSpot({ ...flat, water: () => true }, spawn, []),
    undefined,
  );
  assert.equal(
    startupBikeSpot({ ...flat, safe: () => [NaN, 0] }, spawn, []),
    undefined,
  );
  assert.equal(
    startupBikeSpot({ ...flat, height: () => Infinity }, spawn, []),
    undefined,
  );
});
test("real Howe startup does not project the bicycle into the player's driving path", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const collision = new CollisionWorld(data),
    spawn = { x: 486.65, z: -453.35, heading: 2.4443631020289107 };
  const old = collision.safe(spawn.x + 8, spawn.z + 4, 1);
  assert.ok(
    Math.hypot(old[0] - spawn.x, old[1] - spawn.z) < 2.1,
    "reproduce original overlap",
  );
  const spot = startupBikeSpot(collision, spawn, [spawn]);
  assert.ok(spot);
  assert.ok(
    Math.hypot(spot[0] - 478.4467338189848, spot[1] + 449.78539287390424) <
      1e-6,
  );
  assert.ok(Math.hypot(spot[0] - spawn.x, spot[1] - spawn.z) >= 5);
  assert.ok(
    Math.abs(collision.height(...spot) - collision.height(spawn.x, spawn.z)) <=
      1.5,
  );
});
test("vehicle contacts distinguish approaching, separating, parallel and different-level traffic", () => {
  const car = { x: 0, z: 0, y: 4.7, vx: 0, vz: 2 },
    bike = { x: 0, z: 1.5, y: 4.8 };
  assert.equal(approachingVehicleContact(car, bike), true);
  assert.equal(approachingVehicleContact({ ...car, vz: -2 }, bike), false);
  assert.equal(
    approachingVehicleContact({ ...car, vx: 2, vz: 0 }, bike),
    false,
  );
  assert.equal(approachingVehicleContact(car, { ...bike, y: 0 }), false);
  assert.equal(approachingVehicleContact(car, { ...bike, z: 2.1 }), false);
  assert.equal(
    approachingVehicleContact({ ...car, y: 0 }, { ...bike, y: 1.8 }),
    false,
  );
  assert.equal(approachingVehicleContact({ ...car, vz: NaN }, bike), false);
  assert.equal(approachingVehicleContact(car, { ...bike, z: 0 }), false);
});
