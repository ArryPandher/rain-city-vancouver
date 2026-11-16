import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import { loadCity } from "./helpers/full-city-data";
import {
  galleryStairLocal,
  galleryStairWorld,
} from "../src/world/gallery-stair-framing-data";
import { roadWidth, segmentPoint } from "../src/world/data";
import {
  createRobsonPedestrianCircuit,
  robsonPedestrianPoint,
  robsonPedestrianHeight,
  robsonPedestrianAssignment,
  advanceRobsonPedestrian,
  findRobsonPedestrianSpawn,
  ROBSON_PEDESTRIAN_SLOTS,
} from "../src/game/robson-pedestrians";
import {
  PEDESTRIAN_POOL_LIMIT,
  CANADA_PEDESTRIAN_SLOTS,
} from "../src/game/canada-place-pedestrians";
import { HOWE_PEDESTRIAN_SLOTS } from "../src/game/howe-pedestrians";
import { shortenChaseBoom } from "../src/game/chase-camera";
import * as T from "three";
const original = globalThis.fetch;
let ground: CollisionWorld;
try {
  globalThis.fetch = async (input) =>
    new Response(new Uint8Array(fs.readFileSync(`public${input}`)));
  ground = new CollisionWorld(await loadCity());
} finally {
  globalThis.fetch = original;
}
const c = createRobsonPedestrianCircuit(ground)!;
const state = { distance: 3, pace: 1.16, panic: 0, down: 0 };
const altered = (
  overrides: Partial<Parameters<typeof createRobsonPedestrianCircuit>[0]>,
) => Object.assign(Object.create(ground), overrides);

test("three reused slots fit the existing pool; full circuit is on actual public footway and current complete city support", (t) => {
  assert.ok(c, "actual current public route must preflight");
  assert.equal(c.road.id, "w749560067");
  assert.equal(ROBSON_PEDESTRIAN_SLOTS, 3);
  assert.equal(
    PEDESTRIAN_POOL_LIMIT -
      CANADA_PEDESTRIAN_SLOTS -
      HOWE_PEDESTRIAN_SLOTS -
      ROBSON_PEDESTRIAN_SLOTS,
    22,
  );
  assert.ok(c.length > 26.9 && c.length < 27.1);
  const before = JSON.stringify(ground.data.roads);
  let samples = 0;
  for (let d = 0; d < c.length; d += 0.1) {
    const p = robsonPedestrianPoint(c, d),
      y = robsonPedestrianHeight(ground, p),
      [u, v] = galleryStairLocal(p.x, p.z);
    assert.ok(v >= 36.51 && v <= 49.49 && Math.abs(u) < 0.8);
    assert.equal(y, 0);
    assert.equal(ground.blocked(p.x, p.z, 0.4, y), false);
    assert.equal(ground.water(p.x, p.z, y), false);
    let nearest = Infinity;
    for (let i = 0; i < c.road.pts.length - 2; i += 2)
      nearest = Math.min(
        nearest,
        segmentPoint(
          p.x,
          p.z,
          ...(c.road.pts.slice(i, i + 4) as [number, number, number, number]),
        ).d,
      );
    assert.ok(nearest + 0.4 <= roadWidth(c.road) / 2);
    for (const r of ground.data.roads.filter((r) =>
      [
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "unclassified",
        "service",
      ].includes(r.kind),
    ))
      for (let i = 0; i < r.pts.length - 2; i += 2)
        assert.ok(
          segmentPoint(
            p.x,
            p.z,
            ...(r.pts.slice(i, i + 4) as [number, number, number, number]),
          ).d >=
            roadWidth(r) / 2 + 0.4,
          `road ${r.id}`,
        );
    const n = advanceRobsonPedestrian(
      c,
      { ...state, distance: d },
      0.1,
      ground,
      [],
      [],
    );
    assert.ok(n.speed > 0 && Number.isFinite(n.heading));
    assert.ok(Math.hypot(n.x - p.x, n.z - p.z) <= 0.116001);
    assert.ok(
      Math.abs(n.speed - Math.hypot(n.x - p.x, n.z - p.z) / 0.1) < 1e-8,
    );
    samples++;
  }
  assert.equal(JSON.stringify(ground.data.roads), before);
  assert.ok(
    Math.hypot(
      robsonPedestrianPoint(c, -0.001).x - c.points[0].x,
      robsonPedestrianPoint(c, -0.001).z - c.points[0].z,
    ) < 0.00101,
  );
  t.diagnostic(
    `${samples} body/support samples; ${c.length.toFixed(3)}m loop; ground y0; source road unchanged`,
  );
});

test("closed source and changed ground fail preflight; no invented fallback or elevated snapping", () => {
  assert.equal(
    createRobsonPedestrianCircuit(altered({ gallery: false })),
    null,
  );
  assert.equal(
    createRobsonPedestrianCircuit(
      altered({
        data: {
          ...ground.data,
          roads: ground.data.roads.filter((r) => r.id !== c.road.id),
        },
      }),
    ),
    null,
  );
  for (const replacement of [
    { ...c.road, foot: false },
    { ...c.road, width: 1.5 },
    { ...c.road, pts: c.road.pts.map((n) => n + 100) },
  ])
    assert.equal(
      createRobsonPedestrianCircuit(
        altered({ data: { ...ground.data, roads: [replacement] } }),
      ),
      null,
    );
  for (const overrides of [
    { blocked: () => true },
    { water: () => true },
    { walkingHeight: () => 3.28 },
    { walkingHeight: () => NaN },
  ])
    assert.equal(createRobsonPedestrianCircuit(altered(overrides)), null);
  assert.equal(robsonPedestrianAssignment(c, 3), undefined);
});

test("walkers yield to actual bodies and finite car/bike capsules, resume, and report zero animation speed while down or blocked", () => {
  const p = robsonPedestrianPoint(c, state.distance),
    y = robsonPedestrianHeight(ground, p),
    body = { ...p, y, radius: 0.4, height: 1.8 };
  const moving = advanceRobsonPedestrian(c, state, 0.1, ground, [], []);
  assert.ok(moving.speed > 1);
  assert.equal(
    advanceRobsonPedestrian(c, state, 0.1, ground, [body], []).speed,
    0,
  );
  assert.ok(
    advanceRobsonPedestrian(c, state, 0.1, ground, [{ ...body, y: 4 }], [])
      .speed > 0,
  );
  for (const kind of ["car", "bike"] as const)
    assert.equal(
      advanceRobsonPedestrian(
        c,
        state,
        0.1,
        ground,
        [],
        [{ ...p, y, kind, speed: 0 }],
      ).speed,
      0,
    );
  for (const bad of [
    { ...state, down: 2 },
    { ...state, pace: NaN },
  ])
    assert.equal(advanceRobsonPedestrian(c, bad, 0.1, ground, [], []).speed, 0);
  for (const dt of [0, 1, NaN])
    assert.equal(
      advanceRobsonPedestrian(c, state, dt, ground, [], []).speed,
      0,
    );
  assert.equal(
    advanceRobsonPedestrian(
      c,
      state,
      0.1,
      altered({ blocked: () => true }),
      [],
      [],
    ).speed,
    0,
  );
  const spawn = findRobsonPedestrianSpawn(
    c,
    state.distance,
    ground,
    [body],
    [],
  );
  assert.ok(spawn !== undefined && spawn !== state.distance);
  assert.equal(
    findRobsonPedestrianSpawn(
      c,
      state.distance,
      ground,
      [{ ...body, radius: 100 }],
      [],
    ),
    undefined,
  );
});

test("three phased walkers complete two laps without mutual deadlock; ordinary arrival/stair-mouth route and chase remain open", () => {
  const states = Array.from({ length: 3 }, (_, i) => ({
    ...robsonPedestrianAssignment(c, i)!,
    panic: 0,
    down: 0,
  }));
  const travelled = [0, 0, 0];
  for (let frame = 0; frame < 600; frame++) {
    const poses = states.map((s) => {
      const p = robsonPedestrianPoint(c, s.distance);
      return {
        ...p,
        y: robsonPedestrianHeight(ground, p),
        radius: 0.4,
        height: 1.8,
      };
    });
    for (let i = 0; i < 3; i++) {
      const next = advanceRobsonPedestrian(
        c,
        states[i],
        0.1,
        ground,
        poses.filter((_, j) => j !== i),
        [],
      );
      states[i].distance = next.distance;
      travelled[i] += next.speed * 0.1;
    }
  }
  assert.ok(
    travelled.every((d) => d > c.length * 2),
    `travelled ${travelled}`,
  );
  for (let v = 51.3; v >= 33.45; v -= 0.1) {
    const [x, z] = galleryStairWorld(0.8, v);
    assert.equal(ground.blocked(x, z, 0.36, 0), false);
    const [bx, bz] = galleryStairWorld(0.8, v + 4.3),
      focus = new T.Vector3(x, 1.6, z),
      desired = new T.Vector3(bx, 2.2, bz);
    assert.ok(
      shortenChaseBoom(focus, desired, (p) =>
        ground.cameraBlocked(p.x, p.z, 0.25, p.y),
      ) > 0.95,
    );
  }
});
