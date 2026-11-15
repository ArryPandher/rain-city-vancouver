import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  curbObstacles,
  harbourCurbGeometry,
  hasHarbourCurbs,
  CURB_BOUNDS,
} from "../src/world/street-curbs";
import type { Road } from "../src/world/data";
const road: Road = {
  name: "Canada Place",
  kind: "tertiary",
  width: 8,
  pts: [0, -600, 20, -600, 40, -600],
  sidewalk: "none",
};
const vertices = (g: ReturnType<typeof harbourCurbGeometry>["curb"]) => {
  const p = g.getAttribute("position");
  return Array.from({ length: p.count }, (_, i) => [
    p.getX(i),
    p.getY(i),
    p.getZ(i),
  ]);
};
test("bounded waterfront roads gain curbs even beside separately mapped sidewalks", () => {
  assert.ok(hasHarbourCurbs(road));
  assert.equal(hasHarbourCurbs({ ...road, name: "Robson Street" }), false);
  assert.equal(hasHarbourCurbs({ ...road, pts: [0, 0, 50, 0] }), false);
  const roads = JSON.parse(
    fs.readFileSync(
      new URL("../public/data/vancouver-roads.json", import.meta.url),
      "utf8",
    ),
  ).roads as Road[];
  const selected = roads.filter(hasHarbourCurbs);
  assert.ok(
    selected.length >= 5 && selected.length < 50,
    `bounded scope: ${selected.length}`,
  );
  const cuts = curbObstacles(roads);
  let count = 0;
  for (const r of selected)
    for (const g of Object.values(harbourCurbGeometry(r, cuts, () => 0))) {
      const points = vertices(g);
      count += points.length;
      assert.ok(
        points.every(
          ([x, y, z]) =>
            Number.isFinite(y) &&
            x > CURB_BOUNDS.minX &&
            x < CURB_BOUNDS.maxX &&
            z > CURB_BOUNDS.minZ &&
            z < CURB_BOUNDS.maxZ,
        ),
      );
      g.dispose();
    }
  assert.ok(count > 1000 && count < 150000, `bounded geometry: ${count}`);
});
test("curb has vertical outward normals and follows slope at every vertex", () => {
  const height = (x: number, z: number) => x * 0.03 + z * 0.01;
  const g = harbourCurbGeometry(road, [], height).curb;
  const pts = vertices(g),
    normal = g.getAttribute("normal");
  assert.ok(pts.some(([x, y, z]) => Math.abs(y - height(x, z) - 0.242) < 1e-5));
  assert.ok(
    pts.every(
      ([x, y, z]) => y - height(x, z) >= 0.10199 && y - height(x, z) <= 0.24201,
    ),
  );
  assert.ok(pts.some(([, , z], i) => z < -600 && normal.getZ(i) > 0.9));
  assert.ok(pts.some(([, , z], i) => z > -600 && normal.getZ(i) < -0.9));
  assert.ok(
    pts
      .filter(([x]) => x === 0 || x === 40)
      .every(([x, y, z]) => Math.abs(y - height(x, z) - 0.102) < 1e-5),
  );
});
test("cross streets and unmarked crossings cut all faces without shared nodes", () => {
  for (const other of [
    { kind: "tertiary", width: 8, pts: [20, -620, 20, -580] },
    {
      kind: "footway",
      crossing: true,
      crossingMarkings: "no",
      pts: [20, -620, 20, -580],
    },
    { kind: "service", width: 4, pts: [20, -620, 20, -580] },
  ] satisfies Road[]) {
    const parts = harbourCurbGeometry(
      road,
      curbObstacles([road, other]),
      () => 0,
    );
    const radius = other.crossing ? 2 : other.width! / 2 + 0.35;
    for (const g of Object.values(parts)) {
      assert.ok(vertices(g).length > 0);
      assert.ok(vertices(g).every(([x]) => Math.abs(x - 20) > radius + 0.59));
    }
  }
});
test("dense geometry nodes do not create seven metre gaps or inverted tops", () => {
  const dense = {
    ...road,
    pts: Array.from({ length: 41 }, (_, i) => [i, -600]).flat(),
  };
  const parts = harbourCurbGeometry(dense, [], () => 0);
  const pts = vertices(parts.apron),
    n = parts.apron.getAttribute("normal");
  assert.equal(Math.min(...pts.map((p) => p[0])), 0);
  assert.equal(Math.max(...pts.map((p) => p[0])), 40);
  assert.ok(pts.every((_, i) => n.getY(i) > 0.8));
});
