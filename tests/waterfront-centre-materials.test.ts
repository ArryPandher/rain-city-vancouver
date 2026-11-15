import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createWaterfrontCentreMaterials,
  WATERFRONT_MINERAL_REPEAT_METRES,
} from "../src/world/waterfront-centre-materials";
import { bakeGeometry } from "../src/world/geometry";

test("dedicated materials preserve shared library state and use the licensed granular crop", () => {
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(7, 9);
  const requests: string[] = [];
  const m = createWaterfrontCentreMaterials({
    texture: (name) => {
      requests.push(name);
      return shared;
    },
  });
  assert.deepEqual(requests, [
    "canada-place-plinth/color.webp",
    "canada-place-plinth/normal.webp",
    "canada-place-plinth/roughness.webp",
  ]);
  assert.deepEqual(shared.repeat.toArray(), [7, 9]);
  assert.equal(shared.colorSpace, T.NoColorSpace);
  for (const texture of [
    m.stone.map!,
    m.stone.normalMap!,
    m.stone.roughnessMap!,
  ]) {
    assert.notEqual(texture, shared);
    assert.equal(texture.source, shared.source);
    assert.deepEqual(texture.repeat.toArray(), [0.5, 0.5]);
  }
  assert.equal(m.stone.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(m.stone.normalMap!.colorSpace, T.NoColorSpace);
  const source = JSON.parse(
    fs.readFileSync("public/textures/canada-place-plinth/SOURCES.json", "utf8"),
  );
  assert.equal(source.license, "CC0-1.0");
  for (const path of requests)
    assert.ok(fs.statSync(`public/textures/${path}`).size > 0);
  assert.equal(
    m.stone.roughness,
    1,
    "retain the map's bounded .74–.86 effective roughness rather than multiply it down",
  );
});
test("opaque standard paths retain continuous reflection, no window grid or emissive daytime fill", () => {
  const m = createWaterfrontCentreMaterials({ texture: () => new T.Texture() });
  assert.equal(Object.values(m).length, 8);
  assert.equal(new Set(Object.values(m)).size, 8);
  for (const material of Object.values(m)) {
    assert.ok(material instanceof T.MeshStandardMaterial);
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.emissive.getHex(), 0);
    assert.equal(
      material.onBeforeCompile,
      T.Material.prototype.onBeforeCompile,
      "unmodified Three shader path",
    );
  }
  assert.equal(m.glass.transmission, 0);
  assert.equal(m.glass.map, null);
  assert.equal(m.glass.normalMap, null);
  assert.ok(m.glass.roughness < m.metal.roughness);
  assert.ok(m.glass.color.b > m.glass.color.r);
});
test("metre UV registration survives world transformation/baking without pane-size retile", () => {
  const m = createWaterfrontCentreMaterials({ texture: () => new T.Texture() });
  const g = new T.PlaneGeometry(4, 3);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 3);
  const transform = new T.Matrix4()
      .makeRotationY(0.72)
      .setPosition(344.199, 35, -512.68),
    baked = bakeGeometry(g, transform);
  assert.deepEqual(Array.from(baked.attributes.uv.array), Array.from(uv.array));
  const a = new T.Vector2(0.2, 0.3).applyMatrix3(m.stone.map!.matrix),
    b = new T.Vector2(1.2, 0.3).applyMatrix3(m.stone.map!.matrix);
  assert.ok(Math.abs(b.x - a.x - 1 / WATERFRONT_MINERAL_REPEAT_METRES) < 1e-12);
  assert.deepEqual(
    m.stone.map!.matrix.elements,
    m.stone.normalMap!.matrix.elements,
  );
  assert.deepEqual(
    m.stone.map!.matrix.elements,
    m.stone.roughnessMap!.matrix.elements,
  );
});
