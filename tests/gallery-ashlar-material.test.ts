import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { LandmarkSurfaces } from "../src/world/landmark-surfaces";
import type { Materials } from "../src/world/materials";
import {
  createGalleryAshlarMaterial,
  GALLERY_ASHLAR_FINISH,
} from "../src/world/gallery-ashlar-material";
import { addGalleryFacade } from "../src/world/gallery-facade";

function source() {
  return new LandmarkSurfaces({
    texture: () => new T.Texture(),
  } as unknown as Materials).material(
    new T.MeshStandardMaterial({ name: "stone" }),
    "vancouver-art-gallery",
  );
}
function compile(material: T.MeshStandardMaterial) {
  const shader = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
}

test("Gallery wall clone preserves hue, maps, original shader and resource ownership", () => {
  const stone = source(),
    before = compile(stone),
    wall = createGalleryAshlarMaterial(stone);
  assert.notEqual(wall, stone);
  assert.deepEqual(wall.color, stone.color);
  assert.deepEqual(wall.normalScale, stone.normalScale);
  assert.equal(wall.roughness, stone.roughness);
  for (const key of ["map", "normalMap", "roughnessMap"] as const)
    assert.equal(wall[key], stone[key]);
  assert.deepEqual(compile(stone), before, "the source shader is unchanged");
  assert.notEqual(wall.customProgramCacheKey(), stone.customProgramCacheKey());
  let disposedMaps = 0;
  stone.map!.addEventListener("dispose", () => disposedMaps++);
  wall.dispose();
  assert.equal(
    disposedMaps,
    0,
    "the shared sampler remains owned by Materials",
  );
  const other = new T.MeshStandardMaterial({ name: "stone" });
  assert.equal(
    createGalleryAshlarMaterial(other),
    other,
    "unprofiled and other-site stone fail closed",
  );
});

test("wall response reuses exactly one metric joint field and its relief", () => {
  const shader = compile(createGalleryAshlarMaterial(source()));
  assert.equal(
    (shader.fragmentShader.match(/vec3 landmarkBlock\(/g) ?? []).length,
    1,
  );
  assert.equal(
    (shader.fragmentShader.match(/vec3 blockDetail=/g) ?? []).length,
    1,
  );
  assert.ok(shader.fragmentShader.includes("reliefGradient"));
  assert.ok(shader.fragmentShader.includes("fwidth(metres)"));
  assert.ok(shader.fragmentShader.includes("*(1.0-blockDetail.x*.22)"));
  assert.deepEqual(
    shader.uniforms.landmarkJoints.value.toArray(),
    [1.2, 0.55, 0.004, 0.003],
  );
  assert.deepEqual(
    shader.uniforms.galleryAshlarRange.value.toArray(),
    [0.94, 1.06],
  );
  assert.equal(
    GALLERY_ASHLAR_FINISH.albedoRange[0] + GALLERY_ASHLAR_FINISH.albedoRange[1],
    2,
    "neutral variation has unit mean rather than recoloring the wall",
  );
  assert.ok(
    shader.fragmentShader.indexOf("vec3 blockDetail=") <
      shader.fragmentShader.indexOf("roughnessFactor=clamp"),
  );
});

test("facade hookup changes only upper wall finish, preserving geometry and separate cornice/columns", () => {
  const stone = source(),
    base = new T.MeshStandardMaterial({ name: "foundation" }),
    glass = new T.MeshStandardMaterial({ name: "glass" });
  const materials = new Map([
    ["stone", stone],
    ["foundation", base],
    ["glass", glass],
  ]);
  const candidate = addGalleryFacade(new T.Group(), materials);
  const plainStone = new T.MeshStandardMaterial({ name: "stone" });
  const baseline = addGalleryFacade(
    new T.Group(),
    new Map(materials).set("stone", plainStone),
  );
  const vertices = (meshes: T.Mesh[]) =>
    meshes
      .flatMap((mesh) => {
        const p = mesh.geometry.getAttribute("position");
        return Array.from({ length: p.count }, (_, i) =>
          [p.getX(i), p.getY(i), p.getZ(i)].join(","),
        );
      })
      .sort();
  assert.deepEqual(
    vertices(candidate),
    vertices(baseline),
    "no silhouette, support, aperture or depth changes",
  );
  const wall = candidate.filter(
    (m) => (m.material as T.Material).userData.galleryAshlar,
  );
  assert.equal(wall.length, 1);
  const p = wall[0].geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++)
    assert.ok(p.getY(i) >= 3.199 && p.getY(i) <= 13.151);
  assert.ok(
    candidate.some((m) => m.material === stone),
    "columns and cornice retain original stone",
  );
  assert.ok(
    candidate.some((m) => m.material === base),
    "foundation rustication retains original material",
  );
  assert.equal(
    candidate.length,
    baseline.length + 1,
    "one bounded wall draw, no per-block meshes",
  );
  for (const m of [...candidate, ...baseline]) m.geometry.dispose();
});
