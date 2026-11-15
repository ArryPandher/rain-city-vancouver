import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  pointInPoly,
  roadWidth,
  segmentPoint,
  type CityData,
} from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import {
  FAIRMONT_ARRIVAL_ISLAND as spec,
  buildFairmontArrivalIsland,
  createFairmontArrivalIsland,
} from "../src/world/fairmont-arrival-island";

const data = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
) as CityData;
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
for (const group of [data.buildings, data.areas])
  for (const item of group) {
    item.pts = item.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
    if ("holes" in item && item.holes)
      item.holes = item.holes.map((p) =>
        p.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
      );
  }
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
data.ocean = [];
const collision = new CollisionWorld(data);
const site = collision.fairmontArrivalIsland!;
const group = new T.Group(),
  batch = new Batcher(group);
const materials = {
  stone: new T.MeshStandardMaterial(),
  soil: new T.MeshStandardMaterial(),
};
buildFairmontArrivalIsland(batch, site, materials);
const meshes = batch.finish();
group.updateMatrixWorld(true);
const ray = (from: T.Vector3, to: T.Vector3) =>
  new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to),
  ).intersectObject(group, true);

test("arrival island fits the supported court with both roads and pedestrian bypasses clear", () => {
  assert.ok(site);
  const nearby = data.roads.filter((r) =>
    r.pts.some(
      (v, i) =>
        i % 2 === 0 &&
        v > 465 &&
        v < 510 &&
        r.pts[i + 1] > -500 &&
        r.pts[i + 1] < -450,
    ),
  );
  let minDrive = Infinity,
    minRoad = Infinity;
  for (let i = 0; i < site.footprint.length; i++) {
    const a = site.footprint[i],
      b = site.footprint[(i + 1) % site.footprint.length];
    for (let t = 0; t <= 1; t += 0.1) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      assert.ok(collision.canada!.contains(x, z));
      assert.ok(!data.buildings.some((b) => pointInPoly(x, z, b.pts)));
      for (const r of nearby)
        for (let j = 2; j < r.pts.length; j += 2) {
          const gap =
            segmentPoint(
              x,
              z,
              r.pts[j - 2],
              r.pts[j - 1],
              r.pts[j],
              r.pts[j + 1],
            ).d -
            roadWidth(r) / 2;
          if (r.id === "w251586099") minDrive = Math.min(minDrive, gap);
          else minRoad = Math.min(minRoad, gap);
        }
    }
  }
  assert.ok(minDrive > 3.2, `driveway separation ${minDrive}`);
  assert.ok(minRoad > 4.5, `other road/path separation ${minRoad}`);
  // A full 1.8 m wide route around the island stays usable; neither terminal
  // end becomes a barrier across the court or a false entrance.
  for (let i = 0; i < site.footprint.length; i++) {
    const p = site.footprint[i],
      projection = segmentPoint(...p, ...spec.a, ...spec.b);
    const x0 = spec.a[0] + (spec.b[0] - spec.a[0]) * projection.t,
      z0 = spec.a[1] + (spec.b[1] - spec.a[1]) * projection.t;
    const dx = p[0] - x0,
      dz = p[1] - z0,
      d = Math.hypot(dx, dz);
    const x = p[0] + (dx / d) * 0.95,
      z = p[1] + (dz / d) * 0.95;
    assert.equal(
      collision.blocked(x, z, 0.9, collision.groundHeight(x, z)),
      false,
      `pedestrian bypass ${x},${z}`,
    );
  }
  const driveway = data.roads.find((r) => r.id === "w251586099")!;
  for (let i = 2; i < driveway.pts.length; i += 2)
    for (let t = 0; t <= 1; t += 0.05) {
      const x =
          driveway.pts[i - 2] + (driveway.pts[i] - driveway.pts[i - 2]) * t,
        z =
          driveway.pts[i - 1] + (driveway.pts[i + 1] - driveway.pts[i - 1]) * t;
      assert.equal(
        site.blocked(x, z, 1.1, collision.groundHeight(x, z)),
        false,
        "full car width remains outside island",
      );
    }
});

test("closed curved curb and soil match their collision heights and contact active pavement", () => {
  let maxContactError = 0,
    checks = 0;
  for (let x = site.bounds.minX + 0.035; x < site.bounds.maxX; x += 0.14)
    for (let z = site.bounds.minZ + 0.03; z < site.bounds.maxZ; z += 0.14) {
      if (!site.contains(x, z)) continue;
      const top = site.topAt(x, z)!;
      assert.ok(Number.isFinite(top));
      const hits = ray(
        new T.Vector3(x, top + 1, z),
        new T.Vector3(x, top - 1, z),
      );
      assert.ok(hits.length > 0);
      assert.ok(
        Math.abs(hits[0].point.y - top) < 0.0001,
        "render and collision use identical top triangles",
      );
      assert.equal(
        collision.blocked(x, z, 0.01, collision.groundHeight(x, z)),
        true,
      );
      assert.equal(
        collision.cameraBlocked(
          x,
          z,
          0.2,
          site.groundAt(x, z) + spec.height + 0.25,
        ),
        false,
        "camera clears finite low body",
      );
      checks++;
    }
  for (let i = 0; i < site.footprint.length; i++) {
    const a = site.footprint[i],
      b = site.footprint[(i + 1) % site.footprint.length];
    for (let t = 0.1; t < 1; t += 0.2) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      const base = site.groundAt(...a) * (1 - t) + site.groundAt(...b) * t;
      maxContactError = Math.max(
        maxContactError,
        Math.abs(base - site.groundAt(x, z)),
      );
      const nx = a[1] - b[1],
        nz = b[0] - a[0],
        n = Math.hypot(nx, nz),
        y = base + 0.2;
      const hits = ray(
        new T.Vector3(x + (nx / n) * 0.2, y, z + (nz / n) * 0.2),
        new T.Vector3(x - (nx / n) * 0.2, y, z - (nz / n) * 0.2),
      );
      assert.ok(hits.length > 0, "real outer wall closes the planted volume");
    }
  }
  assert.ok(checks > 500);
  assert.ok(
    maxContactError < 0.015,
    `curb follows pavement: ${maxContactError}`,
  );
  // Closed manifold at a precision much finer than visible joins.
  const edges = new Map<string, number>();
  const key = (v: number[]) => v.map((x) => Math.round(x * 1e5)).join(",");
  for (const s of site.surfaces)
    for (let i = 0; i < 3; i++) {
      const k = [key(s.triangle[i]), key(s.triangle[(i + 1) % 3])]
        .sort()
        .join("|");
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  assert.ok(
    [...edges.values()].every((n) => n === 2),
    "all curb/soil/base edges are closed exactly twice",
  );
});

test("grade callback controls the whole section while unchanged outside the island", () => {
  const planar = createFairmontArrivalIsland(
    (x, z) => 2 + (x - 486) * 0.03 + (z + 475) * 0.11,
  );
  for (const s of planar.surfaces)
    for (const [x, y, z] of s.triangle) {
      const delta = y - planar.groundAt(x, z);
      assert.ok(
        delta >= -spec.baseOverlap - 1e-8 && delta <= spec.height + 1e-8,
      );
    }
  assert.equal(planar.topAt(0, 0), undefined);
  assert.equal(planar.blocked(0, 0, 0.5, 0), false);
  assert.equal(planar.blocked(486.5, -474, 1, 100), false);
  for (const p of site.plants) {
    assert.ok(site.contains(p.x, p.z));
    assert.ok(
      Math.abs(p.y - site.topAt(p.x, p.z)!) < 1e-8,
      "foliage stems root on actual soil",
    );
  }
});

test("four real leaf clusters and closed hardscape stay below six thousand triangles without new assets", () => {
  const file = fs.readFileSync("public/models/forest/coastal-broadleaf.glb");
  const gltf = JSON.parse(
    file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
  );
  const plantTriangles = gltf.meshes
    .flatMap((m: any) => m.primitives)
    .reduce((n: number, p: any) => n + gltf.accessors[p.indices].count / 3, 0);
  assert.equal(plantTriangles, 1320);
  assert.equal(site.plants.length, 4);
  assert.equal(meshes.length, 2);
  let triangles = plantTriangles * site.plants.length;
  for (const mesh of meshes) {
    triangles += mesh.geometry.index!.count / 3;
    for (const a of Object.values(mesh.geometry.attributes))
      for (const n of a.array) assert.ok(Number.isFinite(n));
  }
  assert.ok(triangles < 6000, `total ${triangles}`);
  assert.equal(gltf.materials.length, 1);
  assert.equal(
    gltf.textures.length,
    3,
    "reuse the existing leaf material and its existing maps",
  );
  // New foliage lies in one existing 24 m spatial cell: one leaf draw group.
  assert.equal(
    new Set(
      site.plants.map((p) => `${Math.floor(p.x / 24)},${Math.floor(p.z / 24)}`),
    ).size,
    1,
  );
  assert.ok(meshes.length + 1 <= 4);
});
