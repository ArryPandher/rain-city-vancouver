import { canadaPlaceGuardSegments } from "../src/world/canada-place-guards";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { createCanadaPlaceSite } from "../src/world/canada-place-site";
import {
  canadaPlaceApproachGeometry,
  buildCanadaPlaceApproach,
} from "../src/world/canada-place-approach";
import {
  CANADA_PLACE_PIER,
  CANADA_PLACE_ENTRY_CONNECTOR,
} from "../src/world/canada-place-deck";
import {
  ORIGIN,
  KX,
  pointInPoly,
  type CityData,
  type Point,
} from "../src/world/data";
import type { Materials } from "../src/world/materials";
const data = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
) as CityData;
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
data.buildings = data.buildings.map((b) => ({
  ...b,
  pts: b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
}));
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const points = (p: number[]): Point[] =>
  Array.from({ length: p.length / 2 }, (_, i) => [p[i * 2], p[i * 2 + 1]]);
const site = createCanadaPlaceSite({
  roads: data.roads,
  buildings: data.buildings,
  westernHeight: () => 5,
  connectors: [points(CANADA_PLACE_ENTRY_CONNECTOR)],
  existingDeck: points(CANADA_PLACE_PIER),
});
const parts = canadaPlaceApproachGeometry(data, site, () => 0);
const mesh = new T.Mesh(
  parts.pavement,
  new T.MeshBasicMaterial({ side: T.DoubleSide }),
);
mesh.updateMatrixWorld(true);
const cast = (x: number, z: number) =>
  new T.Raycaster(
    new T.Vector3(x, 20, z),
    new T.Vector3(0, -1, 0),
  ).intersectObject(mesh);
test("bounded approach has upward surfaces, actual support walls, and a small static batching budget", () => {
  const count = Object.values(parts).reduce(
    (n, g) => n + g.getAttribute("position").count / 3,
    0,
  );
  assert.ok(count < 60000, `bounded triangle budget:${count}`);
  for (const g of Object.values(parts)) {
    const p = g.getAttribute("position");
    assert.ok(p.count > 0);
    for (let i = 0; i < p.count; i++)
      assert.ok(
        Number.isFinite(p.getY(i)) &&
          p.getX(i) >= site.bounds.minX - 0.01 &&
          p.getX(i) <= site.bounds.maxX + 0.01 &&
          p.getZ(i) >= site.bounds.minZ - 0.01 &&
          p.getZ(i) <= site.bounds.maxZ + 0.01,
      );
  }
  const n = parts.pavement.getAttribute("normal");
  assert.ok(
    Array.from({ length: n.count }, (_, i) => n.getY(i)).every((y) => y > 0.8),
  );
  const wall = parts.retaining.getAttribute("position");
  assert.ok(
    Array.from({ length: wall.count }, (_, i) => wall.getY(i)).includes(0),
    "walls extend to old datum",
  );
  const root = new T.Group(),
    shared = new T.MeshStandardMaterial();
  const chunks = buildCanadaPlaceApproach(
    root,
    data,
    { concrete: shared, stone: shared, dark: shared } as Materials,
    site,
    () => 0,
  );
  assert.ok(
    chunks.length <= 4,
    "four bounded material batches, not a mesh per tread/edge",
  );
});
test("real building interiors and source Canada Place pier receive no new top surface", () => {
  for (const id of ["w363651936", "w138256216", "w208599553", "w143683980"]) {
    const b = data.buildings.find((b) => b.id === id)!;
    assert.ok(b, id);
    const xs = b.pts.filter((_, i) => i % 2 === 0),
      zs = b.pts.filter((_, i) => i % 2 === 1);
    for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 3)
      for (let z = Math.min(...zs) + 1; z < Math.max(...zs); z += 3)
        if (pointInPoly(x, z, b.pts))
          assert.equal(cast(x, z).length, 0, `${id} interior must stay empty`);
  }
  assert.equal(
    cast(430, -541.04).length,
    0,
    "existing source deck remains the only deck surface",
  );
  const connector = cast(430, -530);
  assert.ok(connector.length > 0, "outside-pier arrival gap has support");
  assert.ok(
    Math.abs(connector[0].point.y - 7.88) < 0.005,
    "public finish meets actual deck datum",
  );
});
test("rendered grade follows shared support profile rather than a long floating ribbon", () => {
  const p = parts.pavement.getAttribute("position");
  let worst = 0;
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
      z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3,
      y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const offset = p.getY(i) - site.supportHeight(p.getX(i), p.getZ(i));
    worst = Math.max(worst, Math.abs(y - site.supportHeight(x, z) - offset));
  }
  assert.ok(worst < 0.03, `maximum interpolation error:${worst}`);
});

test("exposed perimeter guards are supported and leave entry, building contacts and matched ties open", () => {
  const rails = canadaPlaceGuardSegments(data, site, () => 0);
  assert.ok(rails.length > 0);
  for (const r of rails) {
    assert.ok(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) <= 2.001);
    for (const [p, base, top] of [
      [r.a, r.baseA, r.topA],
      [r.b, r.baseB, r.topB],
    ] as [Point, number, number][]) {
      assert.ok(site.contains(...p));
      assert.ok(Math.abs(base - site.supportHeight(...p) - 0.15) < 1e-8);
      assert.ok(Math.abs(top - base - 1.05) < 1e-8);
      assert.equal(pointInPoly(...p, CANADA_PLACE_ENTRY_CONNECTOR), false);
      for (const b of data.buildings)
        assert.equal(pointInPoly(...p, b.pts), false, `guard inside ${b.id}`);
    }
  }
  assert.equal(
    canadaPlaceGuardSegments(data, site, (x, z) => site.supportHeight(x, z))
      .length,
    0,
    "no rails at fully matched terrain edges",
  );
  const guard = parts.guards.getAttribute("position");
  for (const r of rails)
    for (const [p, base] of [
      [r.a, r.baseA],
      [r.b, r.baseB],
    ] as [Point, number][]) {
      let grounded = false;
      for (let i = 0; i < guard.count; i++)
        if (
          Math.hypot(guard.getX(i) - p[0], guard.getZ(i) - p[1]) < 0.04 &&
          Math.abs(guard.getY(i) - base) < 1e-4
        ) {
          grounded = true;
          break;
        }
      assert.ok(
        grounded,
        "each shared collision post has a rendered foot at pavement level",
      );
    }
});
test("retaining UVs preserve a vertical metre scale", () => {
  const p = parts.retaining.getAttribute("position"),
    uv = parts.retaining.getAttribute("uv");
  for (let i = 0; i < p.count; i++)
    assert.ok(Math.abs(uv.getY(i) - p.getY(i) / 4) < 1e-5);
  assert.ok(
    Array.from({ length: uv.count }, (_, i) => uv.getY(i)).some((y) => y > 1),
  );
});
