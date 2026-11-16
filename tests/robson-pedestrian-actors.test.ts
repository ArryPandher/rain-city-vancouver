import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Actors, type Pedestrian, type Vehicle } from "../src/game/actors";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import type { World } from "../src/world/world";
import { loadCity } from "./helpers/full-city-data";
import {
  createRobsonPedestrianCircuit,
  robsonPedestrianPoint,
  robsonPedestrianAssignment,
} from "../src/game/robson-pedestrians";
import { PEDESTRIAN_POOL_LIMIT } from "../src/game/canada-place-pedestrians";

const previousFetch = globalThis.fetch;
let ground: CollisionWorld;
try {
  globalThis.fetch = async (input) =>
    new Response(new Uint8Array(fs.readFileSync(`public${input}`)));
  ground = new CollisionWorld(await loadCity());
  ground.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true, true),
  );
} finally {
  globalThis.fetch = previousFetch;
}
const circuit = createRobsonPedestrianCircuit(ground)!;
assert.ok(circuit);
function actors(collision = ground) {
  const a = new Actors({
    collision,
    scene: new T.Scene(),
    materials: {
      dark: new T.MeshStandardMaterial(),
      chrome: new T.MeshStandardMaterial(),
    },
  } as unknown as World);
  let generic = 0;
  // Vehicle/art asset loading and random off-site placement are independent of
  // fixed-route allocation. Still run the real populate loop and character rigs.
  a.place = (_spans, _x, _z, options) => {
    if (!options.pedestrian) return null;
    const x = 1200 + 4 * generic++;
    return {
      x,
      z: 1000,
      heading: 0,
      len: 20,
      road: { kind: "footway", pts: [x, 1000, x, 1020] },
      t: 0,
      segment: 0,
    };
  };
  return a;
}
function populate(a: Actors, x: number, z: number) {
  const previous = globalThis.document;
  // The fallback rig's existing fabric canvas needs only these 2D operations.
  // No renderer, browser, image download or alternate character implementation.
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
      }),
    }),
  } as unknown as Document;
  try {
    a.populate(x, z);
  } finally {
    globalThis.document = previous;
  }
}
function dispose(a: Actors) {
  a.world.scene.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
    }
  });
}

test("real populate reuses slots9–11, keeps Canada/Howe allocations, avoids player spawn and recycles only22 generic rigs", () => {
  const a = actors();
  const desired = robsonPedestrianAssignment(circuit, 0)!;
  const player = robsonPedestrianPoint(circuit, desired.distance);
  populate(a, player.x, player.z);
  assert.equal(a.peds.length, PEDESTRIAN_POOL_LIMIT);
  assert.equal(a.peds.length, 34);
  assert.ok(
    a.peds
      .slice(0, 6)
      .every((p) => p.canadaDistance !== undefined && !p.howe && !p.robson),
  );
  assert.ok(
    a.peds
      .slice(6, 9)
      .every((p) => p.howe && p.canadaDistance === undefined && !p.robson),
  );
  assert.ok(
    a.peds
      .slice(9, 12)
      .every((p) => p.robson && !p.howe && p.canadaDistance === undefined),
  );
  assert.ok(
    a.peds
      .slice(12)
      .every((p) => !p.robson && !p.howe && p.canadaDistance === undefined),
  );
  assert.notEqual(
    a.peds[9].robson!.distance,
    desired.distance,
    "player occupies nominal phase",
  );
  for (const p of a.peds.slice(9, 12)) {
    const position = p.character.group.position;
    assert.equal(position.y, 0);
    assert.ok(Math.hypot(position.x - player.x, position.z - player.z) >= 1.07);
    assert.equal(
      ground.blocked(position.x, position.z, 0.4, position.y),
      false,
    );
  }
  const before = a.robsonPedestrianSummary(),
    ids = a.peds.map((p) => p.character.group.id);
  let recycled = 0;
  const place = a.place;
  a.place = (...args) => {
    recycled++;
    return place(...args);
  };
  a.recycle(new T.Vector3(2000, 0, 2000), null, true);
  assert.equal(recycled, 22);
  assert.deepEqual(a.robsonPedestrianSummary(), before);
  assert.deepEqual(
    a.peds.map((p) => p.character.group.id),
    ids,
  );
  assert.equal(a.pedestrianBodies().length, 34);
  assert.equal(before.sourceRoad, "w749560067");
  dispose(a);
});

test("invalid Robson source retains generic slots without inventing a circuit or adding rigs", () => {
  const collision = Object.assign(Object.create(ground), {
    data: {
      ...ground.data,
      roads: ground.data.roads.filter((r) => r.id !== "w749560067"),
    },
  });
  const a = actors(collision);
  populate(a, 0, 0);
  assert.equal(a.peds.length, 34);
  assert.equal(a.robsonCircuit, null);
  assert.equal(a.robsonPedestrianSummary().assigned.length, 0);
  assert.ok(
    a.peds
      .slice(9, 12)
      .every((p) => !p.robson && !p.howe && p.canadaDistance === undefined),
  );
  assert.ok(
    a.peds.slice(9, 12).every((p) => p.character.group.position.x >= 1200),
  );
  dispose(a);
});

function fixedActors() {
  const a = new Actors({ collision: ground } as World);
  a.robsonCircuit = circuit;
  const speeds: number[][] = [[], [], []];
  for (let slot = 0; slot < 3; slot++) {
    const assignment = robsonPedestrianAssignment(circuit, slot)!;
    const at = robsonPedestrianPoint(circuit, assignment.distance),
      group = new T.Group();
    group.position.set(at.x, 0, at.z);
    group.rotation.y = at.heading;
    a.peds.push({
      robson: { ...assignment, speed: 0 },
      character: {
        group,
        update: (_t: number, speed: number) => speeds[slot].push(speed),
      },
      road: circuit.road,
      segment: 0,
      t: 0,
      direction: 1,
      side: 1,
      panic: 0,
      down: 0,
    } as unknown as Pedestrian);
  }
  return { a, speeds };
}

test("Actors update feeds displacement to existing animation, yields to player/car/bike/body, preserves down recovery and visibility", () => {
  const { a, speeds } = fixedActors();
  const p = a.peds[0],
    obj = p.character.group;
  const distant = obj.position.clone().add(new T.Vector3(20, 0, 20));
  const before = obj.position.clone();
  a.update(0.05, distant, null);
  assert.ok(p.robson!.speed > 0);
  assert.ok(
    Math.abs(speeds[0].at(-1)! - obj.position.distanceTo(before) / 0.05) < 1e-8,
  );
  const progress = p.robson!.distance;
  a.update(0.05, obj.position.clone(), null);
  assert.equal(p.robson!.distance, progress);
  assert.equal(speeds[0].at(-1), 0);
  for (const kind of ["car", "bike"] as const) {
    const vehicleGroup = new T.Group();
    vehicleGroup.position.copy(obj.position);
    const v = {
      kind,
      model: { group: vehicleGroup },
      state: {
        x: obj.position.x,
        z: obj.position.z,
        heading: obj.rotation.y,
        speed: -3,
      },
    } as Vehicle;
    a.vehicles = [v];
    a.update(0.05, distant, v);
    assert.equal(p.robson!.distance, progress);
    assert.equal(speeds[0].at(-1), 0);
  }
  a.vehicles = [];
  // An ordinary down actor remains a finite physical obstacle, not a hidden rig.
  const other = a.peds[1],
    otherPosition = other.character.group.position.clone();
  other.character.group.position.copy(obj.position);
  other.character.group.rotation.y = 0;
  other.down = 1;
  a.update(0.05, distant, null);
  assert.equal(p.robson!.distance, progress);
  other.character.group.position.copy(otherPosition);
  other.down = 0;
  p.down = 0.1;
  p.panic = 2;
  a.update(0.05, distant, null);
  assert.equal(p.robson!.speed, 0);
  assert.equal(obj.position.y, 0.18);
  assert.equal(obj.rotation.z, Math.PI / 2);
  a.update(0.06, distant, null);
  a.update(0.05, distant, null);
  assert.equal(obj.rotation.z, 0);
  assert.equal(obj.position.y, 0);
  assert.ok(p.robson!.distance > progress);
  assert.ok(p.robson!.speed > 4);
  const animations = speeds[0].length,
    at = p.robson!.distance;
  a.update(0.05, distant.clone().add(new T.Vector3(300, 0, 0)), null);
  assert.equal(obj.visible, false);
  assert.equal(
    speeds[0].length,
    animations,
    "existing render culling avoids offscreen animation updates",
  );
  assert.ok(
    p.robson!.distance > at,
    "fixed world path continues without teleport/recycling",
  );
  a.update(0.05, distant, null);
  assert.equal(obj.visible, true);
  assert.equal(speeds[0].length, animations + 1);
});
