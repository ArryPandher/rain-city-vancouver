import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createPanPacificHowePodiumMaterials,
  createPanPacificHowePodiumGlazingMesh,
} from "../src/world/pan-pacific-howe-podium-materials";
import { createCanadaPlaceHotelGlazingPair } from "../src/world/canada-place-hotel-glass";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

test("podium reuses licensed maps without changing another landmark's samplers or optics", () => {
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(7, 9);
  const requests: string[] = [];
  const west = createCanadaPlaceHotelGlazingPair();
  const westThroughput =
    west.attenuation.uniforms.sheetThroughput.value.clone();
  const materials = createPanPacificHowePodiumMaterials({
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
  const source = JSON.parse(
    fs.readFileSync("public/textures/canada-place-plinth/SOURCES.json", "utf8"),
  );
  assert.equal(source.license, "CC0-1.0");
  for (const path of requests)
    assert.ok(fs.statSync(`public/textures/${path}`).size > 0);
  assert.deepEqual(shared.repeat.toArray(), [7, 9]);
  assert.equal(shared.colorSpace, T.NoColorSpace);
  const { concrete, soffit, glassPair } = materials;
  for (const map of [
    concrete.map!,
    concrete.normalMap!,
    concrete.roughnessMap!,
  ]) {
    assert.notEqual(map, shared);
    assert.equal(map.source, shared.source);
    assert.deepEqual(map.repeat.toArray(), [0.5, 0.5]);
    assert.deepEqual(map.matrix.elements, concrete.map!.matrix.elements);
  }
  assert.equal(concrete.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(concrete.normalMap!.colorSpace, T.NoColorSpace);
  assert.equal(concrete.roughnessMap!.colorSpace, T.NoColorSpace);
  assert.equal(
    soffit.map,
    concrete.map,
    "same owned texture across the assembly",
  );
  glassPair.attenuation.uniforms.sheetThroughput.value.set(0.1, 0.2, 0.3);
  assert.ok(
    west.attenuation.uniforms.sheetThroughput.value.equals(westThroughput),
  );
  assert.equal(west.reflection.roughness, 0.12);
});

test("paired podium panes survive static batching in extinction/reflection order", () => {
  const materials = createPanPacificHowePodiumMaterials({
    texture: () => new T.Texture(),
  });
  const root = new T.Group();
  const input = new T.PlaneGeometry(4, 3);
  const glass = createPanPacificHowePodiumGlazingMesh(
    input,
    materials.glassPair,
  );
  root.add(glass);
  const opaque = [0, 1].map((i) => {
    const mesh = new T.Mesh(new T.BoxGeometry(1, 3, 1), materials.concrete);
    mesh.position.x = i * 3;
    root.add(mesh);
    return mesh;
  });
  assert.equal(batchStaticChunks(root, [...opaque, glass], true).length, 1);
  assert.equal(glass.parent, root);
  assert.equal(input.groups.length, 0, "caller geometry remains untouched");
  assert.notEqual(glass.geometry, input);
  assert.deepEqual(glass.geometry.groups, [
    { start: 0, count: input.index!.count, materialIndex: 0 },
    { start: 0, count: input.index!.count, materialIndex: 1 },
  ]);
  assert.equal(glass.material[0], materials.glassPair.attenuation);
  assert.equal(glass.material[1], materials.glassPair.reflection);
  assert.equal(glass.castShadow, false);
  assert.equal(glass.userData.allowShadow, false);
  for (const m of glass.material) {
    assert.equal(m.depthWrite, false);
    assert.equal(m.side, T.FrontSide);
    assert.equal(m.blendSrcAlpha, T.ZeroFactor);
    assert.equal(m.blendDstAlpha, T.OneFactor);
  }
  for (const m of [
    materials.concrete,
    materials.soffit,
    materials.frame,
    materials.backing,
  ]) {
    assert.equal(m.emissive.getHex(), 0);
    assert.equal(m.transparent, false);
    assert.equal(m.onBeforeCompile, T.Material.prototype.onBeforeCompile);
  }
  const reflection = materials.glassPair.reflection;
  assert.equal(reflection.emissive.getHex(), 0);
  assert.equal(reflection.metalness, 0);
  assert.equal(reflection.transmission, 0, "no new screen/refraction capture");
  assert.equal(reflection.map, null, "no baked room or facade grid");
});
