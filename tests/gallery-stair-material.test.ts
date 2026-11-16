import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  LandmarkSurfaces,
  landmarkSurfaceUV,
} from "../src/world/landmark-surfaces";
import type { Materials } from "../src/world/materials";
import {
  createGalleryStairMaterial,
  GALLERY_STAIR_FINISH,
} from "../src/world/gallery-stair-material";
import { addGalleryFacade } from "../src/world/gallery-facade";
import { addGalleryEntryStairs } from "../src/world/gallery-entry-stairs";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";

function foundation() {
  return new LandmarkSurfaces({
    texture: () => new T.Texture(),
  } as unknown as Materials).material(
    new T.MeshStandardMaterial({ name: "foundation" }),
    "vancouver-art-gallery",
  );
}
function shader(material: T.MeshStandardMaterial) {
  const s = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(s, {} as T.WebGLRenderer);
  return s;
}

test("stair finish removes wall courses without changing the foundation shader or licensed Sources", () => {
  const base = foundation(),
    before = shader(base),
    stairs = createGalleryStairMaterial(base);
  assert.ok(before.fragmentShader.includes("landmarkBlock"));
  assert.equal(
    shader(stairs).fragmentShader,
    T.ShaderLib.standard.fragmentShader,
  );
  assert.deepEqual(shader(base), before);
  assert.equal(stairs.metalness, 0);
  assert.equal(stairs.roughness, 0.96);
  assert.equal(stairs.color.getHex(), GALLERY_STAIR_FINISH.color);
  assert.ok(
    stairs.color.r < base.color.r &&
      stairs.color.g < base.color.g &&
      stairs.color.b < base.color.b,
  );
  let ownDisposed = 0,
    sourceDisposed = 0;
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const map = stairs[key]!,
      original = base[key]!;
    assert.notEqual(map, original);
    assert.equal(map.source, original.source);
    const a = new T.Vector2(0, 0).applyMatrix3(map.matrix),
      b = new T.Vector2(0.75, 0).applyMatrix3(map.matrix);
    assert.ok(Math.abs(a.distanceTo(b) - 1) < 1e-12);
    assert.deepEqual(original.repeat.toArray(), [1, 1]);
    assert.equal(
      map.colorSpace,
      key === "map" ? T.SRGBColorSpace : T.NoColorSpace,
    );
    map.addEventListener("dispose", () => ownDisposed++);
    original.addEventListener("dispose", () => sourceDisposed++);
  }
  stairs.dispose();
  stairs.dispose();
  assert.equal(ownDisposed, 3);
  assert.equal(sourceDisposed, 0);
  const manifest = JSON.parse(
    fs.readFileSync("public/textures/landmarks/SOURCES.json", "utf8"),
  );
  const records = manifest.filter((r: { file: string }) =>
    r.file.includes("/mineral-"),
  );
  assert.equal(records.length, 3);
  for (const r of records) {
    assert.equal(r.license, "CC0-1.0");
    assert.ok(r.changes.includes("away from floor joints"));
  }
});

test("actual facade assigns the new finish only to the complete unchanged metric stair shell", () => {
  const base = foundation(),
    stone = new T.MeshStandardMaterial({ name: "stone" }),
    glass = new T.MeshStandardMaterial({ name: "glass" });
  const chunks = addGalleryFacade(
    new T.Group(),
    new Map([
      ["foundation", base],
      ["stone", stone],
      ["glass", glass],
    ]),
  );
  const selected = chunks.filter(
    (m) => (m.material as T.Material).userData.galleryStairFinish,
  );
  assert.equal(selected.length, 1);
  assert.equal(
    chunks.length,
    7,
    "one stair batch plus two bistro batches; no per-step draws",
  );
  assert.ok(
    chunks.some((m) => m.material === base),
    "foundation and framing remain original",
  );
  assert.ok(
    chunks.some((m) => m.material === stone),
    "columns and cornice remain original",
  );
  const batch = new Batcher(new T.Group(), 512),
    builder = new ArchitecturalMesh(batch, 0, 0);
  addGalleryEntryStairs(builder, base);
  builder.finish();
  const prior = batch.finish();
  assert.equal(prior.length, 1);
  landmarkSurfaceUV(prior[0].geometry, [1, 1]);
  const a = selected[0].geometry,
    b = prior[0].geometry;
  assert.deepEqual(
    Object.keys(a.attributes).sort(),
    Object.keys(b.attributes).sort(),
  );
  for (const name of Object.keys(a.attributes))
    assert.deepEqual(
      Array.from(a.getAttribute(name).array),
      Array.from(b.getAttribute(name).array),
      name,
    );
  assert.deepEqual(
    a.index && Array.from(a.index.array),
    b.index && Array.from(b.index.array),
  );
  // UV tangent-plane derivative retains one metre per unit on tread and riser.
  const p = a.getAttribute("position"),
    n = a.getAttribute("normal"),
    uv = a.getAttribute("uv");
  let treads = 0,
    risers = 0;
  for (let i = 0; i < (a.index?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map((j) => (a.index ? a.index.getX(i + j) : i + j));
    // Existing extrusion can retain zero-area closure triangles. They have
    // no visible surface or valid tangent frame; geometry remains untouched.
    if (new T.Vector3().fromBufferAttribute(n, ids[0]).lengthSq() < 0.5)
      continue;
    if (Math.abs(n.getY(ids[0])) > 0.999) treads++;
    else risers++;
    for (const j of [1, 2]) {
      const world = new T.Vector3()
        .fromBufferAttribute(p, ids[0])
        .distanceTo(new T.Vector3().fromBufferAttribute(p, ids[j]));
      const texture = new T.Vector2(
        uv.getX(ids[0]),
        uv.getY(ids[0]),
      ).distanceTo(new T.Vector2(uv.getX(ids[j]), uv.getY(ids[j])));
      assert.ok(
        Math.abs(world - texture) < 0.001,
        JSON.stringify({
          i,
          j,
          world,
          texture,
          n: ids.map((k) => [n.getX(k), n.getY(k), n.getZ(k)]),
        }),
      );
    }
  }
  assert.ok(treads > 20 && risers > 20);
});
