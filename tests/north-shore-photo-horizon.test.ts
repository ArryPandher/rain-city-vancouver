import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import * as T from "three";
import {
  createNorthShorePhotoHorizon,
  NORTH_SHORE_PHOTO_HORIZON,
} from "../src/world/north-shore-photo-horizon";
import record from "../docs/sources/north-shore-photo-ridge.json";

test("horizon factory preserves existing photo geometry, positioning and render/material/weather semantics", () => {
  const texture = new T.Texture();
  const mesh = createNorthShorePhotoHorizon(texture);
  const previous = new T.PlaneGeometry(24000, 1977);
  for (const key of ["position", "normal", "uv"])
    assert.deepEqual(
      mesh.geometry.getAttribute(key).array,
      previous.getAttribute(key).array,
    );
  assert.deepEqual(mesh.geometry.index!.array, previous.index!.array);
  assert.deepEqual(mesh.position.toArray(), [400, 480, -7000]);
  assert.equal(mesh.geometry.index!.count / 3, 2);
  assert.equal(mesh.renderOrder, -1);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, false);
  assert.equal(mesh.material.map, texture);
  assert.equal(mesh.material.transparent, true);
  assert.equal(mesh.material.depthWrite, false);
  assert.equal(mesh.material.fog, false);
  assert.equal(mesh.material.toneMapped, false);
  assert.equal(texture.colorSpace, T.SRGBColorSpace);
  assert.equal(texture.anisotropy, 8);
  const shader = {
    fragmentShader: "#include <map_fragment>",
  } as unknown as T.WebGLProgramParametersWithUniforms;
  mesh.material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  assert.equal(
    shader.fragmentShader,
    "#include <map_fragment>\ndiffuseColor.a *= smoothstep(0.0,0.13,vMapUv.x)*(1.0-smoothstep(0.87,1.0,vMapUv.x));",
  );
  mesh.material.color.set(0x334455);
  assert.equal(
    mesh.material.color.getHex(),
    0x334455,
    "existing world weather tint remains writable",
  );
});

test("licensed derivative matches its recorded bytes, source resolution and bounded per-column ridge", async () => {
  const bytes = fs.readFileSync(record.output);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    record.outputSha256,
  );
  assert.equal(bytes.length, record.outputBytes);
  assert.ok(bytes.length < 1_000_000);
  assert.equal(record.license, "CC BY-SA 3.0");
  assert.equal(record.author, "Selmo");
  assert.equal(
    NORTH_SHORE_PHOTO_HORIZON.texture.split("?")[0],
    record.output.replace("public/", ""),
  );
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.width, 8192);
  assert.equal(meta.height, 982);
  assert.equal(meta.hasAlpha, true);
  assert.equal(record.ridge.length, 8192);
  for (let x = 0; x < record.ridge.length; x++) {
    assert.ok(record.ridge[x] >= 150 && record.ridge[x] <= 650);
    if (x) assert.ok(Math.abs(record.ridge[x] - record.ridge[x - 1]) <= 5);
  }
});

test("source-observed peaks are restored and false sky wedge removed; bottom/side opacity envelope remains unchanged", async () => {
  const current = await sharp(record.output).ensureAlpha().raw().toBuffer();
  const previous = await sharp("public/textures/vancouver/north-shore.webp")
    .ensureAlpha()
    .raw()
    .toBuffer();
  const w = 8192,
    scale = w / 1400;
  const pixel = (buffer: Buffer, x: number, y: number) =>
    buffer[(Math.round(y * scale) * w + Math.round(x * scale)) * 4 + 3];
  // Visually checked against the original13295px photograph, not generated
  // from the new mask: old coarse chords lose these dark/snowy ridge points.
  for (const [x, y] of [
    [817, 45],
    [891, 49],
    [1105, 55],
  ]) {
    assert.equal(pixel(previous, x, y), 0);
    assert.equal(pixel(current, x, y), 255);
  }
  assert.equal(pixel(previous, 780, 50), 255);
  assert.equal(
    pixel(current, 780, 50),
    0,
    "sky above the real valley must not become an opaque triangle",
  );
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (const x of [0, 40, 80, 159, 160, 2000, 8191 - 80, 8191])
    for (const y of [670, 760, 840, 930]) {
      const expected = Math.floor(
        255 *
          clamp((148 * scale - y) / (22 * scale)) *
          clamp(x / 160) *
          clamp((8191 - x) / 160),
      );
      assert.ok(Math.abs(current[(y * w + x) * 4 + 3] - expected) <= 1);
    }
});
