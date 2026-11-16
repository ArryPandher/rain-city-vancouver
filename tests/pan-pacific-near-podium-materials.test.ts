import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createPanPacificNearPodiumMaterials,
  createPanPacificNearPodiumGlazingMesh,
} from "../src/world/pan-pacific-near-podium-materials";
import { createPanPacificTowerMaterials } from "../src/world/pan-pacific-tower-materials";
import { createPanPacificHowePodiumMaterials } from "../src/world/pan-pacific-howe-podium-materials";
import { createPanPacificNearPodium } from "../src/world/pan-pacific-near-podium-install";
import { createCanadaPlaceHotelGlazingPair } from "../src/world/canada-place-hotel-glass";
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
    if (material !== m.concrete)
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

test("installed near reflection uses candidate roughness without changing paired extinction or other hotel optics", () => {
  const library = { texture: () => new T.Texture() };
  const tower = createPanPacificTowerMaterials(library),
    howe = createPanPacificHowePodiumMaterials(library),
    hotel = createCanadaPlaceHotelGlazingPair(),
    installed = createPanPacificNearPodium(library);
  const pane = installed.group.getObjectByName(
    "pan-pacific-near-podium-glass",
  ) as T.Mesh<T.BufferGeometry, [T.ShaderMaterial, T.MeshPhysicalMaterial]>;
  assert.ok(pane);
  const [extinction, reflection] = pane.material;
  assert.equal(
    installed.glass,
    reflection,
    "probe receiver is the same reflection pass installed on every merged pane",
  );
  assert.equal(reflection.roughness, 0.06);
  assert.equal(reflection.roughnessMap, null);
  assert.equal(reflection.normalMap, null);
  assert.equal(reflection.ior, 1.8);
  assert.equal(extinction.uniforms.sheetIor.value, 1.8);
  assert.deepEqual(
    extinction.uniforms.sheetThroughput.value.toArray(),
    [0.55, 0.74, 0.8],
  );
  assert.equal(reflection.envMapIntensity, 0.85);
  assert.equal(extinction.blendSrc, T.ZeroFactor);
  assert.equal(extinction.blendDst, T.SrcColorFactor);
  assert.equal(reflection.blendSrc, T.OneFactor);
  assert.equal(reflection.blendDst, T.OneFactor);
  assert.equal(reflection.fog, false);
  assert.equal(extinction.fog, false);
  assert.deepEqual(
    pane.geometry.groups.map((g) => [g.start, g.count, g.materialIndex]),
    [
      [0, pane.geometry.index!.count, 0],
      [0, pane.geometry.index!.count, 1],
    ],
  );
  assert.equal(
    installed.group.children.length,
    5,
    "four opaque surfaces and one paired receiver; no separate proxy is left at old roughness",
  );
  const backing = installed.group.getObjectByName(
    "pan-pacific-near-podium-backing",
  ) as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  assert.equal(backing.material.color.getHex(), 0x253339);
  assert.equal(backing.material.roughness, 0.93);
  assert.deepEqual(
    [
      tower.glassPair.reflection.roughness,
      howe.glassPair.reflection.roughness,
      hotel.reflection.roughness,
    ],
    [0.12, 0.14, 0.12],
  );
  assert.deepEqual(
    [
      tower.glassPair.reflection.ior,
      howe.glassPair.reflection.ior,
      hotel.reflection.ior,
    ],
    [1.5, 1.5, 1.5],
  );
});
