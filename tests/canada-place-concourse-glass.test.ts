import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { createCanadaPlaceConcourseGlass } from "../src/world/canada-place-concourse-glass";

test("upper glazing uses dielectric Fresnel rather than the old metallic reflection floor", () => {
  const material = createCanadaPlaceConcourseGlass();
  const f0 =
    ((material.ior - 1) / (material.ior + 1)) ** 2 * material.specularIntensity;
  assert.ok(
    f0 >= 0.035 && f0 <= 0.045,
    "ordinary glass reflects about four percent at normal incidence",
  );
  assert.equal(material.metalness, 0);
  assert.equal(
    material.specularColor.getHex(),
    0xffffff,
    "dielectric reflection is untinted; body colour supplies blue-green proxy",
  );
  const previousColour = new T.Color(0x91aaa2);
  const previousGreenF0 = 0.04 * (1 - 0.58) + previousColour.g * 0.58;
  assert.ok(
    previousGreenF0 > f0 * 5,
    "material removes the prior high-reflectance metal floor",
  );
  const grazing = f0 + (1 - f0) * (1 - 0.05) ** 5;
  assert.ok(
    grazing > 0.75,
    "normal Fresnel still retains harbour reflection at grazing views",
  );
  assert.ok(material.roughness > 0.14 && material.roughness < 0.3);
  material.dispose();
});

test("upper proxy needs no transmission pass and accepts the existing shared probe", () => {
  const a = createCanadaPlaceConcourseGlass(),
    b = createCanadaPlaceConcourseGlass();
  const sharedProbe = new T.CubeTexture();
  a.envMap = sharedProbe;
  a.needsUpdate = true;
  assert.equal(a.name, "canada-west-glass");
  assert.equal(a.envMap, sharedProbe);
  assert.equal(b.envMap, null, "each scene owns its own material");
  assert.equal(a.transmission, 0);
  assert.equal(a.clearcoat, 0, "no second coat doubles the highlight");
  assert.equal(a.transparent, true);
  assert.equal(a.depthWrite, false);
  assert.equal(a.map, null);
  assert.equal(a.normalMap, null);
  assert.equal(a.emissive.getHex(), 0);
  assert.equal(
    a.envMapIntensity,
    0.8,
    "matches current loader probe intensity",
  );
  a.dispose();
  b.dispose();
  sharedProbe.dispose();
});

test("thin-sheet shader and static batch preserve closed-backing visibility and shadow semantics", () => {
  const material = createCanadaPlaceConcourseGlass();
  const shader = { ...T.ShaderLib.physical, uniforms: {} };
  material.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
  assert.ok(shader.fragmentShader.includes("concourseFacing"));
  assert.ok(
    shader.fragmentShader.includes(
      "diffuseColor.a=mix(opacity,0.96,concourseGrazing)",
    ),
  );
  assert.equal(
    (shader.fragmentShader.match(/float concourseFacing/g) ?? []).length,
    1,
  );
  assert.ok(shader.fragmentShader.includes("#include <opaque_fragment>"));
  // Normal view must reveal actual backing; grazing reduces that visibility.
  const coverage = (cosine: number) =>
    material.opacity + (0.96 - material.opacity) * (1 - cosine) ** 5;
  assert.ok(1 - coverage(1) > 0.5);
  assert.ok(1 - coverage(0.05) < 0.2);
  const batch = new Batcher(new T.Group(), 400);
  batch.add(new T.PlaneGeometry(2, 2), material, 0, 0);
  const [mesh] = batch.finish();
  assert.equal(mesh.material, material);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.userData.allowShadow, false);
  assert.equal(mesh.receiveShadow, true);
  assert.equal((mesh.material as T.Material).depthWrite, false);
  assert.equal(
    (mesh.material as T.Material).onBeforeCompile,
    material.onBeforeCompile,
  );
  assert.match(material.customProgramCacheKey(), /thin-sheet/);
  mesh.geometry.dispose();
  material.dispose();
});

test("candidate composites reflection once, preserves destination transmission and leaves baseline unchanged", async () => {
  const { createCanadaPlaceConcourseReflectionCandidate } = await import(
    "../src/world/canada-place-concourse-glass"
  );
  const candidate = createCanadaPlaceConcourseReflectionCandidate();
  const baseline = createCanadaPlaceConcourseGlass();
  assert.equal(baseline.blending, T.NormalBlending);
  assert.equal(baseline.opacity, 0.42);
  assert.equal(candidate.blending, T.CustomBlending);
  assert.equal(candidate.blendSrc, T.OneFactor);
  assert.equal(candidate.blendDst, T.OneMinusSrcAlphaFactor);
  assert.equal(candidate.premultipliedAlpha, false);
  assert.equal(candidate.transmission, 0);
  assert.equal(candidate.envMapIntensity, baseline.envMapIntensity);
  const shader = { ...T.ShaderLib.physical, uniforms: {} };
  candidate.onBeforeCompile(shader as never, {} as T.WebGLRenderer);
  assert.ok(shader.fragmentShader.includes("outgoingLight=totalSpecular;"));
  assert.ok(
    shader.fragmentShader.includes("diffuseColor.a=1.0-sheetTransmittance;"),
  );
  assert.ok(!shader.fragmentShader.includes("concourseGrazing"));
  // Uniform radiance limit: R + T <= 1, with absorption, at every angle.
  for (const cosine of [0, 0.05, 0.25, 0.5, 0.75, 1]) {
    const f0 = ((candidate.ior - 1) / (candidate.ior + 1)) ** 2;
    const reflection = f0 + (1 - f0) * (1 - cosine) ** 5;
    const transmission = 0.88 * (1 - reflection);
    const alpha = 1 - transmission;
    const blended = reflection * 1 + 1 * (1 - alpha);
    assert.ok(blended <= 1 + 1e-9);
    assert.ok(Math.abs(blended - (reflection + transmission)) < 1e-9);
    if (cosine === 1) assert.ok(transmission > 0.84 && transmission < 0.85);
  }
  const batch = new Batcher(new T.Group(), 400);
  batch.add(new T.PlaneGeometry(2, 2), candidate, 0, 0);
  const [mesh] = batch.finish();
  assert.equal(mesh.material, candidate);
  assert.equal(mesh.castShadow, false);
  assert.equal(candidate.depthWrite, false);
  assert.equal(
    candidate.onBeforeCompile,
    (mesh.material as T.Material).onBeforeCompile,
  );
  // Clone callers must explicitly reset blending even though hooks aren't copied.
  const opaque = candidate.clone();
  assert.equal(opaque.blending, T.CustomBlending);
  assert.notEqual(opaque.onBeforeCompile, candidate.onBeforeCompile);
  mesh.geometry.dispose();
  candidate.dispose();
  baseline.dispose();
  opaque.dispose();
});

test("RGB pair implements channel transmission then adds reflection without changing framebuffer alpha", async () => {
  const {
    createCanadaPlaceConcourseExtinctionPair,
    createCanadaPlaceConcourseExtinctionMesh,
    CANADA_PLACE_LINEAR_THROUGHPUT,
  } = await import("../src/world/canada-place-concourse-glass");
  const pair = createCanadaPlaceConcourseExtinctionPair();
  assert.deepEqual(
    pair.attenuation.uniforms.sheetThroughput.value.toArray(),
    [0.62, 0.88, 0.76],
  );
  assert.equal(pair.attenuation.blendSrc, T.ZeroFactor);
  assert.equal(pair.attenuation.blendDst, T.SrcColorFactor);
  assert.equal(pair.reflection.blendSrc, T.OneFactor);
  assert.equal(pair.reflection.blendDst, T.OneFactor);
  for (const material of [pair.attenuation, pair.reflection]) {
    assert.equal(material.blendSrcAlpha, T.ZeroFactor);
    assert.equal(material.blendDstAlpha, T.OneFactor);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.fog, false);
  }
  assert.equal(pair.attenuation.toneMapped, false);
  assert.ok(!pair.attenuation.fragmentShader.includes("#include"));
  const background = [0.12, 1.4, 3.2],
    radiance = [0.08, 0.03, 0.12];
  for (const cosine of [0, 0.25, 0.8, 1]) {
    const f = 0.04 + 0.96 * (1 - cosine) ** 5;
    for (let c = 0; c < 3; c++) {
      const t = CANADA_PLACE_LINEAR_THROUGHPUT[c] * (1 - f);
      const afterMultiply = 0 + background[c] * t;
      const result = radiance[c] + afterMultiply;
      assert.equal(result, background[c] * t + radiance[c]);
      assert.ok(f + t <= 1 + 1e-9, "uniform incident energy is not amplified");
    }
  }
  const source = new T.PlaneGeometry(2, 2);
  source.addGroup(0, 3, 0);
  const mesh = createCanadaPlaceConcourseExtinctionMesh(source, pair);
  assert.equal(source.groups.length, 1);
  assert.deepEqual(
    mesh.geometry.groups.map((g) => [g.start, g.count, g.materialIndex]),
    [
      [0, 6, 0],
      [0, 6, 1],
    ],
  );
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.userData.allowShadow, false);
  // Exercise installed Three transparent sorting, not a handwritten comparator.
  const { WebGLRenderList } = await import(
    "three/src/renderers/webgl/WebGLRenderLists.js"
  );
  // The installed internal implementation is a zero-argument factory; the
  // separate @types package still declares an older constructor/group shape.
  const createList = WebGLRenderList as unknown as () => {
    init(): void;
    push(
      object: T.Object3D,
      geometry: T.BufferGeometry,
      material: T.Material,
      groupOrder: number,
      z: number,
      group: T.BufferGeometry["groups"][number],
    ): void;
    sort(): void;
    transparent: { object: T.Object3D; group: { materialIndex: number } }[];
  };
  const list = createList();
  list.init();
  const other = createCanadaPlaceConcourseExtinctionMesh(source, pair);
  for (const [object, z] of [
    [mesh, 2],
    [other, 3],
  ] as const) {
    for (const group of object.geometry.groups)
      list.push(
        object,
        object.geometry,
        object.material[group.materialIndex!],
        0,
        z,
        group,
      );
  }
  list.sort();
  assert.deepEqual(
    list.transparent.map((r) => [r.object.id, r.group.materialIndex]),
    [
      [other.id, 0],
      [other.id, 1],
      [mesh.id, 0],
      [mesh.id, 1],
    ],
  );
  mesh.geometry.dispose();
  other.geometry.dispose();
  source.dispose();
  pair.attenuation.dispose();
  pair.reflection.dispose();
});
