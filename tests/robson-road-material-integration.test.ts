import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData, type Road } from "../src/world/data";
import { ROBSON_ASPHALT_ROADS } from "../src/world/robson-road-material";

function renderRoads(enabled: boolean) {
  const data: CityData = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
    convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
    nearby = (p: number[]) =>
      Math.max(...p.filter((_, i) => i % 2 === 0)) > -220 &&
      Math.min(...p.filter((_, i) => i % 2 === 0)) < -60 &&
      Math.max(...p.filter((_, i) => i % 2)) > -20 &&
      Math.min(...p.filter((_, i) => i % 2)) < 110;
  for (const b of data.buildings) b.pts = convert(b.pts);
  for (const a of data.areas) {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  }
  data.ocean = data.ocean.map(convert);
  data.publicTrees = JSON.parse(
    fs.readFileSync("public/data/vancouver-public-trees.json", "utf8"),
  );
  data.buildings = data.buildings.filter((b) => nearby(b.pts));
  data.areas = data.areas.filter((a) => nearby(a.pts));
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads.filter((r: Road) => nearby(r.pts));
  const before = structuredClone(data.roads),
    collision = new CollisionWorld(data),
    material = Object.create(Materials.prototype) as Materials;
  material.texture = () => new T.Texture();
  for (const name of ["concrete", "asphalt", "stone", "yellow"] as const)
    material[name] = new T.MeshStandardMaterial({ name, side: T.FrontSide });
  let road: Road | undefined;
  const roads = new Proxy(data.roads, {
    get(target, property, receiver) {
      if (property === Symbol.iterator)
        return function* () {
          for (const r of target) {
            road = r;
            yield r;
          }
        };
      return Reflect.get(target, property, receiver);
    },
  });
  const world = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    data: { ...data, roads },
    materials: material,
    collision,
    facadeMultiDraw: false,
    vehicleSurfaceSupport: true,
    stats: { roads: 0 },
  }) as World;
  // Test-only material selection override. Execute the current owning roads()
  // with identical source IDs and clipping/contact pipeline in both cases.
  // No runtime feature flag or edited road identity is needed.
  if (!enabled)
    Object.defineProperty(world, "robsonRoadMaterial", {
      configurable: true,
      get: () => material.asphalt,
      set: () => {},
    });
  const add = Batcher.prototype.add,
    finish = Batcher.prototype.finish,
    labels = new WeakMap<T.BufferGeometry, string>(),
    geometry: string[] = [],
    assignments: [string, string, T.Material][] = [];
  Batcher.prototype.add = function (g, m, x, z, key = "") {
    labels.set(g, `${road?.id ?? "none"}/${key}`);
    assignments.push([road?.id ?? "none", key, m]);
    return add.call(this, g, m, x, z, key);
  };
  Batcher.prototype.finish = function (...args) {
    // Inspect after World.roads applies its final world/5 UVs, before merge
    // disposes input geometries. Material grouping is deliberately excluded.
    for (const group of this.groups.values())
      for (const g of group.geo) {
        const h = createHash("sha256");
        for (const name of Object.keys(g.attributes).sort()) {
          h.update(name);
          h.update(Buffer.from(g.getAttribute(name).array.buffer));
        }
        if (g.index) h.update(Buffer.from(g.index.array.buffer));
        geometry.push(`${labels.get(g)}:${h.digest("hex")}`);
      }
    return finish.apply(this, args);
  };
  try {
    world.roads();
  } finally {
    Batcher.prototype.add = add;
    Batcher.prototype.finish = finish;
  }
  const hash = createHash("sha256")
    .update(geometry.sort().join("\n"))
    .digest("hex");
  const changed = new Set<string>();
  for (const [id, key, m] of assignments) {
    const selected = enabled && ROBSON_ASPHALT_ROADS.has(id) && key === "road";
    assert.equal(m.userData.robsonAsphalt === true, selected, `${id}/${key}`);
    if (selected) changed.add(id);
    if (!enabled && ROBSON_ASPHALT_ROADS.has(id) && key === "road")
      assert.equal(
        m,
        material.asphalt,
        "disabled control uses generic asphalt",
      );
  }
  assert.deepEqual(
    [...changed].sort(),
    enabled ? [...ROBSON_ASPHALT_ROADS].sort() : [],
  );
  const roadChunks = world.chunks.filter(
    (mesh) => (mesh.material as T.Material).userData.robsonAsphalt === true,
  );
  if (enabled) assert.ok(roadChunks.length > 0 && roadChunks.length <= 2);
  else assert.equal(roadChunks.length, 0);
  assert.deepEqual(data.roads, before);
  const unchangedMaterials = assignments
    .filter(([id, key]) => !(ROBSON_ASPHALT_ROADS.has(id) && key === "road"))
    .map(([id, key, m]) => `${id}/${key}/${m.name}`)
    .sort();
  return { hash, geometry: geometry.sort(), unchangedMaterials };
}

test("current Robson geometry, UVs, paint and outside materials are identical with the four-way material disabled/enabled", (t) => {
  const control = renderRoads(false),
    candidate = renderRoads(true);
  assert.ok(control.geometry.length > 0);
  assert.deepEqual(
    candidate.geometry,
    control.geometry,
    "compare every labelled attribute/index digest, including current Gallery footway cuts",
  );
  assert.deepEqual(
    candidate.unchangedMaterials,
    control.unchangedMaterials,
    "paint, curbs, footways and outside road assignments remain unchanged",
  );
  assert.equal(candidate.hash, control.hash);
  t.diagnostic(
    `${candidate.geometry.length} identical source/paint records; current SHA256 ${candidate.hash}`,
  );
});
