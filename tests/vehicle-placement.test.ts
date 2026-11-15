import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  startupBikeSpot,
  summonedVehicleSpot,
  approachingVehicleContact,
  type PlacementCollision,
} from "../src/game/vehicle-placement";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
const flat: PlacementCollision = { safe: (x, z) => [x, z], height: () => 0 };
test("summoning never falls back into water, a different level or occupied space", () => {
  const surface = { ...flat, blocked: () => false, water: () => false };
  const origin = { x: 0, z: 0, y: 0, heading: 0 };
  assert.deepEqual(summonedVehicleSpot(surface, origin, "car", []), [0, 0]);
  const spot = summonedVehicleSpot(surface, origin, "car", [{ x: 0, z: 0 }]);
  assert.ok(spot && Math.hypot(...spot) > 6);
  assert.equal(
    summonedVehicleSpot({ ...surface, water: () => true }, origin, "car", []),
    undefined,
  );
  assert.equal(
    summonedVehicleSpot({ ...surface, height: () => 3 }, origin, "car", []),
    undefined,
  );
  assert.equal(
    summonedVehicleSpot(
      { ...surface, blocked: () => true },
      origin,
      "bike",
      [],
    ),
    undefined,
  );
});
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
  const spot = startupBikeSpot(collision, spawn, [spawn]);
  assert.ok(spot);
  assert.equal(collision.water(...spot), false);
  assert.equal(
    collision.blocked(...spot, 0.5, collision.height(...spot)),
    false,
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

test("native Canada Place road projection prefers a clear departure over the next ground stay", () => {
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
  const collision = new CollisionWorld(data);
  collision.setCanadaPlaceCapabilities({
    loaded: true,
    concourse: true,
    entranceCanopy: true,
    groundStays: true,
    promenadeFixtures: true,
  });
  const player = { x: 579.05, z: -643.53, y: 7.88 };
  const nearest = collision.nearestRoad(player.x, player.z, 100)!;
  const projected = collision.safe(nearest.x, nearest.z, 1.2);
  const origin = {
    x: projected[0],
    z: projected[1],
    y: player.y,
    heading: nearest.heading,
  };
  const clear = (x: number, z: number, forward: number) =>
    [
      [0, 1.16],
      [-1.35, 0.9],
      [1.35, 0.9],
    ].every(([offset, radius]) => {
      const xx = x + Math.sin(origin.heading) * (forward + offset);
      const zz = z + Math.cos(origin.heading) * (forward + offset);
      return (
        Math.abs(collision.height(xx, zz, player.y) - player.y) <= 0.6 &&
        !collision.blocked(xx, zz, radius, player.y) &&
        !collision.water(xx, zz, player.y)
      );
    });
  assert.ok(
    Math.hypot(
      projected[0] - 578.1804722814823,
      projected[1] + 642.1427952477711,
    ) < 1e-6,
  );
  for (let d = 0; d <= 3; d += 0.1)
    assert.ok(
      clear(...projected, d),
      "old departure test accepts the projected lane",
    );
  assert.equal(
    clear(573.47, -639.6, 0),
    false,
    "native stopped pose has a blocked nose capsule",
  );
  const spot = summonedVehicleSpot(collision, origin, "car", []);
  assert.ok(spot);
  assert.notDeepEqual(spot, projected);
  // Finer independent sampling than placement's half-metre samples.
  for (let d = 0; d <= 12; d += 0.1)
    assert.ok(clear(...spot, d), `whole-car departure at ${d} m`);
  console.log(
    `Native promenade placement: ${projected} → ${spot}, 12 m clear.`,
  );
});

test("a supported short street corner remains summonable when no twelve-metre line exists", () => {
  const collision = {
    ...flat,
    blocked: (x: number, z: number, r: number) =>
      Math.abs(x) + r > 1.5 || z - r < -3 || z + r > 7,
    water: () => false,
  };
  assert.deepEqual(
    summonedVehicleSpot(collision, { x: 0, z: 0, y: 0, heading: 0 }, "car", []),
    [0, 0],
  );
});
