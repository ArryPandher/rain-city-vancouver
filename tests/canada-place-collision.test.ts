import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  centroid,
  type CityData,
  type Point,
} from "../src/world/data";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_DECK_Y,
  CANADA_PLACE_SOLID_MASSES,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_HOWE_IDS,
  CANADA_PLACE_WATERFRONT_IDS,
  CANADA_PLACE_SERVICE_IDS,
} from "../src/world/canada-place-site";
function loadCity() {
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
  return data;
}
const data = loadCity(),
  collision = new CollisionWorld(data);
test("unresolved service ribbons retain their prior datum without false steep ramps", () => {
  for (const id of CANADA_PLACE_SERVICE_IDS) {
    const road = data.roads.find((r) => r.id === id)!;
    assert.ok(road, id);
    for (const [x, z] of samples(flatPoints(road.pts)))
      assert.equal(
        collision.roadHeight(road, x, z),
        collision.existingGroundHeight(x, z),
      );
  }
});
const flatPoints = (p: number[]): Point[] =>
  Array.from({ length: p.length / 2 }, (_, i) => [p[2 * i], p[2 * i + 1]]);
function samples(path: Point[], spacing = 0.25) {
  return path.flatMap((a, i) => {
    if (!i) return [a];
    const b = path[i - 1],
      n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / spacing);
    return Array.from(
      { length: n },
      (_, j): Point => [
        b[0] + ((a[0] - b[0]) * (j + 1)) / n,
        b[1] + ((a[1] - b[1]) * (j + 1)) / n,
      ],
    );
  });
}
const location = (x: number, z: number, h: number) =>
  `(${x.toFixed(3)},${h.toFixed(3)},${z.toFixed(3)})`;
test("ordinary Howe arrival reaches the Canadian Trail with continuous supported foot clearance", () => {
  const route: Point[] = [];
  for (const id of [...CANADA_PLACE_HOWE_IDS, CANADA_PLACE_WATERFRONT_IDS[0]]) {
    const p = flatPoints(data.roads.find((r) => r.id === id)!.pts);
    route.push(...(route.length ? p.slice(1) : p));
  }
  route.push([430, -531], [430, -541.04], ...CANADA_PLACE_DECK_ROUTE);
  let previousHeight = 0,
    previous: Point | undefined;
  for (const [x, z] of samples(route)) {
    const h = collision.groundHeight(x, z),
      label = location(x, z, h);
    assert.ok(Number.isFinite(h), `nonfinite ground at ${label}`);
    assert.equal(
      collision.blocked(x, z, 0.36, h + 0.15),
      false,
      `blocked public route at ${label}`,
    );
    assert.equal(
      collision.water(x, z, h + 0.15),
      false,
      `water on supported route at ${label}`,
    );
    if (previous) {
      const distance = Math.hypot(x - previous[0], z - previous[1]);
      // Existing finish offsets allow a small curb/deck change, not a vertical lift.
      assert.ok(
        Math.abs(h - previousHeight) <= distance * 0.12 + 0.16,
        `unsupported height step at ${label}: previous ${previousHeight}`,
      );
    }
    previous = [x, z];
    previousHeight = h;
  }
  assert.ok(Math.abs(previousHeight - CANADA_PLACE_DECK_Y) < 1e-6);
});
test("deck clearance does not open the solid lower pier or enclosed landmark masses", () => {
  const [x, z] = CANADA_PLACE_DECK_ROUTE[3];
  assert.equal(
    collision.blocked(x, z, 0.36, 0),
    true,
    "same public-deck point remains solid below the pier",
  );
  assert.equal(collision.blocked(x, z, 0.36, CANADA_PLACE_DECK_Y), false);
  for (const p of CANADA_PLACE_SOLID_MASSES) {
    const q = centroid(p);
    assert.equal(
      collision.blocked(...q, 0.36, CANADA_PLACE_DECK_Y),
      true,
      `enclosed mass opened at ${q}`,
    );
  }
  assert.equal(
    collision.water(1000, -1000, 0),
    true,
    "open harbour remains water",
  );
});
test("site integration leaves neighboring building bases and empty worlds unchanged", () => {
  for (const id of ["w363651936", "w138256216", "w208599553", "w143683980"]) {
    const b = data.buildings.find((b) => b.id === id)!;
    assert.equal(
      collision.groundHeight(...centroid(b.pts)),
      0,
      `unrelated building base lifted: ${id}`,
    );
  }
  const empty = new CollisionWorld({
    ...data,
    buildings: [],
    roads: [],
    areas: [],
    ocean: [],
  });
  for (const q of [
    [0, 0],
    [430, -541],
    [486.65, -453.35],
  ] as Point[]) {
    assert.equal(empty.groundHeight(...q), 0);
    assert.equal(empty.blocked(...q, 0.36, 0), false);
    assert.equal(empty.water(...q, 0), false);
  }
});
test("western integration matches existing ground across its entire road end", () => {
  const oldData = loadCity();
  oldData.buildings = oldData.buildings.filter((b) => b.id !== "w223635729");
  const old = new CollisionWorld(oldData);
  const end: Point = [325.5, -568.2],
    dx = -11,
    dz = -4.8,
    l = Math.hypot(dx, dz);
  for (let side = -8; side <= 8; side += 0.25) {
    const x = end[0] + (dz / l) * side,
      z = end[1] - (dx / l) * side;
    assert.ok(
      Math.abs(collision.groundHeight(x, z) - old.groundHeight(x, z)) < 1e-6,
      `western end mismatch ${x},${z}`,
    );
    const xx = x - (dx / l) * 0.05,
      zz = z - (dz / l) * 0.05;
    assert.ok(
      Math.abs(collision.groundHeight(xx, zz) - old.groundHeight(xx, zz)) <
        0.001,
      `western near-edge mismatch ${xx},${zz}`,
    );
  }
});
test("retaining side entry cannot lift a ground-level actor onto the raised street", () => {
  const from: Point = [484.2239858005012, -488.118207470961],
    to: Point = [484.6066692328663, -489.0420870034724];
  assert.equal(collision.groundHeight(...from), 0);
  assert.ok(collision.groundHeight(...to) > 7);
  const moved = collision.move(
    ...from,
    to[0] - from[0],
    to[1] - from[1],
    0.36,
    0,
  );
  assert.equal(moved.hit, true);
  assert.ok(collision.groundHeight(moved.x, moved.z) < 0.5);
  for (const radius of [0.36, 1.16]) {
    const road = data.roads.find((r) => r.id === CANADA_PLACE_HOWE_IDS[0])!;
    const path = samples(flatPoints(road.pts), 0.2);
    let q = path[0];
    for (const p of path.slice(1)) {
      const result = collision.move(
        ...q,
        p[0] - q[0],
        p[1] - q[1],
        radius,
        collision.groundHeight(...q),
      );
      assert.equal(
        result.hit,
        false,
        `ordinary uphill motion rejected radius${radius} at${p}`,
      );
      assert.ok(Math.hypot(result.x - p[0], result.z - p[1]) < 1e-8);
      q = p;
    }
  }
});
test("vehicle exit chooses supported height instead of the seven-metre roadside drop", () => {
  const x = 477.852,
    z = -493.061,
    heading = 4.182,
    y = 7.73;
  const preferred: Point = [
    x + Math.cos(heading) * 2.3,
    z - Math.sin(heading) * 2.3,
  ];
  assert.ok(collision.groundHeight(...preferred) < 1);
  const exit = collision.vehicleExit(x, z, heading, y);
  assert.ok(exit, "opposite door should have a supported landing");
  assert.ok(Math.abs(collision.groundHeight(...exit) - y) < 0.6);
  assert.ok(Math.hypot(exit[0] - preferred[0], exit[1] - preferred[1]) > 1);
  assert.equal(collision.blocked(...exit, 0.4, y), false);
  const flat = new CollisionWorld({
    ...data,
    buildings: [],
    roads: [],
    areas: [],
    ocean: [],
  });
  assert.deepEqual(flat.vehicleExit(0, 0, 0, 0), [2.3, 0]);
  const room = new CollisionWorld({
    ...data,
    roads: [],
    areas: [],
    ocean: [],
    buildings: [
      { id: "closed-test-room", pts: [-10, -10, 10, -10, 10, 10, -10, 10] },
    ],
  });
  assert.equal(room.vehicleExit(0, 0, 0, 0), undefined);
});
