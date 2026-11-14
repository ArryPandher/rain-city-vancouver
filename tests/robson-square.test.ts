import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import { ORIGIN, KX, type CityData, type Building } from "../src/world/data";
import {
  gridXZ,
  ROBSON_GARDEN_ID,
  ROBSON_POOL,
  robsonHeight,
} from "../src/world/robson-site";
function map() {
  const d: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  d.buildings = d.buildings.filter((b) =>
    [ROBSON_GARDEN_ID, "w137903324", "w297300290", "w297300291"].includes(b.id),
  );
  d.buildings.forEach(
    (b) => (b.pts = b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox))),
  );
  d.roads = [];
  d.areas = [];
  d.ocean = [];
  return d;
}
test("Robson Square garden and glass entries are walkable while the courthouse remains solid", () => {
  const c = new CollisionWorld(map());
  for (const [u, v] of [
    [-200, -22],
    [-232, -22],
    [-276, -22],
    [-132.5, 19.4],
    [-107.4, 19.4],
  ])
    assert.equal(c.blocked(...gridXZ(u, v), 0.35), false);
  assert.equal(c.blocked(...gridXZ(-385, -10), 0.35), true);
  assert.equal(c.blocked(...gridXZ(ROBSON_POOL.u, ROBSON_POOL.v), 0.35), true);
  const from = gridXZ(-198, -22),
    to = gridXZ(-282, -22),
    end = c.move(...from, to[0] - from[0], to[1] - from[1], 0.35);
  assert.equal(end.hit, false);
  assert.ok(Math.hypot(end.x - to[0], end.z - to[1]) < 0.01);
});
test("Garden elevations rise continuously from the open approach and return to street grade", () => {
  const d = map(),
    garden = d.buildings.find((b) => b.id === ROBSON_GARDEN_ID) as Building,
    c = new CollisionWorld(d);
  let previous = 0,
    highest = 0;
  for (let u = -176; u >= -288; u -= 0.1) {
    const [x, z] = gridXZ(u, -22),
      height = c.height(x, z);
    assert.ok(Math.abs(height - previous) < 0.15, `height jump at ${u}`);
    previous = height;
    highest = Math.max(highest, height);
    assert.equal(height, robsonHeight(x, z, garden.pts) ?? 0);
  }
  assert.ok(highest > 3);
  assert.equal(c.height(...gridXZ(-145, -22)), 0);
  assert.equal(c.height(...gridXZ(-225, -52)), 0);
});

test("Rendered garden triangles follow the walking height within ten centimetres", async () => {
  const T = await import("three");
  const { Batcher } = await import("../src/world/geometry");
  const { robsonSquare } = await import("../src/world/robson-square");
  const d = map(),
    garden = d.buildings.find((b) => b.id === ROBSON_GARDEN_ID)!;
  const concrete = new T.MeshStandardMaterial(),
    batch = new Batcher(new T.Group());
  robsonSquare(garden, batch, {
    texture: () => new T.Texture(),
    concrete,
  } as any);
  const surface = batch.finish().find((m) => m.material === concrete)!;
  assert.ok(surface);
  const p = surface.geometry.getAttribute("position"),
    ix = surface.geometry.getIndex()!;
  let error = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const ids = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    const x = ids.reduce((s, j) => s + p.getX(j), 0) / 3,
      z = ids.reduce((s, j) => s + p.getZ(j), 0) / 3,
      y = ids.reduce((s, j) => s + p.getY(j), 0) / 3;
    error = Math.max(
      error,
      Math.abs(y - (robsonHeight(x, z, garden.pts) ?? 0.08)),
    );
  }
  assert.ok(error < 0.1, `maximum surface mismatch: ${error} m`);
});
