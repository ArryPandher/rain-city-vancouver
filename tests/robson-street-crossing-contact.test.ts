import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData, type Road } from "../src/world/data";
import {
  ROBSON_STREET_EDGE as D,
  robsonStreetWorld,
} from "../src/world/robson-street-edge-data";
import { createRobsonStreetEdgeGeometry } from "../src/world/robson-street-edge";

const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = convert(b.pts);
for (const a of data.areas) {
  a.pts = convert(a.pts);
  a.holes = a.holes?.map(convert);
}
data.ocean = data.ocean.map(convert);
data.publicTrees = JSON.parse(
  fs.readFileSync("public/data/vancouver-public-trees.json", "utf8"),
);
const nearby = (p: number[]) =>
  Math.max(...p.filter((_, i) => i % 2 === 0)) > -220 &&
  Math.min(...p.filter((_, i) => i % 2 === 0)) < -60 &&
  Math.max(...p.filter((_, i) => i % 2)) > -20 &&
  Math.min(...p.filter((_, i) => i % 2)) < 110;
data.buildings = data.buildings.filter((b) => nearby(b.pts));
data.areas = data.areas.filter((a) => nearby(a.pts));
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads.filter((r: Road) => nearby(r.pts));

test("actual World.roads preserves pre-curb traffic/bikeway vertices and fixes native crossing floor contact without height feedback", () => {
  const collision = new CollisionWorld(data),
    site = collision.robsonStreetEdge!;
  assert.ok(site);
  const material = Object.create(Materials.prototype) as Materials;
  material.texture = () => new T.Texture();
  for (const name of ["concrete", "asphalt", "stone", "yellow"] as const)
    material[name] = new T.MeshStandardMaterial({ name, side: T.FrontSide });
  let currentRoad: Road | undefined;
  // Observe the actual source iteration, including mound paths whose specialized
  // height function never invokes CollisionWorld.roadHeight.
  const trackedRoads = new Proxy(data.roads, {
    get(target, property, receiver) {
      if (property === Symbol.iterator)
        return function* () {
          for (const road of target) {
            currentRoad = road;
            yield road;
          }
        };
      return Reflect.get(target, property, receiver);
    },
  });
  const build = (enabled: boolean) => {
    collision.robsonStreetEdge = enabled ? site : undefined;
    const world = Object.assign(Object.create(World.prototype), {
      root: new T.Group(),
      chunks: [],
      data: { ...data, roads: trackedRoads },
      materials: material,
      collision,
      facadeMultiDraw: false,
      vehicleSurfaceSupport: true,
      stats: { roads: 0 },
    }) as World;
    const surfaces: T.Mesh[] = [];
    const add = Batcher.prototype.add;
    Batcher.prototype.add = function (geometry, mat, x, z, key) {
      if (key === "road") {
        const mesh = new T.Mesh(geometry.clone(), mat);
        mesh.userData.road = currentRoad;
        mesh.updateMatrixWorld(true);
        surfaces.push(mesh);
      }
      return add.call(this, geometry, mat, x, z, key);
    };
    try {
      world.roads();
    } finally {
      Batcher.prototype.add = add;
    }
    return { world, surfaces };
  };
  const before = build(false),
    after = build(true);
  const protectedIds = new Set<string>([...D.roadIds, ...D.protectedIds]);
  // These are emitted World.roads buffers, not a same-provider ribbon fixture.
  for (const old of before.surfaces.filter((m) =>
    protectedIds.has(m.userData.road.id),
  )) {
    const current = after.surfaces.find(
      (m) => m.userData.road.id === old.userData.road.id,
    );
    assert.ok(current, old.userData.road.id);
    assert.deepEqual(
      current.geometry.getAttribute("position").array,
      old.geometry.getAttribute("position").array,
      `${old.userData.road.id} protected actual triangle vertices`,
    );
    assert.deepEqual(
      current.geometry.index?.array,
      old.geometry.index?.array,
      `${old.userData.road.id} protected actual indices`,
    );
  }
  assert.equal(
    new Set(
      before.surfaces
        .filter((m) => protectedIds.has(m.userData.road.id))
        .map((m) => m.userData.road.id),
    ).size,
    protectedIds.size,
  );
  const crossing = after.surfaces.find(
    (m) => m.userData.road.id === "w915323389",
  )!;
  const cp = crossing.geometry.getAttribute("position");
  for (let i = 0; i < cp.count; i++)
    assert.ok(
      Math.abs(cp.getY(i) - 0.07) < 1e-6,
      "crossing must not inherit raised sidewalk endpoints",
    );
  const ray = (x: number, z: number, meshes: T.Mesh[]) =>
    new T.Raycaster(
      new T.Vector3(x, 20, z),
      new T.Vector3(0, -1, 0),
    ).intersectObjects(meshes)[0];
  const coords = [
    [-139.26, 42.92],
    [-140, 43],
    [-138, 44],
    [-137.1, 44.9],
  ];
  for (let i = 0; i <= 30; i++)
    coords.push([-143.8 + (6.7 * i) / 30, 40.5 + (4.4 * i) / 30]);
  const parts = createRobsonStreetEdgeGeometry(site);
  const finish = Object.values(parts).map((g) => {
    const m = new T.Mesh(g, material.concrete);
    m.updateMatrixWorld(true);
    return m;
  });
  for (const [x, z] of coords) {
    const hit = ray(x, z, [...after.surfaces, ...finish]);
    assert.ok(hit, `visible upward floor ${x},${z}`);
    assert.ok(
      Math.abs(collision.walkingHeight(x, z) - hit.point.y) < 1e-5,
      `walking contact ${x},${z}: ${collision.walkingHeight(x, z)} != ${hit.point.y}`,
    );
    assert.equal(
      collision.blocked(x, z, 0.36),
      false,
      `crossing remains passable ${x},${z}`,
    );
  }
  assert.ok(Math.abs(collision.walkingHeight(-139.26, 42.92) - 0.092) < 1e-6);
  // Capture is local and cannot replace existing plaza, cycleway or garden floors.
  for (const id of D.protectedIds) {
    const r = data.roads.find((r) => r.id === id)!;
    for (let i = 0; i < r.pts.length - 2; i += 2) {
      const x = (r.pts[i] + r.pts[i + 2]) / 2,
        z = (r.pts[i + 1] + r.pts[i + 3]) / 2;
      assert.equal(site.height(x, z), undefined, `${id} retains contact owner`);
    }
  }
  for (const p of [
    [0, 20],
    [-50, 0],
    [45, 0],
    [0, -45],
  ])
    assert.equal(site.height(...robsonStreetWorld(p[0], p[1])), undefined);
  // Rebuilding after contact capture cannot feed the saved floor back into roads.
  const again = build(true);
  assert.equal(again.surfaces.length, after.surfaces.length);
  for (let i = 0; i < after.surfaces.length; i++) {
    const current = after.surfaces[i],
      repeated = again.surfaces[i];
    assert.equal(repeated.userData.road.id, current.userData.road.id);
    assert.deepEqual(
      repeated.geometry.getAttribute("position").array,
      current.geometry.getAttribute("position").array,
      `${current.userData.road.id} repeated road construction`,
    );
  }
});
