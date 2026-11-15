import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCanadaPlaceSite,
  canadaPlaceHoweProfile,
  CANADA_PLACE_BASE_HEIGHT,
  CANADA_PLACE_DECK_HEIGHT,
} from "../src/world/canada-place-site";
import {
  KX,
  ORIGIN,
  centroid,
  type CityData,
  type Point,
} from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
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
// Explicit pre-Canada fields; do not recurse through CollisionWorld.groundHeight
// after the parent integrates this helper.
import { jackGroundHeight } from "../src/world/jack-poole-site";
import {
  conventionDeckHeight,
  conventionApproachHeight,
} from "../src/world/convention-site";
const collision = new CollisionWorld(data);
const oldHeight = (x: number, z: number) =>
  jackGroundHeight(x, z) ??
  conventionDeckHeight(collision.convention, x, z) ??
  conventionApproachHeight(collision.convention, x, z) ??
  0;
const site = createCanadaPlaceSite({
  roads: data.roads,
  buildings: data.buildings,
  westernHeight: oldHeight,
});
function at(path: Point[], distance: number): Point {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance <= l)
      return [
        a[0] + ((b[0] - a[0]) * distance) / l,
        a[1] + ((b[1] - a[1]) * distance) / l,
      ];
    distance -= l;
  }
  return path.at(-1)!;
}
test("mapped Howe grade keeps the H16 to H15.4 near-level section, shared junctions and smooth slope", () => {
  assert.ok(Math.abs(site.howeLength - 115.8) < 0.2);
  // docs/sources/howe-shared-ground-and-station.md registers finished H−7.52,
  // with 0.15m paving above this baseline. These are approximate source levels,
  // not the superseded zero-to-deck ramp. Runtime also shares its terrain field
  // with the adjoining streets; this fixture tests the standalone site profile.
  const southBaseline = 8.33;
  assert.ok(Math.abs(site.baselineHeight(443.7, -400)! - southBaseline) < 1e-9);
  assert.ok(
    Math.abs(canadaPlaceHoweProfile(0, site.howeLength) - southBaseline) < 1e-9,
  );
  assert.ok(
    Math.abs(
      canadaPlaceHoweProfile(site.howeLength, site.howeLength) -
        CANADA_PLACE_BASE_HEIGHT,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      site.baselineHeight(496.3, -492.2)! + 0.15 - CANADA_PLACE_DECK_HEIGHT,
    ) < 1e-9,
  );
  let previous = southBaseline;
  for (let s = 0.1; s <= site.howeLength; s += 0.1) {
    const h = canadaPlaceHoweProfile(s, site.howeLength);
    assert.ok(h <= previous + 1e-12, `unexpected uphill reversal at ${s}m`);
    assert.ok(h >= CANADA_PLACE_BASE_HEIGHT - 1e-12);
    assert.ok(Math.abs(h - previous) / 0.1 < 0.02, `grade exceeds 2% at ${s}m`);
    previous = h;
  }
  // Check the actual constant-to-eased-profile joins, including both clamps.
  for (const s of [0, site.howeLength * 0.54, site.howeLength]) {
    const l =
      (canadaPlaceHoweProfile(s, site.howeLength) -
        canadaPlaceHoweProfile(s - 0.01, site.howeLength)) /
      0.01;
    const r =
      (canadaPlaceHoweProfile(s + 0.01, site.howeLength) -
        canadaPlaceHoweProfile(s, site.howeLength)) /
      0.01;
    assert.ok(Math.abs(l - r) < 0.0001);
  }
  let station = 0;
  for (let i = 1; i < site.howePath.length - 1; i++) {
    station += Math.hypot(
      site.howePath[i][0] - site.howePath[i - 1][0],
      site.howePath[i][1] - site.howePath[i - 1][1],
    );
    assert.ok(
      Math.abs(
        site.supportHeight(...at(site.howePath, station - 0.05)) -
          site.supportHeight(...at(site.howePath, station + 0.05)),
      ) < 0.01,
    );
  }
});
test("western tie matches full existing end cross-section and preserves the deck-entry landing", () => {
  assert.ok(Math.abs(site.waterfrontLength - 187) < 0.2);
  for (let s = 0; s <= 100; s += 0.25)
    assert.ok(
      Math.abs(
        site.supportHeight(...at(site.waterfrontPath, s)) -
          CANADA_PLACE_BASE_HEIGHT,
      ) < 1e-8,
    );
  const end = site.waterfrontPath.at(-1)!,
    prev = site.waterfrontPath.at(-2)!,
    dx = end[0] - prev[0],
    dz = end[1] - prev[1],
    l = Math.hypot(dx, dz);
  for (let cross = -8; cross <= 8; cross += 0.25) {
    const x = end[0] + (cross * dz) / l,
      z = end[1] - (cross * dx) / l;
    assert.ok(Math.abs(site.supportHeight(x, z) - oldHeight(x, z)) < 1e-8);
    assert.ok(
      Math.abs(
        site.supportHeight(x - (dx / l) * 0.05, z - (dz / l) * 0.05) -
          oldHeight(x - (dx / l) * 0.05, z - (dz / l) * 0.05),
      ) < 0.001,
    );
  }
});
test("coverage excludes building interiors and unrelated city while retaining road support", () => {
  for (const b of data.buildings)
    assert.equal(
      site.baselineHeight(...centroid(b.pts)),
      undefined,
      `building centroid ${b.id}`,
    );
  for (const p of [
    [0, 0],
    [470, -370],
    [279, -517],
    [-81, -798],
    [650, -650],
  ] as Point[])
    assert.equal(site.baselineHeight(...p), undefined);
  assert.ok(site.contains(486.65, -453.35));
  assert.ok(site.intersects([400, -450, 550, -450]));
  assert.equal(site.intersects([-100, 0, 100, 0]), false);
  assert.equal(site.baselineHeight(NaN, 0), undefined);
  for (const p of site.supportPolygons)
    for (const ring of [p.outer, ...p.holes])
      for (const q of ring)
        assert.ok(Number.isFinite(site.supportHeight(...q)));
});
test("Howe-only mode refuses to invent an unmatched western datum", () => {
  const narrow = createCanadaPlaceSite({
    roads: data.roads,
    buildings: data.buildings,
  });
  assert.equal(narrow.westernTieEnabled, false);
  assert.equal(narrow.baselineHeight(427.8, -525.6), undefined);
  assert.ok(narrow.contains(486.65, -453.35));
});
test("explicit entry support fills only the outside-deck gap and preserves clipped holes", () => {
  const connector: Point[] = [
    [425, -525],
    [435, -525],
    [435, -542],
    [425, -542],
  ];
  const pier: Point[] = [
    [400, -535],
    [450, -535],
    [450, -560],
    [400, -560],
  ];
  const hole: Point[] = [
    [428, -530],
    [432, -530],
    [432, -533],
    [428, -533],
  ];
  const connected = createCanadaPlaceSite({
    roads: data.roads,
    buildings: [...data.buildings, { id: "entry-obstacle", pts: hole.flat() }],
    westernHeight: oldHeight,
    connectors: [connector],
    existingDeck: pier,
  });
  assert.equal(connected.baselineHeight(430, -534), CANADA_PLACE_BASE_HEIGHT);
  assert.equal(
    connected.baselineHeight(430, -539),
    undefined,
    "existing pier belongs to deck helper",
  );
  assert.equal(
    connected.baselineHeight(430, -531),
    undefined,
    "solid inside connector must remain excluded",
  );
  assert.ok(connected.supportPolygons.some((p) => p.holes.length > 0));
  const area = (p: Point[]) =>
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2;
  for (const p of connected.supportPolygons) {
    assert.ok(area(p.outer) > 0);
    for (const h of p.holes) assert.ok(area(h) < 0);
  }
});
test("inside Howe corner has no nearest-route height discontinuity", () => {
  for (let x = 490; x < 506; x += 0.25)
    for (let z = -490; z < -468; z += 0.25) {
      const h = site.supportHeight(x, z);
      for (const [dx, dz] of [
        [0.001, 0],
        [0, 0.001],
      ])
        assert.ok(
          Math.abs(site.supportHeight(x + dx, z + dz) - h) < 0.001,
          `corner jump at ${x},${z}`,
        );
    }
});
