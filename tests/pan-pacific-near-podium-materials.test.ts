import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createPanPacificNearPodiumMaterials,
  createPanPacificNearPodiumGlazingMesh,
} from "../src/world/pan-pacific-near-podium-materials";
import { createPanPacificTowerMaterials } from "../src/world/pan-pacific-tower-materials";
import { createPanPacificHowePodiumMaterials } from "../src/world/pan-pacific-howe-podium-materials";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

test("near podium shares licensed image data without changing other Pan Pacific finishes", () => {
  const shared = new T.Texture<HTMLImageElement>();
  shared.repeat.set(7, 9);
  const requests: string[] = [];
  const library = { texture: () => shared };
  const tower = createPanPacificTowerMaterials(library);
  const howe = createPanPacificHowePodiumMaterials(library);
  const m = createPanPacificNearPodiumMaterials({
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
  for (const map of [
    m.concrete.map!,
    m.concrete.normalMap!,
    m.concrete.roughnessMap!,
  ]) {
    assert.equal(map.source, shared.source);
    assert.notEqual(map, shared);
    assert.deepEqual(map.repeat.toArray(), [0.5, 0.5]);
    assert.deepEqual(map.matrix.elements, m.concrete.map!.matrix.elements);
  }
  assert.equal(m.concrete.map!.colorSpace, T.SRGBColorSpace);
  assert.equal(m.concrete.normalMap!.colorSpace, T.NoColorSpace);
  assert.equal(m.concrete.roughnessMap!.colorSpace, T.NoColorSpace);
  assert.equal(m.soffit.map, m.concrete.map);
  const before = [tower, howe].map((other) => ({
    tint: other.concrete.color.clone(),
    throughput:
      other.glassPair.attenuation.uniforms.sheetThroughput.value.clone(),
    roughness: other.glassPair.reflection.roughness,
  }));
  m.concrete.map!.repeat.set(3, 4);
  m.concrete.color.setHex(0x998877);
  m.glassPair.attenuation.uniforms.sheetThroughput.value.set(0.1, 0.2, 0.3);
  m.glassPair.reflection.roughness = 0.7;
  [tower, howe].forEach((other, i) => {
    assert.deepEqual(other.concrete.map!.repeat.toArray(), [0.5, 0.5]);
    assert.ok(other.concrete.color.equals(before[i].tint));
    assert.ok(
      other.glassPair.attenuation.uniforms.sheetThroughput.value.equals(
        before[i].throughput,
      ),
    );
    assert.equal(other.glassPair.reflection.roughness, before[i].roughness);
  });
  assert.deepEqual(shared.repeat.toArray(), [7, 9]);
  assert.equal(shared.colorSpace, T.NoColorSpace);
});

test("near podium optics retain shared ordered draws and no emissive or painted rooms", () => {
  const m = createPanPacificNearPodiumMaterials({
    texture: () => new T.Texture(),
  });
  const geometry = new T.PlaneGeometry(8, 6);
  const panes = createPanPacificNearPodiumGlazingMesh(geometry, m.glassPair);
  const root = new T.Group();
  root.add(panes);
  assert.equal(batchStaticChunks(root, [panes], true).length, 0);
  assert.equal(panes.parent, root);
  assert.equal(geometry.groups.length, 0);
  assert.notEqual(panes.geometry, geometry);
  assert.deepEqual(
    panes.geometry.groups.map((g) => g.materialIndex),
    [0, 1],
  );
  assert.deepEqual(panes.material, [
    m.glassPair.attenuation,
    m.glassPair.reflection,
  ]);
  assert.equal(panes.castShadow, false);
  assert.equal(panes.userData.allowShadow, false);
  for (const material of panes.material) {
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, T.FrontSide);
    assert.equal(material.blendSrcAlpha, T.ZeroFactor);
    assert.equal(material.blendDstAlpha, T.OneFactor);
  }
  for (const material of [m.concrete, m.frame, m.backing, m.soffit]) {
    assert.equal(material.emissive.getHex(), 0);
    assert.equal(material.transparent, false);
    assert.equal(
      material.onBeforeCompile,
      T.Material.prototype.onBeforeCompile,
    );
  }
  assert.equal(m.glassPair.reflection.emissive.getHex(), 0);
  assert.equal(m.glassPair.reflection.metalness, 0);
  assert.equal(m.glassPair.reflection.transmission, 0);
  assert.equal(m.glassPair.reflection.map, null);
});
