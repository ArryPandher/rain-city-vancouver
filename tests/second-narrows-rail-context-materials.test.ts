import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { SharedTextureSources } from "../src/world/shared-texture-sources";
import { createRailContextMeshes } from "../src/world/second-narrows-rail-context-materials";
import { createSecondNarrowsRailContext } from "../src/world/second-narrows-rail-context";
import type { CityData } from "../src/world/data";
const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver-east.json", "utf8"),
);
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
const context = createSecondNarrowsRailContext(data)!;
test("actual bank meshes retain all geometry/UV/contact while earth and cap get metric licensed surface maps", () => {
  const before = Object.fromEntries(
    Object.entries(context.parts).map(([key, g]) => [
      key,
      Object.fromEntries(
        Object.entries(g.attributes).map(([name, a]) => [
          name,
          Array.from(a.array),
        ]),
      ),
    ]),
  );
  const calls: string[] = [],
    meshes = createRailContextMeshes(context, {
      texture: (name) => {
        calls.push(name);
        return new T.Texture();
      },
    });
  assert.equal(meshes.length, 5);
  for (const [i, key] of Object.keys(context.parts).entries()) {
    const g = context.parts[key as keyof typeof context.parts];
    assert.equal(meshes[i].geometry, g);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(g.attributes).map(([name, a]) => [
          name,
          Array.from(a.array),
        ]),
      ),
      before[key],
    );
  }
  const ground = meshes.find((m) => m.material.name.includes("planted earth"))!
    .material as T.MeshStandardMaterial;
  for (const map of [ground.map!, ground.normalMap!, ground.roughnessMap!]) {
    assert.deepEqual(map.repeat.toArray(), [0.25, 0.25]);
    assert.ok(
      Math.abs(new T.Vector2(4, 0).applyMatrix3(map.matrix).x - 1) < 1e-12,
    );
    assert.equal(map.wrapS, T.RepeatWrapping);
  }
  assert.equal(ground.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(ground.normalMap!.colorSpace, T.NoColorSpace);
  assert.equal(ground.roughnessMap!.colorSpace, T.NoColorSpace);
  assert.equal(ground.color.getHex(), 0xa5af98);
  const cap = meshes.find((m) => m.material.name.includes("abutment"))!
    .material as T.MeshStandardMaterial;
  assert.equal(cap.color.getHex(), 0x96988c);
  assert.equal(cap.map, null);
  assert.deepEqual(cap.normalMap!.repeat.toArray(), [1.25, 1.25]);
  const manifest = JSON.parse(
    fs.readFileSync("public/asset-manifest.json", "utf8"),
  );
  for (const name of calls) {
    const item = manifest.find(
      (r: { file: string }) => r.file === `textures/${name}`,
    );
    assert.ok(item, `${name} must have existing provenance`);
    assert.ok(item.license.includes("CC0"));
  }
});
test("delayed Sources propagate to independent wrappers and every consumer map is disposed exactly once", () => {
  const pending = new Map<
    string,
    { texture: T.Texture; done: (t: T.Texture) => void }
  >();
  const cache = new SharedTextureSources({
    load: (name: string, done?: (t: T.Texture) => void) => {
      const t = new T.Texture();
      pending.set(name, { texture: t, done: done! });
      return t;
    },
  } as Pick<T.TextureLoader, "load">);
  const returned: T.Texture[] = [],
    library = {
      texture: (name: string) => {
        const t = cache.texture(name);
        returned.push(t);
        return t;
      },
    };
  const first = createRailContextMeshes(context, library),
    second = createRailContextMeshes(context, library);
  assert.equal(returned.length, 14);
  assert.equal(cache.stats.sourceLoads, 6);
  const firstMaps = first.flatMap((m) => {
    const a = m.material as T.MeshStandardMaterial;
    return [a.map, a.normalMap, a.roughnessMap].filter(
      (t): t is T.Texture => !!t,
    );
  });
  assert.deepEqual(
    new Set(firstMaps),
    new Set(returned.slice(0, 7)),
    "no abandoned extra consumer clones",
  );
  const a = first[0].material as T.MeshStandardMaterial,
    b = second[0].material as T.MeshStandardMaterial;
  assert.notEqual(a.map, b.map);
  assert.equal(a.map!.source, b.map!.source);
  a.map!.repeat.set(2, 2);
  assert.deepEqual(b.map!.repeat.toArray(), [0.25, 0.25]);
  for (const { texture, done } of pending.values()) {
    texture.image = { width: 2, height: 2 };
    texture.needsUpdate = true;
    done(texture);
  }
  assert.equal((a.map!.image as { width: number }).width, 2);
  assert.equal((b.map!.image as { width: number }).width, 2);
  let own = 0,
    other = 0;
  for (const t of returned.slice(0, 7))
    t.addEventListener("dispose", () => own++);
  for (const t of returned.slice(7))
    t.addEventListener("dispose", () => other++);
  for (const m of first) {
    m.material.dispose();
    m.material.dispose();
  }
  assert.equal(own, 7);
  assert.equal(other, 0);
  assert.equal((b.map!.image as { width: number }).width, 2);
});
