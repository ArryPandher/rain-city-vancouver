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
import { IRONWORKERS_ASPHALT_ROADS } from "../src/world/ironworkers-road-material";

test("actual Ironworkers roads preserve pre-material geometry, UVs and paint while assigning only the four asphalt ways", (t) => {
  const data: CityData = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    ),
    ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
    convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
    nearby = (p: number[]) =>
      Math.max(...p.filter((_, i) => i % 2 === 0)) > 6680 &&
      Math.min(...p.filter((_, i) => i % 2 === 0)) < 6900 &&
      Math.max(...p.filter((_, i) => i % 2)) > -2350 &&
      Math.min(...p.filter((_, i) => i % 2)) < -900;
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
  t.diagnostic(
    `${geometry.length} source/paint batches; geometry SHA256 ${hash}`,
  );
  // Captured from the actual World.roads implementation before the scoped
  // material substitution, with this same source fixture and final UV pass.
  assert.equal(geometry.length, 765);
  assert.equal(
    hash,
    "6cd515b3182ddf775bb45ea61a78a4b8641955b9c5d232248b174da3773fa491",
  );
  const changed = new Set<string>();
  for (const [id, key, m] of assignments) {
    const selected = IRONWORKERS_ASPHALT_ROADS.has(id) && key === "road";
    assert.equal(
      m.userData.ironworkersAsphalt === true,
      selected,
      `${id}/${key}`,
    );
    if (selected) changed.add(id);
  }
  assert.deepEqual([...changed].sort(), [...IRONWORKERS_ASPHALT_ROADS].sort());
  const roadChunks = world.chunks.filter(
    (mesh) =>
      (mesh.material as T.Material).userData.ironworkersAsphalt === true,
  );
  t.diagnostic(`Ironworkers asphalt road chunks: ${roadChunks.length}`);
  assert.ok(roadChunks.length > 0 && roadChunks.length <= 8);
  assert.deepEqual(data.roads, before);
});
