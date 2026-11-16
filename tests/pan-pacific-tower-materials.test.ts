import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  createPanPacificTowerMaterials,
  createPanPacificTowerGlazingMesh,
} from "../src/world/pan-pacific-tower-materials";
import { createPanPacificHowePodiumMaterials } from "../src/world/pan-pacific-howe-podium-materials";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

test("tower calibration and sampler state cannot change the accepted podium", () => {
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(7, 9);
  const library = { texture: () => shared };
  const podium = createPanPacificHowePodiumMaterials(library);
  const tower = createPanPacificTowerMaterials(library);
  const podiumTint = podium.concrete.color.clone();
  const podiumThroughput =
    podium.glassPair.attenuation.uniforms.sheetThroughput.value.clone();
  assert.notEqual(tower.concrete.map, podium.concrete.map);
  assert.equal(tower.concrete.map!.source, podium.concrete.map!.source);
  tower.concrete.color.setHex(0x778899);
  tower.concrete.map!.repeat.set(0.2, 0.3);
  tower.glassPair.attenuation.uniforms.sheetThroughput.value.set(0.1, 0.2, 0.3);
  tower.glassPair.reflection.roughness = 0.5;
  assert.ok(podium.concrete.color.equals(podiumTint));
  assert.deepEqual(podium.concrete.map!.repeat.toArray(), [0.5, 0.5]);
  assert.deepEqual(shared.repeat.toArray(), [7, 9]);
  assert.equal(shared.colorSpace, T.NoColorSpace);
  assert.ok(
    podium.glassPair.attenuation.uniforms.sheetThroughput.value.equals(
      podiumThroughput,
    ),
  );
  assert.equal(podium.glassPair.reflection.roughness, 0.14);
});

test("tower mineral maps retain licensed matched metre sampling and no emissive room fill", () => {
  const requested: string[] = [];
  const m = createPanPacificTowerMaterials({
    texture: (name) => {
      requested.push(name);
      return new T.Texture<HTMLImageElement>();
    },
  });
  assert.deepEqual(requested, [
    "canada-place-plinth/color.webp",
    "canada-place-plinth/normal.webp",
    "canada-place-plinth/roughness.webp",
  ]);
  const source = JSON.parse(
    fs.readFileSync("public/textures/canada-place-plinth/SOURCES.json", "utf8"),
  );
  assert.equal(source.license, "CC0-1.0");
  for (const path of requested)
    assert.ok(fs.statSync(`public/textures/${path}`).size > 0);
  const maps = [
    m.concrete.map!,
    m.concrete.normalMap!,
    m.concrete.roughnessMap!,
  ];
  for (const map of maps) {
    assert.deepEqual(map.repeat.toArray(), [0.5, 0.5]);
    assert.deepEqual(map.matrix.elements, maps[0].matrix.elements);
  }
  assert.equal(maps[0].colorSpace, T.SRGBColorSpace);
  assert.equal(maps[1].colorSpace, T.NoColorSpace);
  assert.equal(maps[2].colorSpace, T.NoColorSpace);
  for (const material of [m.concrete, m.frame, m.backing, m.roof]) {
    assert.equal(
      material.onBeforeCompile,
      T.Material.prototype.onBeforeCompile,
    );
    assert.equal(material.emissive.getHex(), 0);
    assert.equal(material.transparent, false);
  }
  assert.equal(m.glassPair.reflection.emissive.getHex(), 0);
  assert.equal(m.glassPair.reflection.transmission, 0);
  assert.equal(m.glassPair.reflection.metalness, 0);
  assert.equal(m.glassPair.reflection.map, null);
  assert.equal(m.glassPair.reflection.clearcoat, 0);
});

test("coherent tower faces share optics while ordered groups survive static batching", () => {
  const m = createPanPacificTowerMaterials({ texture: () => new T.Texture() });
  const input = new T.PlaneGeometry(10, 20);
  const faces = [0, 1].map(() =>
    createPanPacificTowerGlazingMesh(input, m.glassPair),
  );
  const root = new T.Group();
  root.add(...faces);
  assert.equal(batchStaticChunks(root, faces, true).length, 0);
  assert.equal(root.children.length, 2);
  assert.equal(input.groups.length, 0);
  assert.notEqual(faces[0].geometry, faces[1].geometry);
  for (const face of faces) {
    assert.deepEqual(face.material, [
      m.glassPair.attenuation,
      m.glassPair.reflection,
    ]);
    assert.deepEqual(
      face.geometry.groups.map((g) => g.materialIndex),
      [0, 1],
    );
    assert.equal(face.castShadow, false);
    assert.equal(face.userData.allowShadow, false);
    for (const material of face.material) {
      assert.equal(material.side, T.FrontSide);
      assert.equal(material.depthWrite, false);
      assert.equal(material.blendSrcAlpha, T.ZeroFactor);
      assert.equal(material.blendDstAlpha, T.OneFactor);
    }
  }
});
