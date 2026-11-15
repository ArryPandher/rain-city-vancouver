import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  extractCanadaPlacePaving,
  canadaPlacePavingMaterial,
} from "../src/world/canada-place-paving";
import { createCanadaPlaceFixtureParts } from "../src/world/canada-place-promenade-fixtures";
import { CANADA_PLACE_PROMENADE_FIXTURES as fixtures } from "../src/world/canada-place-promenade-fixtures-data";
import { CANADA_PLACE_ORIGIN } from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_FIXTURE_CONTACT as contact,
  CANADA_PLACE_FIXTURE_CONTACT_CENTERS as centers,
  canadaPlaceFixtureContact as factor,
  canadaPlaceFixtureContactUniforms,
} from "../src/world/canada-place-fixture-contact";

test("paving enables fixture contact only for present fixtures and leaves direct illumination intact", () => {
  for (const fixturesPresent of [undefined, false, true]) {
    const material = canadaPlacePavingMaterial(
      new T.MeshStandardMaterial(),
      {
        color: new T.Texture(),
        normal: new T.Texture(),
        roughness: new T.Texture(),
      },
      { fixturesPresent },
    );
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    };
    material.onBeforeCompile(shader as any, {} as T.WebGLRenderer);
    assert.equal(
      shader.uniforms.fixtureContactEnabled.value,
      fixturesPresent === true ? 1 : 0,
    );
    assert.equal(
      (shader.uniforms.fixtureContactCenters.value as T.Vector2[]).length,
      4,
    );
    assert.ok(
      shader.fragmentShader.includes(
        "reflectedLight.indirectDiffuse*=fixtureIndirect",
      ),
    );
    assert.ok(
      shader.fragmentShader.includes(
        "reflectedLight.indirectSpecular*=fixtureIndirect",
      ),
    );
    assert.ok(
      shader.fragmentShader.indexOf("float fixtureIndirect=") >
        shader.fragmentShader.indexOf("#include <aomap_fragment>"),
    );
    assert.equal(
      /\b(?:diffuseColor|directDiffuse|directSpecular)[^;\n]*fixtureIndirect/.test(
        shader.fragmentShader,
      ),
      false,
    );
    assert.ok(
      shader.fragmentShader.includes(
        "reflectedLight.indirectDiffuse*=anchorIndirect",
      ),
      "existing anchor contact remains separate",
    );
  }
});

test("four visual pole bases meet source paving within measured GLB millimetre quantization", async () => {
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const loaded = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  loaded.scene.updateMatrixWorld(true);
  let paving: T.BufferGeometry | undefined;
  loaded.scene.traverse((o) => {
    if (o instanceof T.Mesh && (o.material as T.Material).name === "concrete")
      paving =
        extractCanadaPlacePaving(
          bakeGeometry(o.geometry, o.matrixWorld),
          "concrete",
        ) ?? undefined;
  });
  assert.ok(paving);
  const deck = new T.Mesh(paving, new T.MeshBasicMaterial());
  deck.updateMatrixWorld(true);
  const parts = createCanadaPlaceFixtureParts(() => new T.Texture());
  const base = parts[0].geometry.getAttribute("position");
  let radius = 0,
    minY = Infinity;
  for (let i = 0; i < base.count; i++) {
    minY = Math.min(minY, base.getY(i));
    if (Math.abs(base.getY(i)) < 1e-6)
      radius = Math.max(radius, Math.hypot(base.getX(i), base.getZ(i)));
  }
  assert.ok(Math.abs(radius - 0.16) < 1e-7);
  assert.ok(Math.abs(minY) < 1e-7);
  assert.equal(contact.radius, 0.16);
  assert.equal(centers.length, 4);
  for (const [i, p] of fixtures.entries()) {
    assert.deepEqual(centers[i], [p.x, p.z]);
    assert.ok(Math.abs(p.world[0] - CANADA_PLACE_ORIGIN[0] - p.x) < 1e-10);
    assert.ok(Math.abs(p.world[1] - CANADA_PLACE_ORIGIN[1] - p.z) < 1e-10);
    for (const [dx, dz] of [
      [0, 0],
      [0.16, 0],
      [-0.16, 0],
      [0, 0.16],
      [0, -0.16],
    ]) {
      const hit = new T.Raycaster(
        new T.Vector3(p.x + dx, 8.1, p.z + dz),
        new T.Vector3(0, -1, 0),
        0,
        0.6,
      ).intersectObject(deck)[0];
      assert.ok(hit);
      assert.ok(
        Math.abs(hit.point.y - 7.798935890197754) < 1e-7,
        "pin actual quantized source plane",
      );
      assert.ok(
        Math.abs(hit.point.y - p.groundY) < 0.0011,
        "1.064mm source quantization gap",
      );
      assert.ok(Math.abs(hit.point.y + 0.08 - 7.88) < 0.0011);
      assert.ok(Math.abs(p.groundY + minY + 0.08 - 7.88) < 1e-6);
    }
  }
  for (const p of parts) {
    p.geometry.dispose();
    p.material.dispose();
  }
});

test("contact uses visual radius and compact symmetric smooth falloff, without a collision-sized dark ring", () => {
  for (const [x, z] of centers) {
    assert.equal(
      factor(x, z),
      1,
      "disabled default never shades absent fixtures",
    );
    assert.ok(Math.abs(factor(x + 0.16, z, true) - 0.78) < 1e-10);
    assert.ok(
      factor(x + 0.18, z, true) > 0.78,
      "collision envelope is already in fading region",
    );
    assert.ok(
      Math.abs(factor(x + 0.2, z, true) - 0.89) < 1e-10,
      "halfway falloff has half occlusion",
    );
    assert.ok(Math.abs(factor(x + 0.24, z, true) - 1) < 1e-10);
    let previous = 0;
    for (let d = 0.16; d <= 0.26; d += 0.002) {
      const f = factor(x + d, z, true);
      assert.ok(f >= previous - 1e-12);
      assert.ok(Math.abs(f - factor(x, z - d, true)) < 1e-10);
      previous = f;
    }
  }
  assert.equal(factor(0, 0, true), 1);
  assert.equal(
    canadaPlaceFixtureContactUniforms().fixtureContactEnabled.value,
    0,
  );
  assert.equal(
    canadaPlaceFixtureContactUniforms(true).fixtureContactEnabled.value,
    1,
  );
  assert.deepEqual(
    canadaPlaceFixtureContactUniforms(true).fixtureContactCenters.value.map(
      (v) => v.toArray(),
    ),
    centers,
  );
});
