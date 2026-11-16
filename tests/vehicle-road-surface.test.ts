import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { VehicleRoadSurfaceBuilder } from "../src/world/vehicle-road-surface";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { Batcher, ribbon, subdividePath } from "../src/world/geometry";
import { CollisionWorld, BRIDGES, bridgePoint } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
import {
  CANADA_PLACE_DECK_Y,
  inCanadaPlacePier,
} from "../src/world/canada-place-deck";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { JACK_CUSTOM_ROADS } from "../src/world/jack-poole-site";

const near = (a: number, b: number, epsilon = 0.00002) =>
  assert.ok(Math.abs(a - b) < epsilon, `${a} vs ${b}`);
const rayHeight = (meshes: T.Object3D[], x: number, z: number) => {
  const ray = new T.Raycaster(
    new T.Vector3(x, 100, z),
    new T.Vector3(0, -1, 0),
  );
  return ray.intersectObjects(meshes, false)[0]?.point.y;
};
const mesh = (geometry: T.BufferGeometry) => {
  const m = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  m.updateMatrixWorld(true);
  return m;
};

test("road contact matches actual Float32 sloped, curved and crossfall triangles", () => {
  const g = ribbon(
    subdividePath([-20, -10, 0, 5, 18, 18, 40, 20]),
    13,
    0.092,
    (x, z) => 8 + x * 0.09 + z * 0.04 + Math.sin(x / 9) * 0.14,
    5,
    true,
  );
  const builder = new VehicleRoadSurfaceBuilder();
  builder.add(g);
  const surface = builder.finish(),
    rendered = mesh(g);
  let checked = 0;
  for (let x = -24.13; x < 43; x += 1.41)
    for (let z = -18.37; z < 30; z += 1.53) {
      const visible = rayHeight([rendered], x, z);
      if (visible === undefined) {
        assert.equal(surface.height(x, z), undefined);
      } else {
        near(surface.height(x, z)!, visible, 1e-9);
        checked++;
      }
    }
  assert.ok(checked > 300);
  assert.equal(surface.stats.triangleCount, g.getIndex()!.count / 3);
  assert.equal(surface.stats.triangleBytes, surface.stats.triangleCount * 36);
  assert.equal(
    surface.stats.payloadBytes,
    surface.stats.triangleBytes + surface.stats.cellIndexBytes,
  );
  assert.ok(surface.stats.cellCount > 4);
  g.dispose();
});

test("height gating preserves lower road access beneath an elevated overlapping ribbon", () => {
  const builder = new VehicleRoadSurfaceBuilder();
  for (const y of [0.092, 12.092]) {
    const g = ribbon([-10, 0, 10, 0], 8, y);
    builder.add(g);
    g.dispose();
  }
  const surface = builder.finish();
  near(surface.height(0, 0, 0)!, 0.092);
  near(surface.height(0, 0, 12)!, 12.092);
  near(surface.height(0, 0)!, 12.092);
  assert.equal(surface.height(0, 0, -10), undefined);
  assert.equal(surface.height(0, 5, 12), undefined);
  assert.equal(surface.height(NaN, 0), undefined);
  assert.equal(surface.height(0, 0, NaN), undefined);
});

test("final clipping and buffer disposal cannot create phantom support or retain render attributes", () => {
  const g = ribbon([-10, 0, 0, 0, 10, 0], 4, 2).toNonIndexed();
  // A final clipped/draw-range surface contains only its first segment.
  g.setDrawRange(0, 6);
  const builder = new VehicleRoadSurfaceBuilder();
  builder.add(g);
  const surface = builder.finish();
  assert.equal(surface.stats.triangleCount, 2);
  near(surface.height(-5, 0)!, 2);
  assert.equal(surface.height(5, 0), undefined);
  g.getAttribute("position").array.fill(999);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g.dispose();
  near(surface.height(-5, 0)!, 2);
  const empty = builder.finish();
  assert.deepEqual(empty.stats, {
    triangleCount: 0,
    triangleBytes: 0,
    cellCount: 0,
    cellIndexBytes: 0,
    payloadBytes: 0,
  });
  assert.equal(empty.height(-5, 0), undefined);
});

test("degenerate and nonfinite triangles contribute no contact cells", () => {
  const g = new T.BufferGeometry().setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 2, 0, 0, 0, NaN, 0, 2, 1, 0, 0, 1, 2],
      3,
    ),
  );
  const builder = new VehicleRoadSurfaceBuilder();
  builder.add(g);
  assert.equal(builder.finish().stats.payloadBytes, 0);
  g.dispose();
});

// Actual mapped roads/buildings and the production roads() generator. Only
// browser image/canvas material loading is stubbed; geometry/clipping stay real.
function mappedFixture() {
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
  const collision = new CollisionWorld(data);
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true),
  );
  const materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  for (const name of ["concrete", "asphalt", "stone", "yellow"] as const)
    materials[name] = new T.MeshStandardMaterial({ name });
  const roads = data.roads.filter((r) =>
    r.pts.some(
      (x, i) =>
        i % 2 === 0 &&
        x >= 350 &&
        x <= 550 &&
        r.pts[i + 1] >= -600 &&
        r.pts[i + 1] <= -300,
    ),
  );
  // A skipped custom-road ID must not acquire contact just because its source
  // polyline exists. Move that test road far away from other mapped surfaces.
  roads.push({
    id: [...JACK_CUSTOM_ROADS][0],
    kind: "service",
    pts: [9000, 9000, 9020, 9000],
  });
  const world = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    data: { ...data, roads },
    materials,
    facadeMultiDraw: false,
    vehicleSurfaceSupport: true,
    collision,
    stats: { roads: 0 },
  }) as World;
  const surfaces: T.Mesh[] = [];
  const add = Batcher.prototype.add;
  Batcher.prototype.add = function (g, m, x, z, key) {
    if (key === "road") surfaces.push(mesh(g.clone()));
    return add.call(this, g, m, x, z, key);
  };
  try {
    world.roads();
  } finally {
    Batcher.prototype.add = add;
  }
  return { world, surfaces };
}

test("opt-in World contact uses final mapped ribbons while default heights and clipping remain unchanged", () => {
  const { world, surfaces } = mappedFixture(),
    collision = world.collision;
  let checked = 0,
    corrected = 0;
  for (let x = 390.23; x < 525; x += 3.31)
    for (let z = -506.17; z < -335; z += 3.17) {
      if (
        collision.pacificApron?.height(x, z) !== undefined ||
        collision.howeCordovaJunction?.height(x, z) !== undefined ||
        collision.bridgeAt(x, z) ||
        inCanadaPlacePier(x, z)
      )
        continue;
      const visible = rayHeight(surfaces, x, z);
      if (visible === undefined) continue;
      const original = collision.height(x, z),
        walking = collision.walkingHeight(x, z);
      near(world.vehicleGroundHeight(x, z, original), visible);
      assert.equal(collision.height(x, z), original);
      assert.equal(collision.walkingHeight(x, z), walking);
      Object.assign(world, { vehicleSurfaceSupport: false });
      assert.equal(world.vehicleGroundHeight(x, z, original), original);
      Object.assign(world, { vehicleSurfaceSupport: true });
      if (Math.abs(original - visible) > 0.05) corrected++;
      checked++;
    }
  assert.ok(checked > 200, `${checked} mapped road ray comparisons`);
  assert.ok(corrected > 100, `${corrected} actual finish corrections`);
  assert.equal(
    world.vehicleGroundHeight(9010, 9000),
    collision.height(9010, 9000),
  );
  assert.equal(
    world.vehicleGroundHeight(10000, 10000),
    collision.height(10000, 10000),
  );
  const stats = world.vehicleSurfaceStats!;
  const renderedTriangles = surfaces.reduce(
    (n, s) =>
      n +
      (s.geometry.getIndex()?.count ??
        s.geometry.getAttribute("position").count) /
        3,
    0,
  );
  // Clipping emits zero-area/sliver triangles; those carry no vertical support
  // and are discarded. The ray grid above verifies retained coverage directly.
  assert.ok(stats.triangleCount <= renderedTriangles);
  assert.ok(stats.triangleCount > renderedTriangles * 0.99);
  assert.ok(stats.payloadBytes < 2_000_000, JSON.stringify(stats));
  // Use shared custom surfaces at their triangle interiors, including curved
  // gutter/curb slopes; none receives the generic asphalt offset twice.
  for (const tri of collision.howeCordovaJunction!.triangles.filter(
    (_, i) => i % 157 === 0,
  )) {
    const x = tri.points.reduce((n, p) => n + p[0], 0) / 3,
      z = tri.points.reduce((n, p) => n + p[2], 0) / 3;
    near(world.vehicleGroundHeight(x, z), collision.height(x, z));
  }
  for (const tri of collision.pacificApron!.triangles.filter(
    (_, i) => i % 19 === 0,
  )) {
    const x = tri.reduce((n, p) => n + p[0], 0) / 3,
      z = tri.reduce((n, p) => n + p[2], 0) / 3;
    near(
      world.vehicleGroundHeight(x, z),
      collision.pacificApron!.height(x, z)!,
    );
  }
  // Existing source pier remains at its authored elevation; approach paving
  // still uses existing finished walking support when no road covers the point.
  near(world.vehicleGroundHeight(430, -541.04), CANADA_PLACE_DECK_Y);
  const [x, z] = [492.2032484809166, -473.6827770690959];
  assert.equal(rayHeight(surfaces, x, z), undefined);
  near(world.vehicleGroundHeight(x, z), collision.walkingHeight(x, z));
  console.log(JSON.stringify({ vehicleSurface: stats, checked, corrected }));
  surfaces.forEach((s) => {
    s.geometry.dispose();
    (s.material as T.Material).dispose();
  });
});

test("bridge support wins over a raised ribbon and lower traffic keeps its existing layer", () => {
  const data: CityData = {
    meta: { bbox: [], latC: 0, pxPerMeter: 2, w: 1, h: 1, fetched: "" },
    buildings: [],
    roads: [],
    areas: [],
    trees: [],
    ocean: [],
    pois: [],
  };
  const collision = new CollisionWorld(data),
    bridge = BRIDGES.find((b) => b.id === "cambie")!;
  const [x, z] = bridgePoint(bridge, 0.5),
    deck = collision.height(x, z);
  const builder = new VehicleRoadSurfaceBuilder();
  for (const y of [0.092, deck + 0.092]) {
    const g = ribbon([x - 10, z, x + 10, z], 8, y);
    builder.add(g);
    g.dispose();
  }
  const world = Object.assign(Object.create(World.prototype), {
    collision,
    vehicleSurfaceSupport: true,
    vehicleRoadSurface: builder.finish(),
  }) as World;
  near(world.vehicleGroundHeight(x, z, deck), deck);
  near(world.vehicleGroundHeight(x, z, 0), 0.092);
  assert.equal(collision.height(x, z, 0), 0);
  // Before roads are built the fifth option has no partial/empty surface effect.
  Object.assign(world, { vehicleRoadSurface: undefined });
  assert.equal(world.vehicleGroundHeight(x, z, 0), collision.height(x, z, 0));
});
