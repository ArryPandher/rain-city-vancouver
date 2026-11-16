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
  tower = data.buildings.find((b) => b.id === "w128409618")!,
  wing = data.buildings.find((b) => b.id === "w208599553")!;
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

test("live architecture dispatch emits one tower wrapper and suppresses its generic shell, foundation and details", () => {
  const before = structuredClone(tower),
    result = run([tower]);
  assert.equal(result.count, 1);
  assert.equal(result.reflections.length, 1);
  assert.equal(
    result.reflections[0].name,
    "Granville Square southeast exterior",
  );
  assert.equal(result.chunks.length, 7);
  assert.ok(
    result.chunks.every((c) =>
      (c.material as T.Material).name.startsWith("Granville Square"),
    ),
  );
  assert.equal(
    result.chunks.reduce((n, c) => n + c.geometry.index!.count / 3, 0),
    45540,
  );
  assert.equal(result.chunks.filter((c) => c.userData.detail).length, 0);
  assert.deepEqual(
    tower,
    before,
    "live source/collision record remains unchanged",
  );
  assert.ok(
    result.reflections[0].materials.every((m) =>
      result.chunks.some((c) => c.material === m),
    ),
  );
});

test("adding the tower leaves the finished Howe wing and unrelated generic building byte-identical", () => {
  try {
    const before = structuredClone([tower, wing, unrelated]),
      isolated = run([wing, unrelated]),
      together = run([tower, wing, unrelated]);
    assert.equal(together.count, 3);
    assert.equal(together.reflections.length, 2);
    const oldMaterialNames = new Set(
      isolated.chunks.map((c) => (c.material as T.Material).name),
    );
    assert.deepEqual(
      signature(
        together.chunks.filter((c) =>
          oldMaterialNames.has((c.material as T.Material).name),
        ),
      ),
      signature(isolated.chunks),
    );
    assert.deepEqual([tower, wing, unrelated], before);
    assert.ok(
      isolated.chunks.some((c) =>
        (c.material as T.Material).name.startsWith("Granville Square Howe"),
      ),
    );
    assert.ok(
      isolated.chunks.some((c) =>
        (c.material as T.Material).name.startsWith("generic-"),
      ),
    );
  } finally {
    T.TextureLoader.prototype.load = priorLoad;
    if (priorDocument)
      Object.defineProperty(globalThis, "document", priorDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("live canopy collision preserves the under-canopy route and adds only finite posts and roof support", () => {
  const site = collision.granvilleEntrance;
  assert.ok(site);
  for (const roof of site.roofs) {
    for (const d of [-1.25, -3.3]) {
      const [x, , z] = site.point((roof.left + roof.right) / 2, 0, d),
        floor = collision.baselineGroundHeight(x, z),
        original = collision.granvilleEntrance;
      collision.granvilleEntrance = undefined;
      const oldBlocked = collision.blocked(x, z, 0.35, floor),
        oldHeight = collision.walkingHeight(x, z, floor),
        oldDefault = collision.height(x, z);
      collision.granvilleEntrance = original;
      assert.equal(
        oldBlocked,
        false,
        "source walking strip must be open before adding the canopy",
      );
      assert.equal(collision.blocked(x, z, 0.35, floor), oldBlocked);
      assert.equal(collision.walkingHeight(x, z, floor), oldHeight);
      assert.equal(collision.height(x, z), oldDefault);
      if (d > roof.front) {
        const y = site.roofY(d);
        assert.equal(collision.cameraBlocked(x, z, 0.15, y), true);
        assert.equal(collision.blocked(x, z, 0.35, y - 0.3), true);
        assert.ok(Math.abs(collision.walkingHeight(x, z, y) - y) < 1e-10);
        assert.ok(Math.abs(collision.height(x, z, y) - y) < 1e-10);
      }
    }
  }
  for (const post of site.posts) {
    const [x, , z] = site.point(post.u, 0, post.d);
    assert.equal(collision.blocked(x, z, 0.3, post.low + 0.025), true);
  }
  const withoutTower = new CollisionWorld({ ...data, buildings: [] });
  assert.equal(withoutTower.granvilleEntrance, undefined);
});
