import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { architecture } from "../src/world/architecture";
import { World } from "../src/world/world";
import { CollisionWorld } from "../src/world/collision";
import {
  bounds,
  centroid,
  type CityData,
  type Building,
} from "../src/world/data";
import { Materials } from "../src/world/materials";

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
const raw = JSON.parse(
  fs.readFileSync("public/data/vancouver-east.json", "utf8"),
);
const tags = JSON.parse(
  fs.readFileSync("public/data/vancouver-building-tags.json", "utf8"),
).buildings;
const data: CityData = {
  ...raw,
  trees: [],
  pois: [],
  roads: JSON.parse(fs.readFileSync("public/data/vancouver-roads.json", "utf8"))
    .roads,
};
for (const b of data.buildings) {
  const attrs = tags[b.id];
  if (attrs) Object.assign(b, attrs, { levels: b.levels ?? attrs.levels });
}
const collision = new CollisionWorld(data);
const selected = data.buildings.filter((b) => {
  const [x, z] = centroid(b.pts);
  return x > 6550 && x < 7250 && z < -900 && z > -2050;
});
const towers = selected.filter((b) =>
  ["w195058432", "w195058435"].includes(b.id),
);
const neighbors = selected.filter((b) => !towers.includes(b));
const mat = (name: string) => new T.MeshStandardMaterial({ name });
function library() {
  return Object.assign(Object.create(Materials.prototype), {
    texture: () => new T.Texture(),
    facades: Array.from({ length: 12 }, (_, i) => mat(`generic-facade-${i}`)),
    photoFacades: [mat("generic-photo")],
    roof: mat("generic-roof"),
    concrete: mat("generic-foundation"),
    stone: mat("generic-stone"),
    chrome: mat("generic-chrome"),
    grass: mat("generic-grass"),
    asphalt: mat("generic-asphalt"),
    yellow: mat("generic-yellow"),
  }) as Materials;
}
function run(buildings: Building[]) {
  const root = new T.Group();
  const result = architecture(
    root,
    { ...data, buildings },
    library(),
    collision,
  );
  root.updateMatrixWorld(true);
  return { ...result, root };
}
function signature(chunks: T.Mesh[]) {
  return chunks
    .map((mesh) => {
      const hash = createHash("sha256");
      for (const name of Object.keys(mesh.geometry.attributes).sort()) {
        hash.update(name);
        const a = mesh.geometry.getAttribute(name).array;
        hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
      if (mesh.geometry.index)
        hash.update(Buffer.from(mesh.geometry.index.array.buffer));
      const m = mesh.material as T.MeshStandardMaterial;
      return [
        m.name,
        m.color?.getHex(),
        m.roughness,
        m.metalness,
        hash.digest("hex"),
      ].join();
    })
    .sort();
}
const rail = (m: T.Mesh) =>
  (m.material as T.Material).name.startsWith("Second Narrows railway ");
const triangleCount = (ms: T.Mesh[]) =>
  ms.reduce(
    (n, m) =>
      n + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3,
    0,
  );

test("actual architecture removes exactly both office shells and retains62 nearby buildings, ground and contact", () => {
  const priorBounds = { ...bounds };
  try {
    assert.equal(towers.length, 2);
    assert.equal(neighbors.length, 62);
    const before = JSON.stringify(data);
    const samples = [
      ...selected.map((b) => centroid(b.pts)),
      [6793.58, -962.67],
      [6803.5, -1449],
      [6940, -1500],
    ];
    const contacts = () =>
      samples.map(([x, z]) => [
        collision.groundHeight(x, z),
        collision.height(x, z, 0),
        collision.blocked(x, z, 0.36, 0),
      ]);
    const oldContacts = contacts();
    // Execute actual World terrain on the retained eastern areas/ocean. No mocked
    // land mask or height callback: only image loading/rasterization is stubbed.
    Object.assign(bounds, { maxX: 8200, minZ: -5600, maxZ: 2200 });
    const world = Object.assign(Object.create(World.prototype), {
      root: new T.Group(),
      chunks: [],
      data,
      collision,
      materials: library(),
      facadeMultiDraw: false,
      forestHabitat: { woodland: [] },
    }) as World;
    world.terrain();
    world.root.updateMatrixWorld(true);
    const terrain: T.Mesh[] = [];
    world.root.traverse((o) => {
      if (o instanceof T.Mesh) terrain.push(o);
    });
    const oldTerrain = signature(terrain);
    const surface = () =>
      samples.map(
        ([x, z]) =>
          new T.Raycaster(
            new T.Vector3(x, 100, z),
            new T.Vector3(0, -1, 0),
            0,
            110,
          ).intersectObject(world.root)[0]?.point.y,
      );
    const oldSurface = surface();
    for (const b of towers) {
      const [x, z] = centroid(b.pts);
      assert.equal(
        collision.groundHeight(x, z),
        0,
        "absolute-datum rail batch receives no ground offset",
      );
      const hit = new T.Raycaster(
        new T.Vector3(x, 100, z),
        new T.Vector3(0, -1, 0),
        0,
        110,
      ).intersectObject(world.root)[0];
      assert.ok(
        hit && (hit.object as T.Mesh).material === world.water,
        "real inlet remains water",
      );
    }
    const isolated = run(neighbors),
      combined = run(selected),
      pair = run(towers);
    const newRail = combined.chunks.filter(rail);
    assert.equal(combined.count, isolated.count + 2);
    assert.equal(newRail.length, 11);
    assert.equal(triangleCount(newRail), 27208);
    assert.deepEqual(
      signature(combined.chunks.filter((m) => !rail(m))),
      signature(isolated.chunks),
    );
    assert.ok(
      pair.chunks.every(rail),
      "no generic roof, wall or parapet survives either replacement",
    );
    assert.equal(pair.chunks.length, 11);
    // Atomic preflight naturally falls back when only one original tower is
    // present. This exercises each old office with the exact same ID and geometry,
    // without altering its seed, shape, height or source material choice.
    const originals = towers.map((b) => run([b]));
    assert.ok(
      originals.every((r) =>
        r.chunks.some((m) =>
          (m.material as T.Material).name.startsWith("generic-facade"),
        ),
      ),
    );
    assert.ok(originals.every((r) => !r.chunks.some(rail)));
    const oldTriangles = originals.reduce(
      (n, r) => n + triangleCount(r.chunks),
      0,
    );
    assert.equal(oldTriangles, 20);
    // Turn off only the new strict preflight using an obsolete level hint while
    // keeping the authoritative30m height. First prove that this hint does not
    // change the old tower's actual geometry/materials at all.
    const fallback = structuredClone(selected);
    const edited = fallback.find((b) => b.id === towers[0].id)!;
    edited.levels! += 1;
    assert.deepEqual(
      signature(run([edited]).chunks),
      signature(originals[0].chunks),
    );
    const oldWhole = run(fallback);
    assert.ok(!oldWhole.chunks.some(rail));
    assert.equal(
      triangleCount(combined.chunks) - triangleCount(oldWhole.chunks),
      27188,
    );
    assert.equal(oldWhole.chunks.length, 46);
    assert.equal(combined.chunks.length, 53);
    assert.deepEqual(signature(terrain), oldTerrain);
    assert.deepEqual(surface(), oldSurface);
    assert.deepEqual(contacts(), oldContacts);
    assert.equal(JSON.stringify(data), before);
  } finally {
    Object.assign(bounds, priorBounds);
    T.TextureLoader.prototype.load = priorLoad;
    if (priorDocument)
      Object.defineProperty(globalThis, "document", priorDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
