import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import clipping from "polygon-clipping";
import {
  createCanadaPlaceSite,
  CANADA_PLACE_SERVICE_IDS,
} from "../src/world/canada-place-site";
import { FAIRMONT_APRON_DRIVEWAY_ID as ID } from "../src/world/fairmont-apron-site";
import { FAIRMONT_WATERFRONT_RING as hotel } from "../src/world/fairmont-waterfront-site";
import {
  KX,
  ORIGIN,
  centroid,
  segmentPoint,
  type CityData,
  type Point,
} from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";

const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData,
  ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
for (const b of data.buildings)
  b.pts = b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const site = createCanadaPlaceSite({
    roads: data.roads,
    buildings: data.buildings,
    westernHeight: () => 0,
  }),
  old = createCanadaPlaceSite({
    roads: data.roads.filter((r) => r.id !== ID),
    buildings: data.buildings,
    westernHeight: () => 0,
  }),
  apron = site.fairmontApron!;

test("mapped hotel driveway has both real junction heights and continuous bounded driving grade", () => {
  assert.ok(apron);
  assert.ok(Math.abs(apron.length - 61.29736) < 0.0001);
  assert.equal(CANADA_PLACE_SERVICE_IDS.has(ID), false);
  for (const other of ["w143682532", "w143682533", "w251863020"])
    assert.ok(CANADA_PLACE_SERVICE_IDS.has(other));
  assert.ok(site.roadIds.has(ID));
  assert.deepEqual(apron.driveway[0], [475.6, -502.8]);
  assert.deepEqual(apron.driveway.at(-1), [478.4, -443.5]);
  let maxGrade = 0;
  for (let i = 1; i < apron.driveway.length; i++) {
    const a = apron.driveway[i - 1],
      b = apron.driveway[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(length / 0.05);
    let previous = site.baselineHeight(...a)!;
    for (let j = 1; j <= n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n,
        h = site.baselineHeight(x, z);
      assert.ok(
        h !== undefined,
        "no unfilled zero-height holes on the source driveway",
      );
      maxGrade = Math.max(maxGrade, Math.abs(h - previous) / (length / n));
      previous = h;
    }
  }
  assert.ok(
    maxGrade < 0.16,
    `continuous estimated driveway maximum grade ${maxGrade}`,
  );
  for (const p of [apron.driveway[0], apron.driveway.at(-1)!])
    assert.equal(site.baselineHeight(...p), old.baselineHeight(...p));
  assert.ok(Math.abs(site.baselineHeight(...apron.driveway[0])! - 7.73) < 1e-8);
  assert.ok(
    Math.abs(site.baselineHeight(...apron.driveway.at(-1)!)! - 3.6931586683) <
      1e-8,
  );
});

test("apron reaches hotel wall, respects buildings and changes only bounded previously unsupported space", () => {
  let added = 0;
  for (let x = 455.17; x < 514; x += 0.7)
    for (let z = -512.23; z < -434; z += 0.7) {
      const before = old.baselineHeight(x, z),
        after = site.baselineHeight(x, z);
      if (before !== undefined)
        assert.equal(after, before, "existing Howe support is exact");
      if (!apron.contains(x, z))
        assert.equal(
          after,
          before,
          "outside the source-bounded apron is unchanged",
        );
      if (before === undefined && after !== undefined) added++;
    }
  assert.ok(added > 500);
  for (const b of data.buildings)
    assert.equal(site.baselineHeight(...centroid(b.pts)), undefined);
  for (let edge = 0; edge < 3; edge++) {
    const f = facadeFrame(hotel[edge], hotel[edge + 1]),
      limit = edge === 2 ? 0.39 : 0.98;
    for (let t = 0.02; t < limit; t += 0.03) {
      const p = f.p(t * f.length, 0, -0.045),
        h = site.baselineHeight(p[0], p[2]);
      assert.ok(
        h !== undefined && h > 3 && h < 7.8,
        "actual hotel contact is raised and supported",
      );
    }
  }
  for (const p of [
    [0, 0],
    [430, -550],
    [510, -460],
    [460, -520],
  ] as Point[])
    assert.equal(apron.covers(...p), false);
});

test("old/new support seams and new apron medial lines have no height jumps", () => {
  let samples = 0;
  for (let x = 465.13; x < 504; x += 0.43)
    for (let z = -502.17; z < -443.5; z += 0.47) {
      if (!apron.contains(x, z)) continue;
      const h = site.supportHeight(x, z);
      for (const [dx, dz] of [
        [0.001, 0],
        [0, 0.001],
      ])
        if (apron.contains(x + dx, z + dz)) {
          assert.ok(
            Math.abs(site.supportHeight(x + dx, z + dz) - h) < 0.00035,
            `height discontinuity at ${x},${z}`,
          );
          samples++;
        }
    }
  assert.ok(samples > 5000);
  for (const polygon of old.supportPolygons)
    for (const ring of [polygon.outer, ...polygon.holes])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let j = 0; j < n; j++) {
          const p: Point = [
            a[0] + ((b[0] - a[0]) * j) / n,
            a[1] + ((b[1] - a[1]) * j) / n,
          ];
          if (!apron.covers(...p)) continue;
          assert.ok(
            Math.abs(site.supportHeight(...p) - old.supportHeight(...p)) < 1e-6,
            "render boundary retains exact original height",
          );
        }
      }
});

test("render support is one union and boundary vertices use the same apron height", () => {
  const polygons = site.supportPolygons.map((p) => [p.outer, ...p.holes]);
  const area = (ring: Point[]) =>
      Math.abs(
        ring.reduce((s, a, i) => {
          const b = ring[(i + 1) % ring.length];
          return s + a[0] * b[1] - b[0] * a[1];
        }, 0) / 2,
      ),
    sum = (polys: Point[][][]) =>
      polys.reduce(
        (n, p) => n + area(p[0]) - p.slice(1).reduce((h, r) => h + area(r), 0),
        0,
      ),
    union = clipping.union(polygons[0], ...polygons.slice(1)) as Point[][][];
  assert.ok(
    Math.abs(sum(polygons) - sum(union)) < 1e-6,
    "no overlapping duplicated apron and original support",
  );
  let checked = 0;
  for (const p of site.supportPolygons)
    for (const ring of [p.outer, ...p.holes])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
        for (let j = 0; j < n; j++) {
          const q: Point = [
            a[0] + ((b[0] - a[0]) * j) / n,
            a[1] + ((b[1] - a[1]) * j) / n,
          ];
          if (!apron.covers(...q)) continue;
          assert.ok(
            Math.abs(site.supportHeight(...q) - apron.height(...q)) < 1e-8,
            "pointInPoly edge exclusion must not restore old unsupported datum",
          );
          checked++;
        }
      }
  assert.ok(checked > 10);
  assert.ok(Number.isFinite(sum(polygons)));
});
