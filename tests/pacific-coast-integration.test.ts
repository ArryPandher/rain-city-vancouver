import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, centroid, pairs, type CityData } from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";
import { pacificCoast } from "../src/world/pacific-coast-building";
import {
  PACIFIC_COAST_ENTRANCE_THRESHOLDS,
  pacificCoastBays,
} from "../src/world/pacific-coast-site";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (pts: number[]) => pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = convert(b.pts);
for (const a of data.areas) {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
}
data.ocean = data.ocean.map(convert);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const building = data.buildings.find((b) => b.id === "w143683962")!;
const collision = new CollisionWorld(data);
const datum = collision.groundHeight(...centroid(building.pts));
const root = new T.Group();
const batch = new Batcher(root);
batch.offsetY = datum;
const reflections: ReflectionProbeSpec[] = [];
const library = { texture: () => new T.Texture<HTMLImageElement>() };
assert.equal(pacificCoast(building, batch, library, reflections), true);
batch.finish();
root.updateMatrixWorld(true);

test("325 Howe base meets the real shared street along both sloping public faces", () => {
  const ring = pairs(building.pts);
  for (const edge of [0, 1]) {
    const frame = facadeFrame(ring[edge], ring[edge + 1]);
    for (const fraction of [0.08, 0.23, 0.43, 0.63, 0.83, 0.94]) {
      const a = frame.p(frame.length * fraction, 0, -1);
      const y = collision.groundHeight(a[0], a[2]) + 0.05;
      const b = frame.p(frame.length * fraction, y, 0.8);
      const start = new T.Vector3(a[0], y, a[2]);
      const direction = new T.Vector3(...b).sub(start);
      const hits = new T.Raycaster(
        start,
        direction.clone().normalize(),
        0,
        direction.length(),
      ).intersectObject(root, true);
      assert.ok(
        hits.length,
        `exposed foundation gap at edge ${edge}, ${fraction}`,
      );
      assert.match(
        ((hits[0].object as T.Mesh).material as T.Material).name,
        /granite|ashlar|stone/i,
      );
      assert.equal(
        collision.blocked(a[0], a[2], 0.25, y),
        false,
        "sidewalk remains outside building collision",
      );
    }
  }
  assert.equal(
    collision.blocked(...centroid(building.pts), 0.3, datum + 1),
    true,
  );
});

test("the dedicated facade dispatch has one external static reflection and does not affect neighbours", () => {
  assert.equal(reflections.length, 1);
  const probe = reflections[0];
  assert.ok(probe.position.every(Number.isFinite));
  assert.equal(
    collision.blocked(
      probe.position[0],
      probe.position[2],
      0.1,
      probe.position[1],
    ),
    false,
  );
  assert.equal(probe.materials.length, 1);
  assert.match(probe.materials[0].name, /glazing/);
  const otherBatch = new Batcher(new T.Group());
  const otherProbes: ReflectionProbeSpec[] = [];
  assert.equal(
    pacificCoast(
      { ...building, id: "w208599553" },
      otherBatch,
      library,
      otherProbes,
    ),
    false,
  );
  assert.equal(otherBatch.groups.size, 0);
  assert.equal(otherProbes.length, 0);
  const source = fs.readFileSync("src/world/architecture.ts", "utf8");
  assert.ok(
    source.indexOf("pacificCoast(b, shell, m, reflections)") <
      source.indexOf("heritage ="),
  );
});

test("Howe entrance thresholds meet the actual rising sidewalk", () => {
  const ring = pairs(building.pts);
  const frame = facadeFrame(ring[1], ring[2]);
  const bays = pacificCoastBays(1);
  for (const [index, threshold] of Object.entries(
    PACIFIC_COAST_ENTRANCE_THRESHOLDS,
  )) {
    const point = frame.p(bays[Number(index)].centre, 0, -0.3);
    const height =
      datum + threshold - collision.groundHeight(point[0], point[2]);
    assert.ok(
      height > 0.025 && height < 0.055,
      `entrance ${index}: ${height}m step`,
    );
  }
});
