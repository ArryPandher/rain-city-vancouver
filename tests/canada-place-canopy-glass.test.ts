import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { WebGLRenderList } from "three/src/renderers/webgl/WebGLRenderLists.js";
import {
  createCanadaPlaceCanopyGlazingPair,
  createCanadaPlaceCanopyGlazingMesh,
} from "../src/world/canada-place-canopy-glass";
import { createCanadaPlaceConcourseExtinctionPair } from "../src/world/canada-place-concourse-glass";

test("canopy extinction and reflection preserve energy and independent hall calibration", () => {
  const hall = createCanadaPlaceConcourseExtinctionPair(),
    pair = createCanadaPlaceCanopyGlazingPair();
  const before = hall.attenuation.uniforms.sheetThroughput.value.clone();
  assert.equal(pair.reflection.name, "canada-canopy-glass");
  assert.equal(pair.attenuation.name, "canada-canopy-glass-attenuation");
  assert.equal(pair.attenuation.blendSrc, T.ZeroFactor);
  assert.equal(pair.attenuation.blendDst, T.SrcColorFactor);
  assert.equal(pair.reflection.blendSrc, T.OneFactor);
  assert.equal(pair.reflection.blendDst, T.OneFactor);
  for (const cosine of [0, 0.1, 0.5, 1]) {
    const ior = pair.reflection.ior,
      f0 = ((ior - 1) / (ior + 1)) ** 2,
      f = f0 + (1 - f0) * (1 - cosine) ** 5;
    for (const throughput of pair.attenuation.uniforms.sheetThroughput.value.toArray()) {
      const t = throughput * (1 - f);
      assert.ok(t >= 0 && f + t <= 1 + 1e-9);
    }
  }
  for (const material of [pair.attenuation, pair.reflection]) {
    assert.equal(material.blendSrcAlpha, T.ZeroFactor);
    assert.equal(material.blendDstAlpha, T.OneFactor);
    assert.equal(material.depthWrite, false);
    assert.equal(material.transparent, true);
    assert.equal(material.side, T.FrontSide);
    assert.equal(material.fog, false);
    assert.equal(material.userData.castShadow, false);
  }
  assert.equal(pair.reflection.transmission, 0);
  assert.equal(pair.reflection.emissive.getHex(), 0);
  const shader = { ...T.ShaderLib.physical, uniforms: {} };
  pair.reflection.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
  assert.ok(shader.fragmentShader.includes("outgoingLight=totalSpecular;"));
  pair.attenuation.uniforms.sheetThroughput.value.set(0, 0, 0);
  pair.reflection.roughness = 0.8;
  assert.deepEqual(
    hall.attenuation.uniforms.sheetThroughput.value.toArray(),
    before.toArray(),
  );
  assert.notEqual(hall.reflection.roughness, pair.reflection.roughness);
});

test("canopy groups remain paired through installed transparent sorting, with source geometry intact", () => {
  const pair = createCanadaPlaceCanopyGlazingPair(),
    geometry = new T.PlaneGeometry(2, 3);
  geometry.addGroup(0, 3, 0);
  const front = createCanadaPlaceCanopyGlazingMesh(geometry, pair),
    end = createCanadaPlaceCanopyGlazingMesh(geometry, pair);
  assert.equal(geometry.groups.length, 1);
  assert.equal(front.name, "canada-canopy-glass");
  assert.equal(front.material[1], end.material[1]);
  assert.equal(front.castShadow, false);
  assert.equal(front.userData.allowShadow, false);
  assert.equal(front.renderOrder, 0);
  assert.deepEqual(
    front.geometry.groups.map((g) => [g.start, g.count, g.materialIndex]),
    [
      [0, 6, 0],
      [0, 6, 1],
    ],
  );
  // Installed runtime takes no constructor args and stores GeometryGroup;
  // @types/three still describes an older internal API with Object3D Group.
  type GeometryGroup = T.BufferGeometry["groups"][number];
  const RuntimeRenderList = WebGLRenderList as unknown as new () => {
    init(): void;
    push(
      object: T.Object3D,
      geometry: T.BufferGeometry,
      material: T.Material,
      groupOrder: number,
      z: number,
      group: GeometryGroup,
    ): void;
    sort(): void;
    transparent: { object: T.Object3D; group: GeometryGroup }[];
  };
  const list = new RuntimeRenderList();
  list.init();
  for (const [mesh, z] of [
    [front, 2],
    [end, 4],
  ] as const)
    for (const group of mesh.geometry.groups)
      list.push(
        mesh,
        mesh.geometry,
        mesh.material[group.materialIndex!],
        0,
        z,
        group,
      );
  list.sort();
  assert.deepEqual(
    list.transparent.map((r) => [r.object.id, r.group!.materialIndex]),
    [
      [end.id, 0],
      [end.id, 1],
      [front.id, 0],
      [front.id, 1],
    ],
  );
  geometry.dispose();
  front.geometry.dispose();
  end.geometry.dispose();
  pair.attenuation.dispose();
  pair.reflection.dispose();
});
