import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import { LANDMARKS, KX, ORIGIN, type CityData } from "../src/world/data";

test("Canada Place arrival follows the mapped two-way Howe approach with dry car/exit clearance", () => {
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
  const collision = new CollisionWorld(data),
    landmark = LANDMARKS.find((l) => l.id === "canada")!;
  const road = collision.nearestRoad(...landmark.spawn, 100)!;
  assert.equal(road.road.id, "w1255990033");
  assert.equal(road.road.name, "Howe Street");
  assert.equal(road.road.oneway, false);
  assert.equal(road.road.foot, true);
  assert.ok(Math.hypot(road.x - 486.65, road.z + 453.35) < 0.001);
  assert.ok(Math.abs(road.heading - landmark.heading) < 1e-8);
  assert.deepEqual(collision.safe(road.x, road.z, 1.2), [road.x, road.z]);
  assert.equal(collision.blocked(road.x, road.z, 2.8), false);
  const toLandmark = Math.atan2(
    landmark.at[0] - road.x,
    landmark.at[1] - road.z,
  );
  assert.ok(
    Math.abs(
      Math.atan2(
        Math.sin(road.heading - toLandmark),
        Math.cos(road.heading - toLandmark),
      ),
    ) < 0.12,
  );
  for (const forward of [-2.45, 0, 2.45])
    for (const side of [-1.45, 0, 1.45]) {
      const x =
        road.x +
        Math.sin(road.heading) * forward +
        Math.cos(road.heading) * side;
      const z =
        road.z +
        Math.cos(road.heading) * forward -
        Math.sin(road.heading) * side;
      assert.equal(collision.blocked(x, z, 0.15), false);
      assert.equal(collision.water(x, z), false);
    }
  for (const side of [-2.3, 2.3]) {
    const x = road.x + Math.cos(road.heading) * side,
      z = road.z - Math.sin(road.heading) * side;
    assert.equal(collision.blocked(x, z, 0.4), false);
    assert.equal(collision.water(x, z), false);
  }
});
