import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LANDMARKS,
  roadWidth,
  type Road,
  type CityData,
} from "../src/world/data";
import {
  laneDividers,
  roadMarkings,
  crosswalkMarkings,
  drivingOffset,
  reverseRoad,
  sidewalkSides,
} from "../src/world/road-profile";
import { CollisionWorld } from "../src/world/collision";

test("separate one-way carriageways use their own lane width and white dividers", () => {
  const road: Road = {
    kind: "primary",
    sourceKind: "trunk",
    oneway: true,
    lanes: 2,
    pts: [0, 0, 100, 0],
  };
  assert.equal(roadWidth(road), 7);
  assert.deepEqual(laneDividers(road), [{ offset: 0, yellow: false }]);
  assert.ok(drivingOffset(road) + 1.1 < roadWidth(road) / 2);
  const narrow = { ...road, lanes: 1 };
  assert.equal(laneDividers(narrow).length, 0);
  assert.equal(drivingOffset(narrow), 0);
});

test("unequal directions move the yellow divider to the mapped lane boundary", () => {
  const road: Road = {
    kind: "primary",
    lanes: 6,
    lanesForward: 2,
    lanesBackward: 4,
    pts: [0, 0, 100, 0],
  };
  const dividers = laneDividers(road),
    yellow = dividers.filter((x) => x.yellow);
  assert.equal(dividers.length, 5);
  assert.equal(yellow.length, 1);
  assert.ok(Math.abs(yellow[0].offset - 3.2) < 1e-6);
});

test("reversing a two-way route swaps lane counts and sidewalk sides without mutating the map", () => {
  const road: Road = {
    kind: "primary",
    lanes: 3,
    lanesForward: 2,
    lanesBackward: 1,
    sidewalk: "left",
    pts: [0, 0, 10, 20, 30, 40],
  };
  const back = reverseRoad(road);
  assert.deepEqual(back.pts, [30, 40, 10, 20, 0, 0]);
  assert.equal(back.lanesForward, 1);
  assert.equal(back.lanesBackward, 2);
  assert.deepEqual(sidewalkSides(back), [1]);
  assert.deepEqual(sidewalkSides(road), [-1]);
  assert.deepEqual(road.pts, [0, 0, 10, 20, 30, 40]);
});

test("street furniture clearance includes neighbouring carriageways and intersections", () => {
  const roads: Road[] = [
    { kind: "primary", lanes: 2, pts: [0, 0, 100, 0] },
    { kind: "primary", lanes: 2, pts: [0, -8, 100, -8] },
    { kind: "tertiary", lanes: 2, pts: [50, -40, 50, 40] },
  ];
  const collision = new CollisionWorld({
    roads,
    buildings: [],
    areas: [],
    trees: [],
    ocean: [],
    pois: [],
    meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
  } satisfies CityData);
  assert.equal(collision.onStreet(20, -4.9), true);
  assert.equal(collision.onStreet(50, 5), true);
  assert.equal(collision.onStreet(20, 5), false);
});

test("committed Vancouver roads retain actual lane tags and omit indoor/tunnel ways", () => {
  const data = JSON.parse(
    fs.readFileSync(
      new URL("../public/data/vancouver-roads.json", import.meta.url),
      "utf8",
    ),
  );
  const roads = data.roads as Road[];
  assert.ok(roads.length > 20000);
  assert.equal(new Set(roads.map((r) => r.id)).size, roads.length);
  const causeway = roads.filter(
    (r) => r.name === "Stanley Park Causeway" && r.oneway && r.lanes === 2,
  );
  assert.ok(causeway.length > 0);
  assert.ok(
    causeway.every(
      (r) => roadWidth(r) === 7 && !r.foot && r.sidewalk === "none",
    ),
  );
  assert.ok(
    roads.some(
      (r) => r.name === "Stanley Park Drive" && r.oneway && r.lanes === 1,
    ),
  );
  assert.ok(
    roads.every(
      (r) =>
        !["corridor", "elevator", "construction", "proposed"].includes(
          r.sourceKind!,
        ),
    ),
  );
  assert.ok(
    roads.every((r) => r.pts.length >= 4 && r.pts.every(Number.isFinite)),
  );
});

test("white dashes retain phase across densely sampled road nodes", () => {
  const road: Road = {
    kind: "primary",
    oneway: true,
    lanes: 2,
    pts: Array.from({ length: 11 }, (_, i) => [i * 2, 0]).flat(),
  };
  const segments = [...roadMarkings(road)];
  const painted = segments.reduce(
    (sum, s) => sum + Math.hypot(s.pts[2] - s.pts[0], s.pts[3] - s.pts[1]),
    0,
  );
  assert.ok(Math.abs(painted - 7) < 1e-6);
  assert.ok(segments.some((s) => s.pts[0] === 3));
  assert.ok(segments.some((s) => s.pts[0] === 12));
  assert.ok(segments.every((s) => !s.yellow && s.pts.every(Number.isFinite)));
});

test("crosswalk paint follows mapped marking styles and leaves unmarked crossings bare", () => {
  const road: Road = { kind: "footway", crossing: true, pts: [0, 0, 10, 0] };
  assert.equal(
    [...crosswalkMarkings({ ...road, crossingMarkings: "no" })].length,
    0,
  );
  assert.equal([...crosswalkMarkings(road)].length, 0);
  const lines = [...crosswalkMarkings({ ...road, crossingMarkings: "lines" })];
  assert.equal(lines.length, 2);
  assert.ok(lines.every((s) => s.pts[0] === 0 && s.pts[2] === 10));
  const zebra = [...crosswalkMarkings({ ...road, crossingMarkings: "zebra" })];
  assert.ok(zebra.length >= 8);
  assert.ok(
    zebra.every(
      (s) => s.pts[0] === s.pts[2] && Math.abs(s.pts[3] - s.pts[1]) === 2.8,
    ),
  );
});

test("Ironworkers arrival selects the northbound bridge approach", () => {
  const data = JSON.parse(
    fs.readFileSync(
      new URL("../public/data/vancouver-roads.json", import.meta.url),
      "utf8",
    ),
  );
  const collision = new CollisionWorld({
    roads: data.roads,
    buildings: [],
    areas: [],
    trees: [],
    ocean: [],
    pois: [],
    meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
  });
  const spawn = LANDMARKS.find((l) => l.id === "ironworkers")!.spawn;
  const road = collision.nearestRoad(...spawn, 30)!;
  assert.equal(road.road.oneway, true);
  assert.ok(Math.cos(road.heading) < -0.8);
  assert.ok(road.d < 3);
});
