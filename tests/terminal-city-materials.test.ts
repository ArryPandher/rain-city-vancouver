import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createTerminalCityMaterials,
  createTerminalCityClubMaterials,
  TERMINAL_CITY_MINERAL_REPEAT_METRES,
} from "../src/world/terminal-city-materials";
import { bakeGeometry } from "../src/world/geometry";

test("club copies only environment receivers, preserving tower surface parameters", () => {
  const tower = createTerminalCityMaterials({ texture: () => new T.Texture() });
  const borrowed = new T.CubeTexture();
  tower.glass.envMap = tower.spandrel.envMap = borrowed;
  const club = createTerminalCityClubMaterials(tower);
  for (const key of ["stone", "metal", "dark", "roof"] as const)
    assert.equal(club[key], tower[key]);
  for (const key of ["glass", "spandrel"] as const) {
    assert.notEqual(club[key], tower[key]);
    assert.equal(club[key].envMap, null);
    assert.equal(tower[key].envMap, borrowed);
    assert.ok(club[key].color.equals(tower[key].color));
    for (const value of [
      "roughness",
      "metalness",
      "envMapIntensity",
      "opacity",
      "transparent",
      "depthWrite",
      "side",
    ] as const)
      assert.equal(club[key][value], tower[key][value]);
    assert.equal(club[key].map, tower[key].map);
    assert.equal(club[key].normalMap, tower[key].normalMap);
  }
  for (const key of [
    "clearcoat",
    "clearcoatRoughness",
    "ior",
    "transmission",
    "specularIntensity",
  ] as const)
    assert.equal(club.glass[key], tower.glass[key]);
  club.glass.color.set(0xff0000);
  assert.ok(
    !club.glass.color.equals(tower.glass.color),
    "mutable color state is independent",
  );
});

test("dedicated materials preserve shared library state and use the licensed granular crop", () => {
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(7, 9);
  const requests: string[] = [];
  const m = createTerminalCityMaterials({
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
    assert.deepEqual(texture.repeat.toArray(), [1 / 1.5, 1 / 1.5]);
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
    0.92,
    "estimated honed mineral response keeps effective roughness near .68–.79",
  );
});
test("opaque standard paths retain continuous reflection, no window grid or emissive daytime fill", () => {
  const m = createTerminalCityMaterials({ texture: () => new T.Texture() });
  assert.equal(Object.values(m).length, 6);
  assert.equal(new Set(Object.values(m)).size, 6);
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
  assert.ok(
    m.glass.color.g > m.glass.color.b && m.glass.color.b > m.glass.color.r,
  );
  assert.ok(
    m.stone.color.r > m.stone.color.b,
    "warm mineral tint without a new image asset",
  );
});
test("metre UV registration survives world transformation/baking without pane-size retile", () => {
  const m = createTerminalCityMaterials({ texture: () => new T.Texture() });
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
  assert.ok(
    Math.abs(b.x - a.x - 1 / TERMINAL_CITY_MINERAL_REPEAT_METRES) < 1e-12,
  );
  assert.deepEqual(
    m.stone.map!.matrix.elements,
    m.stone.normalMap!.matrix.elements,
  );
  assert.deepEqual(
    m.stone.map!.matrix.elements,
    m.stone.roughnessMap!.matrix.elements,
  );
});
