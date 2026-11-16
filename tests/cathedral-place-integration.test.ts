import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { architecture } from "../src/world/architecture";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData, type Building } from "../src/world/data";
import type { Materials } from "../src/world/materials";

// Only image loading/rasterization is stubbed. Dispatch, batching, source data,
// collisions and all three building geometry paths execute their real code.
const context = new Proxy(
  { createLinearGradient: () => ({ addColorStop() {} }) },
  {
    get: (target, key) =>
      key in target ? target[key as keyof typeof target] : () => {},
    set: () => true,
  },
);
const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document"),
  priorLoad = T.TextureLoader.prototype.load;
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  },
});
T.TextureLoader.prototype.load = function () {
  return new T.Texture();
};
const data: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ),
  ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540,
  cv = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const b of data.buildings) b.pts = cv(b.pts);
for (const a of data.areas) {
  a.pts = cv(a.pts);
  a.holes = a.holes?.map(cv);
}
data.ocean = [];
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const tags = JSON.parse(
  fs.readFileSync("public/data/vancouver-building-tags.json", "utf8"),
).buildings;
for (const b of data.buildings) Object.assign(b, tags[b.id]);
const collision = new CollisionWorld(data),
  tower = data.buildings.find((b) => b.id === "w114505109")!,
  wing = data.buildings.find((b) => b.id === "w260069760")!;
const unrelated = data.buildings.find((b) => b.id === "w459134074")!;
assert.ok(unrelated, "real unrelated map building required");
const mat = (name: string) => new T.MeshStandardMaterial({ name });
function run(buildings: Building[]) {
  const root = new T.Group(),
    library = {
      texture: () => new T.Texture(),
      facades: Array.from({ length: 12 }, (_, i) => mat(`generic-facade-${i}`)),
      photoFacades: [mat("generic-photo")],
      roof: mat("generic-roof"),
      concrete: mat("generic-foundation"),
      stone: mat("generic-stone"),
      chrome: mat("generic-chrome"),
      grass: mat("generic-grass"),
    } as unknown as Materials;
  const result = architecture(root, { ...data, buildings }, library, collision);
  root.updateMatrixWorld(true);
  return { ...result, root };
}
function signature(chunks: T.Mesh[]) {
  return chunks
    .map((mesh) => {
      const hash = createHash("sha256");
      for (const name of Object.keys(mesh.geometry.attributes).sort()) {
        hash.update(name);
        hash.update(Buffer.from(mesh.geometry.getAttribute(name).array.buffer));
      }
      if (mesh.geometry.index)
        hash.update(Buffer.from(mesh.geometry.index.array.buffer));
      return [(mesh.material as T.Material).name, hash.digest("hex")];
    })
    .sort((a, b) => a.join().localeCompare(b.join()));
}

test("actual architecture dispatch installs only Cathedral Place and preserves its neighbor/source/contact", () => {
  try {
    const before = structuredClone([tower, wing, unrelated]);
    const points = [
      [-31, -94],
      [-33, -104],
      [-38, -114],
      [2.4, -131.8],
    ];
    const contact = () =>
      points.map(([x, z]) => [
        collision.groundHeight(x, z),
        collision.height(x, z, 0),
        collision.blocked(x, z, 0.36, 0),
      ]);
    const priorContact = contact();
    const isolated = run([wing, unrelated]),
      together = run([tower, wing, unrelated]);
    assert.equal(together.count, 3);
    const cathedral = together.chunks.filter((c) =>
      (c.material as T.Material).name.startsWith("Cathedral Place"),
    );
    assert.equal(cathedral.length, 5);
    assert.equal(
      together.reflections.filter((p) => p.name.startsWith("Cathedral Place"))
        .length,
      1,
    );
    assert.deepEqual(
      signature(together.chunks.filter((c) => !cathedral.includes(c))),
      signature(isolated.chunks),
    );
    assert.deepEqual([tower, wing, unrelated], before);
    assert.deepEqual(
      contact(),
      priorContact,
      "existing public grade/body boundary unchanged",
    );
    const alone = run([tower]);
    assert.equal(alone.count, 1);
    assert.equal(alone.chunks.length, 5);
    assert.ok(
      alone.chunks.every((c) =>
        (c.material as T.Material).name.startsWith("Cathedral Place"),
      ),
      "generic tower/roof/parapets fully suppressed",
    );
  } finally {
    T.TextureLoader.prototype.load = priorLoad;
    if (priorDocument)
      Object.defineProperty(globalThis, "document", priorDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
