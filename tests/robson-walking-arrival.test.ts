import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Vector3, PerspectiveCamera } from "three";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import {
  ROBSON_WALKING_ARRIVAL as pose,
  robsonWalkingArrival,
} from "../src/game/robson-walking-arrival";
import {
  shortenChaseBoom,
  chaseCharacterHidden,
} from "../src/game/chase-camera";

const clear = () => ({
  walkingHeight: () => 0,
  height: () => 0,
  blocked: () => false,
  water: () => false,
  cameraBlocked: () => false,
});

test("walking-only selection fails safely for lost floor, body, water, ledge or boom clearance", () => {
  const never = new Proxy(clear(), {
    get() {
      throw Error("unexpected collision query");
    },
  });
  assert.equal(robsonWalkingArrival("robson", false, never), undefined);
  assert.equal(robsonWalkingArrival("canada-place", true, never), undefined);
  assert.deepEqual(robsonWalkingArrival("robson", true, clear()), {
    ...pose,
    y: 0,
  });
  for (const override of [
    { walkingHeight: () => NaN },
    { blocked: () => true },
    { water: () => true },
    { cameraBlocked: () => true },
    { walkingHeight: (x: number) => (x === pose.x ? 0 : 1) },
    { height: () => NaN },
  ])
    assert.equal(
      robsonWalkingArrival("robson", true, { ...clear(), ...override }),
      undefined,
    );
});

test("actual full-city support accepts gallery arrival, complete normal camera boom and approach", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    try {
      return new Response(
        fs.readFileSync(`public/${String(url).replace(/^\//, "")}`),
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  };
  let data;
  try {
    data = await loadCity();
  } finally {
    globalThis.fetch = fetch;
  }
  const collision = new CollisionWorld(data);
  const arrival = robsonWalkingArrival("robson", true, collision);
  assert.ok(
    arrival,
    "approved native pose remains safe against all source layers",
  );
  assert.equal(arrival.y, 0);
  const feet = new Vector3(arrival.x, arrival.y, arrival.z);
  const focus = feet.clone().add(new Vector3(0, 1.52, 0));
  const camera = focus
    .clone()
    .add(
      new Vector3(
        -Math.sin(pose.heading) * 4.3,
        0.55,
        -Math.cos(pose.heading) * 4.3,
      ),
    );
  assert.equal(
    shortenChaseBoom(focus, camera, (p) =>
      collision.cameraBlocked(p.x, p.z, 0.25, p.y),
    ),
    1,
  );
  assert.equal(chaseCharacterHidden(camera, feet, 0.35, false), false);
  assert.ok(
    camera.distanceTo(
      new Vector3(-71.82790662769159, 2.07, 54.56108374927385),
    ) < 1e-9,
    "same camera position as ordinary gallery-ashlar-corrected native profile",
  );
  for (let d = 0; d <= 8; d += 0.2) {
    const x = pose.x + Math.sin(pose.heading) * d;
    const z = pose.z + Math.cos(pose.heading) * d;
    const y = collision.walkingHeight(x, z, arrival.y);
    assert.equal(y, 0, `level forecourt at ${d}m`);
    assert.equal(
      collision.blocked(x, z, 0.36, y),
      false,
      `body clearance at ${d}m`,
    );
    assert.equal(collision.water(x, z, y), false);
  }
});

// Execute the production method body without booting Game's browser/UI. This
// catches a wiring regression where a correct helper also relocates vehicles.
const main = fs.readFileSync("src/main.ts", "utf8");
const body = main.slice(
  main.indexOf("  travel(id: string) {") + "  travel(id: string) {".length,
  main.indexOf("\n  activity(id: string)"),
);
const travel = new Function(
  "id",
  "robsonWalkingArrival",
  "ui",
  "LANDMARKS",
  "ironworkersVehicleArrival = () => undefined",
  body.slice(0, body.lastIndexOf("}")),
);
const road = { x: -152.65, z: 60.51, heading: 2.360409428350793 };
function game(vehicle: boolean, collision = clear()) {
  return {
    player: new Vector3(),
    lastSafe: new Vector3(),
    world: { collision, data: { roads: [] } },
    camera: new PerspectiveCamera(39),
    vehicle: vehicle
      ? {
          state: { speed: 10, vx: 3, vz: 4, steer: 1 },
          model: { group: { userData: {} } },
        }
      : null,
    photo: true,
    cameraMode: 2,
    footSpeed: 4,
    footstepDistance: 1,
    heading: 0,
    mouseYaw: 0,
    pitch: 0,
    velocityY: 1,
    aiming: true,
    spawnPoint: () => ({ ...road }),
    clearPointerInput() {
      this.aiming = false;
    },
    actors: { recycle() {}, sync() {}, groundHeight: () => 0.12 },
    setCamera() {},
    resume() {},
  };
}
const ui = { mapOpen: true, show() {}, toast() {} };
test("actual travel method preserves car road position/heading and other landmarks", () => {
  const car = game(true);
  travel.call(car, "robson", robsonWalkingArrival, ui, []);
  assert.deepEqual(car.player.toArray(), [road.x, 0.12, road.z]);
  assert.deepEqual(car.vehicle!.state, {
    ...road,
    speed: 0,
    vx: 0,
    vz: 0,
    steer: 0,
  });
  assert.equal(car.heading, road.heading);
  assert.equal(car.mouseYaw, road.heading);
  assert.equal(car.pitch, 0.19);
  assert.equal(car.cameraMode, 2);
  for (const [id, collision] of [
    ["canada-place", clear()],
    ["robson", { ...clear(), blocked: () => true }],
  ] as const) {
    const walker = game(false, collision);
    travel.call(walker, id, robsonWalkingArrival, ui, []);
    assert.deepEqual(walker.player.toArray(), [road.x, 0, road.z]);
    assert.equal(walker.heading, road.heading);
  }
});
test("actual walking travel starts normal third-person view with exact live floor and free controls", () => {
  const walker = game(false);
  travel.call(walker, "robson", robsonWalkingArrival, ui, []);
  assert.deepEqual(walker.player.toArray(), [pose.x, 0, pose.z]);
  assert.deepEqual(walker.lastSafe.toArray(), walker.player.toArray());
  assert.equal(walker.mouseYaw, pose.heading);
  assert.equal(walker.pitch, pose.pitch);
  assert.equal(walker.camera.fov, 62);
  assert.equal(walker.cameraMode, 0);
  assert.equal(walker.photo, false);
  assert.equal(walker.aiming, false);
  assert.equal(
    walker.velocityY + walker.footSpeed + walker.footstepDistance,
    0,
  );
});
