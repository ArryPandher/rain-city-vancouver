import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  LANDMARKS,
  roadWidth,
  segmentPoint,
  type Road,
} from "../src/world/data";
import { loadCity } from "./helpers/full-city-data";
import { ironworkersVehicleArrival as arrival } from "../src/game/ironworkers-vehicle-arrival";
import { pointOnRoad } from "../src/game/road-placement";
import { drivingOffset } from "../src/world/road-profile";
import { VEHICLE_FOOTPRINTS } from "../src/game/vehicle-contact";
import { ribbon, subdividePath } from "../src/world/geometry";
const roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads as Road[];
const clear = {
  height: () => 0,
  blocked: () => false,
  water: () => false,
  move: (x: number, z: number, dx: number, dz: number) => ({
    x: x + dx,
    z: z + dz,
    hit: false,
  }),
};

test("arrival is vehicle-only, exact northbound way and fails safely on changed source/contact", () => {
  assert.equal(arrival("ironworkers", undefined, roads, clear), undefined);
  assert.equal(arrival("robson", "car", roads, clear), undefined);
  assert.equal(arrival("ironworkers", "car", [], clear), undefined);
  const road = roads.find((r) => r.id === "w48608388")!;
  for (const replacement of [
    { ...road, oneway: false },
    { ...road, lanes: 2 },
    { ...road, sourceKind: "residential" },
  ])
    assert.equal(
      arrival("ironworkers", "car", [replacement], clear),
      undefined,
    );
  for (const world of [
    { ...clear, height: () => NaN },
    { ...clear, blocked: () => true },
    { ...clear, water: () => true },
  ])
    assert.equal(arrival("ironworkers", "car", roads, world), undefined);
  const p = arrival("ironworkers", "car", roads, clear)!;
  assert.ok(p);
  assert.equal(p.roadId, "w48608388");
  assert.equal(p.segment, 4);
  let station =
    p.t * Math.hypot(road.pts[6] - road.pts[4], road.pts[7] - road.pts[5]);
  for (let i = 0; i < p.segment; i += 2)
    station += Math.hypot(
      road.pts[i + 2] - road.pts[i],
      road.pts[i + 3] - road.pts[i + 1],
    );
  assert.ok(Math.abs(station - 40) < 1e-9);
  const expected = pointOnRoad(road, p.segment, p.t, 0);
  assert.equal(p.heading, expected.heading);
  assert.equal(p.x, expected.x);
  assert.equal(p.z, expected.z);
});

test("full data proves old divider/heading, corrected chassis/departure, rendered surface and AI flow", async (t) => {
  const original = JSON.stringify(roads),
    fetch = globalThis.fetch;
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
  const collision = new CollisionWorld(data),
    l = LANDMARKS.find((l) => l.id === "ironworkers")!;
  const old = collision.nearestRoad(...l.spawn, 100)!;
  assert.equal(old.road.id, "w507979055");
  assert.equal(old.road.lanes, 2);
  assert.equal(old.road.oneway, true);
  const headingError =
    (Math.abs(
      Math.atan2(
        Math.sin(l.heading - old.heading),
        Math.cos(l.heading - old.heading),
      ),
    ) *
      180) /
    Math.PI;
  assert.ok(headingError > 7 && headingError < 8);
  const p = arrival("ironworkers", "car", data.roads, collision)!;
  assert.ok(p);
  const nb = data.roads.find((r) => r.id === p.roadId)!;
  for (const id of ["w48608388", "w1275279652", "w23795563", "w1059700345"]) {
    const road: Road = data.roads.find((r) => r.id === id)!;
    assert.equal(road.oneway, true);
    assert.equal(road.lanes, 3);
    const direction = road.pts.at(-1)! - road.pts[1];
    assert.ok(
      id === "w48608388" || id === "w1275279652"
        ? direction < 0
        : direction > 0,
    );
  }
  // Actual renderer path: subdivided source ribbon, per-edge road grade, asphalt+.092.
  const g = ribbon(
    subdividePath(nb.pts),
    roadWidth(nb),
    0.092,
    (x, z) => collision.roadHeight(nb, x, z),
    5,
    true,
  );
  const mesh = new T.Mesh(g, new T.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  let probes = 0;
  for (let distance = 0; distance <= 12; distance += 1) {
    const x = p.x + Math.sin(p.heading) * distance,
      z = p.z + Math.cos(p.heading) * distance;
    for (const side of [
      -VEHICLE_FOOTPRINTS.car.halfWidth,
      0,
      VEHICLE_FOOTPRINTS.car.halfWidth,
    ])
      for (const along of [
        -VEHICLE_FOOTPRINTS.car.halfLength,
        0,
        VEHICLE_FOOTPRINTS.car.halfLength,
      ]) {
        const cx = x + Math.cos(p.heading) * side + Math.sin(p.heading) * along;
        const cz = z - Math.sin(p.heading) * side + Math.cos(p.heading) * along;
        const y = collision.height(cx, cz, p.y);
        const hit = new T.Raycaster(
          new T.Vector3(cx, y + 2, cz),
          new T.Vector3(0, -1, 0),
          0,
          4,
        ).intersectObject(mesh)[0];
        assert.ok(
          hit,
          "every chassis corner has an upward-facing visible asphalt surface",
        );
        assert.ok(
          Math.abs(hit.point.y - (y + 0.092)) < 0.005,
          "rendered source-road finish follows live grade",
        );
        assert.equal(collision.blocked(cx, cz, 0.02, y), false);
        assert.equal(collision.water(cx, cz, y), false);
        const q = segmentPoint(
          cx,
          cz,
          nb.pts[p.segment],
          nb.pts[p.segment + 1],
          nb.pts[p.segment + 2],
          nb.pts[p.segment + 3],
        );
        assert.ok(q.d < 1.8, "complete chassis stays inside middle lane");
        probes++;
      }
  }
  const a = pointOnRoad(nb, p.segment, p.t, drivingOffset(nb));
  const b = pointOnRoad(nb, p.segment, p.t + 0.02, drivingOffset(nb));
  assert.ok(
    (b.x - a.x) * Math.sin(p.heading) + (b.z - a.z) * Math.cos(p.heading) > 0,
  );
  assert.equal(a.heading, p.heading, "nearby northbound AI moves with arrival");
  const sb = data.roads.find((r) => r.id === "w1059700345")!;
  const south = pointOnRoad(sb, 0, 0.5, drivingOffset(sb));
  assert.ok(
    Math.cos(south.heading - p.heading) < -0.99,
    "opposite carriageway AI moves oppositely by design",
  );
  assert.equal(JSON.stringify(roads), original);
  t.diagnostic(
    JSON.stringify({
      oldRoad: old.road.id,
      headingError,
      arrival: p,
      cornerSurfaceProbes: probes,
      ai: a,
    }),
  );
});

test("actual travel method uses corrected vehicle heading while preserving walking and other destinations", () => {
  const main = fs.readFileSync("src/main.ts", "utf8"),
    start =
      main.indexOf("  travel(id: string) {") + "  travel(id: string) {".length;
  const body = main.slice(start, main.indexOf("\n  activity(id: string)"));
  const travel = new Function(
    "id",
    "robsonWalkingArrival",
    "ironworkersVehicleArrival",
    "ui",
    "LANDMARKS",
    body.slice(0, body.lastIndexOf("}")),
  );
  const fallback = { x: 10, z: 20, heading: 0.7 },
    ui = { mapOpen: true, show() {}, toast() {} };
  const game = (vehicle: boolean) => ({
    player: new T.Vector3(),
    lastSafe: new T.Vector3(),
    world: { collision: clear, data: { roads } },
    vehicle: vehicle
      ? { kind: "car", state: {}, model: { group: { userData: {} } } }
      : null,
    actors: { sync() {}, recycle() {}, groundHeight: () => 0.12 },
    spawnPoint: () => ({ ...fallback }),
    setCamera() {},
    resume() {},
  });
  const vehicle = game(true);
  travel.call(vehicle, "ironworkers", () => undefined, arrival, ui, LANDMARKS);
  const expected = arrival("ironworkers", "car", roads, clear)!;
  assert.deepEqual(vehicle.player.toArray(), [expected.x, 0.12, expected.z]);
  assert.deepEqual(vehicle.vehicle!.state, {
    x: expected.x,
    z: expected.z,
    heading: expected.heading,
    speed: 0,
    vx: 0,
    vz: 0,
    steer: 0,
  });
  for (const [id, inCar] of [
    ["ironworkers", false],
    ["robson", true],
    ["canada-place", true],
  ] as const) {
    const other = game(inCar);
    travel.call(other, id, () => undefined, arrival, ui, LANDMARKS);
    assert.deepEqual(other.player.toArray(), [
      fallback.x,
      inCar ? 0.12 : 0,
      fallback.z,
    ]);
    if (inCar)
      assert.equal(
        (other.vehicle!.state as { heading: number }).heading,
        fallback.heading,
      );
  }
});
