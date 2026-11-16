import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import clipping, { type MultiPolygon, type Polygon } from "polygon-clipping";
import { buildingsOverlappingPolygon } from "../src/world/local-building-broadphase";
import { CollisionWorld } from "../src/world/collision";
import { type Building, type Point } from "../src/world/data";
import { loadCity } from "./helpers/full-city-data";
import golden from "./fixtures/canada-local-cuts-unfiltered.json";

const polygon = (b: Building): Polygon => [
  Array.from({ length: b.pts.length / 2 }, (_, i) => [
    b.pts[i * 2],
    b.pts[i * 2 + 1],
  ]),
];
const subjectPoints = (subject: Polygon | MultiPolygon): Point[] =>
  (typeof subject[0][0][0] === "number"
    ? subject.flat()
    : subject.flat(2)) as Point[];
const building = (id: string, pts: number[]): Building => ({ id, pts });

test("conservative envelopes preserve containing/crossing/touching/concave source polygons in source order", () => {
  const subject: Polygon = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
  ];
  const data = [
    building("far", [30, 30, 40, 30, 40, 40, 30, 40]),
    building("encloses", [-2, -2, 12, -2, 12, 12, -2, 12]),
    building("crosses-no-inside-vertices", [-5, 4, 15, 4, 15, 6, -5, 6]),
    building("touches-edge", [10, 2, 13, 2, 13, 8, 10, 8]),
    building("touches-corner", [10, 10, 13, 10, 13, 13, 10, 13]),
    building("near-rounding", [10 + 1e-8, 2, 13, 2, 13, 8, 10 + 1e-8, 8]),
    building(
      "concave-miss-retained",
      [8, 12, 8, 14, 14, 14, 14, 8, 12, 8, 12, 12],
    ),
  ];
  const original = JSON.stringify(data);
  const selected = buildingsOverlappingPolygon(data, subject[0]);
  assert.deepEqual(
    selected.map((b) => b.id),
    data.slice(1).map((b) => b.id),
  );
  for (let i = 0; i < selected.length; i++)
    assert.equal(selected[i], data[i + 1]);
  assert.equal(JSON.stringify(data), original);
  assert.deepEqual(
    clipping.difference(subject, ...selected.map(polygon)),
    clipping.difference(subject, ...data.map(polygon)),
  );
  assert.deepEqual(buildingsOverlappingPolygon(data, []), []);
  assert.deepEqual(
    buildingsOverlappingPolygon(data, [[NaN, 0]]),
    data,
    "invalid bounds fail open",
  );
  // No cached old envelope can conceal later edits to a source footprint.
  data[0].pts = [3, 3, 4, 3, 4, 4, 3, 4];
  assert.equal(buildingsOverlappingPolygon(data, subject[0])[0], data[0]);
});

test("all nine full-city local cuts and final constructor support exactly match the unfiltered baseline", async () => {
  const oldFetch = globalThis.fetch;
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
    globalThis.fetch = oldFetch;
  }
  assert.equal(data.buildings.length, golden.buildingCount);
  assert.equal(data.roads.length, golden.roadsCount);
  assert.ok(data.terrain && data.seawall && data.publicTrees);
  assert.equal(golden.cuts.length, 9);
  for (const [i, cut] of golden.cuts.entries()) {
    const source = data.buildings.filter(
      (b) => !(cut.excludedIds as string[]).includes(b.id),
    );
    const selected = buildingsOverlappingPolygon(
      source,
      subjectPoints(cut.subject as Polygon | MultiPolygon),
    );
    assert.ok(
      selected.length < 30,
      `cut ${i}: bounded inputs ${selected.length}`,
    );
    const result = clipping.difference(
      cut.subject as Polygon | MultiPolygon,
      ...selected.map(polygon),
      ...(cut.extraCuts as Polygon[]),
    );
    assert.deepEqual(
      result,
      cut.result,
      `cut ${i}: exact source polygon coordinates, winding and holes`,
    );
  }
  // Run the real installed hooks, not only the broadphase helper.
  const oldDifference = clipping.difference;
  let largestInput = 0;
  clipping.difference = function (subject, ...cuts) {
    largestInput = Math.max(largestInput, cuts.length);
    return oldDifference(subject, ...cuts);
  };
  let collision;
  try {
    collision = new CollisionWorld(data);
  } finally {
    clipping.difference = oldDifference;
  }
  assert.ok(
    largestInput < 100,
    `no full-city boolean input remains: ${largestInput}`,
  );
  const site = collision.canada!;
  assert.deepEqual(site.supportPolygons, golden.supportPolygons);
  assert.deepEqual(site.fairmontApron!.supportPolygons, golden.fairmont);
  assert.deepEqual(site.pwcApron!.supportPolygons, golden.pwc);
  for (const { x, z, contains, height } of golden.samples) {
    assert.equal(site.contains(x, z), contains);
    assert.equal(site.supportHeight(x, z), height, `exact ground at ${x},${z}`);
  }
});
