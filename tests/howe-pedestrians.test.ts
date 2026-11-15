import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { canadaPlaceApproachGeometry } from "../src/world/canada-place-approach";
import {
  ORIGIN,
  KX,
  roadWidth,
  segmentPoint,
  type CityData,
} from "../src/world/data";
import {
  createHowePedestrianCircuits,
  howePedestrianPoint,
  howePedestrianHeight,
  howePedestrianAssignment,
  advanceHowePedestrian,
  findHowePedestrianSpawn,
  HOWE_PEDESTRIAN_SLOTS,
  type HoweVehicleObstacle,
} from "../src/game/howe-pedestrians";
import {
  CANADA_PEDESTRIAN_SLOTS,
  PEDESTRIAN_POOL_LIMIT,
} from "../src/game/canada-place-pedestrians";
import { Actors, type Pedestrian } from "../src/game/actors";
import type { World } from "../src/world/world";
import { vehicleOverlapsPedestrians } from "../src/game/vehicle-pedestrian-contact";

function collision() {
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
  const ground = new CollisionWorld(data);
  ground.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true, true),
  );
  return ground;
}
const ground = collision(),
  circuits = createHowePedestrianCircuits(ground)!;
const state = { distance: 8, pace: 1.08, panic: 0, down: 0 };

test("both Howe loops clear actual buildings, guards and every roadway including the driveway", (t) => {
  assert.equal(circuits.length, 2);
  let samples = 0,
    minimumY = Infinity,
    maximumY = -Infinity;
  for (const c of circuits) {
    assert.ok(c.length > 30 && c.length < 70);
    let previous = howePedestrianPoint(c, -0.1),
      previousY = howePedestrianHeight(ground, previous);
    for (let d = 0; d < c.length; d += 0.1) {
      const p = howePedestrianPoint(c, d),
        y = howePedestrianHeight(ground, p);
      assert.equal(ground.blocked(p.x, p.z, 0.4, y), false);
      assert.equal(ground.water(p.x, p.z, y), false);
      assert.ok(ground.canada!.contains(p.x, p.z));
      assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < 0.101);
      assert.ok(Math.abs(y - previousY) < 0.03);
      for (const road of c.carriageways)
        for (let i = 0; i < road.pts.length - 2; i += 2)
          assert.ok(
            segmentPoint(
              p.x,
              p.z,
              road.pts[i],
              road.pts[i + 1],
              road.pts[i + 2],
              road.pts[i + 3],
            ).d >=
              roadWidth(road) / 2 + 0.4,
          );
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
      previous = p;
      previousY = y;
      samples++;
    }
  }
  assert.ok(maximumY - minimumY > 6, "feet must track the Howe grade");
  t.diagnostic(
    `${samples} samples; foot height ${minimumY.toFixed(2)}–${maximumY.toFixed(2)}m; loops ${circuits.map((c) => c.length.toFixed(2)).join("/")}m`,
  );
});

test("feet match the actual raised pavement triangles, not just a copied height expectation", () => {
  const parts = canadaPlaceApproachGeometry(
    ground.data,
    ground.canada!,
    (x, z) => ground.existingGroundHeight(x, z),
  );
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mesh = new T.Mesh(parts.pavement, material);
  mesh.updateMatrixWorld();
  const ray = new T.Raycaster();
  for (const c of circuits)
    for (let d = 1; d < c.length; d += 4) {
      const p = howePedestrianPoint(c, d),
        y = howePedestrianHeight(ground, p);
      ray.set(new T.Vector3(p.x, y + 2, p.z), new T.Vector3(0, -1, 0));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, "walking route has rendered pavement below feet");
      assert.ok(
        Math.abs(hit.point.y - y) < 0.02,
        `foot ${y}, pavement ${hit.point.y}`,
      );
    }
  Object.values(parts).forEach((g) => g.dispose());
  material.dispose();
});

test("missing support, a new obstacle or a discontinuous grade disables assignment", () => {
  assert.equal(
    createHowePedestrianCircuits({
      ...ground,
      canada: undefined,
    } as CollisionWorld),
    null,
  );
  const blocked = collision(),
    p = howePedestrianPoint(circuits[0], 10);
  blocked.addForestTrunk(p.x, p.z, 0.25);
  assert.equal(createHowePedestrianCircuits(blocked), null);
  const cliff = collision(),
    height = cliff.height.bind(cliff);
  cliff.height = (x, z) => height(x, z) + (x > p.x ? 1 : 0);
  assert.equal(createHowePedestrianCircuits(cliff), null);
});

test("yielding uses the parked nose/tail and predicted forward/reverse swept vehicle capsules", () => {
  const c = circuits[0],
    p = howePedestrianPoint(c, state.distance),
    y = howePedestrianHeight(ground, p);
  const car: HoweVehicleObstacle = {
    x: p.x,
    z: p.z - 2,
    y,
    heading: 0,
    kind: "car",
    speed: 0,
  };
  // More than 2m from centre but already under the physical nose: the old
  // placement-centre heuristic would miss this overlap.
  assert.equal(
    vehicleOverlapsPedestrians(car, [{ ...p, y, radius: 0.4, height: 1.8 }]),
    true,
  );
  assert.equal(
    advanceHowePedestrian(c, state, 0.05, ground, [], [car]).speed,
    0,
  );
  for (const direction of [-1, 1]) {
    const moving = { ...car, z: p.z - direction * 5.5, speed: direction * 8 };
    assert.equal(
      vehicleOverlapsPedestrians(moving, [
        { ...p, y, radius: 0.4, height: 1.8 },
      ]),
      false,
    );
    assert.equal(
      advanceHowePedestrian(c, state, 0.05, ground, [], [moving]).speed,
      0,
    );
    assert.ok(
      advanceHowePedestrian(
        c,
        state,
        0.05,
        ground,
        [],
        [{ ...moving, y: y - 4 }],
      ).speed > 0,
    );
  }
  const spawn = findHowePedestrianSpawn(c, state.distance, ground, [], [car]);
  assert.ok(spawn !== undefined && spawn !== state.distance);
  assert.ok(
    advanceHowePedestrian(
      c,
      { ...state, distance: spawn },
      0.05,
      ground,
      [],
      [car],
    ).speed > 0,
  );
});

test("panic sweeps every .1m and waiting/down/corrupt steps have zero gait speed", () => {
  const c = circuits[0],
    p = howePedestrianPoint(c, state.distance + 0.8),
    y = howePedestrianHeight(ground, p);
  const body = { ...p, y, radius: 0.05, height: 1.8 };
  assert.equal(
    advanceHowePedestrian(c, { ...state, panic: 8 }, 0.25, ground, [body], [])
      .distance,
    state.distance,
  );
  for (const dt of [0, -1, NaN, Infinity, 0.251])
    assert.equal(advanceHowePedestrian(c, state, dt, ground, [], []).speed, 0);
  assert.equal(
    advanceHowePedestrian(c, { ...state, down: 2 }, 0.05, ground, [], []).speed,
    0,
  );
  assert.ok(
    Number.isFinite(
      advanceHowePedestrian(c, state, Number.MIN_VALUE, ground, [], []).speed,
    ),
  );
  assert.equal(
    advanceHowePedestrian(c, { ...state, distance: NaN }, 0.05, ground, [], [])
      .speed,
    0,
  );
  assert.ok(
    advanceHowePedestrian(c, state, 0.05, ground, [], []).distance >
      state.distance,
  );
});

test("three existing rigs retain their circuit through recycling and remain ordinary contact bodies", () => {
  const actors = new Actors({ collision: ground } as World),
    speeds: number[] = [];
  actors.howeCircuits = circuits;
  for (let slot = 0; slot < HOWE_PEDESTRIAN_SLOTS; slot++) {
    const assignment = howePedestrianAssignment(circuits, slot),
      p = howePedestrianPoint(circuits[assignment.route], assignment.distance),
      group = new T.Group();
    group.position.set(p.x, howePedestrianHeight(ground, p), p.z);
    actors.peds.push({
      howe: { ...assignment, speed: 0 },
      character: {
        group,
        update: (_t: number, speed: number) => speeds.push(speed),
      },
      road: circuits[assignment.route].road,
      segment: 0,
      t: 0,
      direction: 1,
      side: 1,
      down: 0,
      panic: 0,
    } as unknown as Pedestrian);
  }
  const before = actors.howePedestrianSummary(),
    ids = [...actors.peds];
  actors.recycle(new T.Vector3(2000, 0, 2000), null, true);
  assert.deepEqual(actors.peds, ids);
  assert.deepEqual(actors.howePedestrianSummary(), before);
  assert.equal(actors.pedestrianBodies().length, 3);
  const first = actors.peds[0],
    player = first.character.group.position.clone();
  actors.update(0.05, player, null);
  assert.equal(first.howe!.speed, 0);
  assert.equal(speeds[0], 0);
  actors.update(0.05, player.clone().add(new T.Vector3(0, 0, 10)), null);
  assert.ok(first.howe!.distance > before.assigned[0].distance);
  assert.equal(CANADA_PEDESTRIAN_SLOTS, 6);
  assert.equal(PEDESTRIAN_POOL_LIMIT, 34);
  assert.equal(actors.peds.length, 3);
});
