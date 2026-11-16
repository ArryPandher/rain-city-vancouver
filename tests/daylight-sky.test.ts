import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { DAYLIGHT_SKY_ROTATION, sunOffset } from "../src/world/daylight";
import { applyDaylightOrientation } from "../src/world/daylight-orientation";

test("unclamped photographic HDR solar disc aligns with the daylight sun using only vertical rotation", (t) => {
  const source = JSON.parse(
    fs.readFileSync("docs/sources/afternoon-daylight.json", "utf8"),
  );
  const bytes = fs.readFileSync("public/textures/afternoon-sky.hdr");
  assert.equal(bytes.length, source.bytes);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    source.sha256,
  );
  assert.equal(
    source.sha256,
    "e70bf97a44982db07fb952b1f74c07e818649c2bbdfeb6ad4f98af7b4431a38f",
  );
  assert.equal(source.license, "CC0-1.0");
  assert.equal(new URL(source.source).hostname, "dl.polyhaven.org");
  assert.match(source.credit, /Greg Zaal.*Jarod Guest/);
  const hdr = new HDRLoader()
    .setDataType(T.FloatType)
    .parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
  assert.equal(hdr.width, 2048);
  assert.equal(hdr.height, 1024);
  const luminance = (i: number) =>
    0.2126 * hdr.data[i] + 0.7152 * hdr.data[i + 1] + 0.0722 * hdr.data[i + 2];
  let peak = 0;
  for (let i = 0; i < hdr.data.length; i += 4)
    peak = Math.max(peak, luminance(i));
  assert.ok(peak > 7000, "measure unclamped original, not runtime limit16");
  const centroid = new T.Vector3();
  let pixels = 0;
  for (let y = 0; y < hdr.height; y++)
    for (let x = 0; x < hdr.width; x++) {
      const lum = luminance((y * hdr.width + x) * 4);
      if (lum < peak * 0.5) continue;
      // HDRLoader uploads with flipY=true: raw top rows are northern sky.
      // Three equirect UV has longitude atan(z,x) and latitude asin(y).
      const latitude = (0.5 - (y + 0.5) / hdr.height) * Math.PI;
      const longitude = ((x + 0.5) / hdr.width - 0.5) * Math.PI * 2;
      const c = Math.cos(latitude);
      centroid.addScaledVector(
        new T.Vector3(
          c * Math.cos(longitude),
          Math.sin(latitude),
          c * Math.sin(longitude),
        ),
        lum * c,
      );
      pixels++;
    }
  centroid.normalize();
  assert.equal(pixels, 5);
  assert.ok(
    centroid.distanceTo(new T.Vector3(...source.sourceSunDirection)) < 1e-10,
  );
  const elevation = (Math.asin(centroid.y) * 180) / Math.PI;
  assert.ok(Math.abs(elevation - 28.288107223038665) < 1e-8);
  const rotated = centroid
    .clone()
    .applyAxisAngle(new T.Vector3(0, 1, 0), DAYLIGHT_SKY_ROTATION);
  assert.equal(
    rotated.y,
    centroid.y,
    "vertical-only rotation retains horizon/elevation",
  );
  assert.ok(
    rotated.angleTo(sunOffset("day")) < 1e-7,
    "photographic and directional sun coincide",
  );
  const azimuth =
    ((Math.atan2(rotated.x, -rotated.z) * 180) / Math.PI + 360) % 360;
  assert.ok(
    Math.abs(azimuth - 135) < 1e-8,
    "sun points southeast at 135 degrees",
  );
  assert.ok(rotated.x > 0 && rotated.z > 0);
  assert.ok(Math.abs(rotated.x - rotated.z) < 1e-10);
  assert.ok(
    Math.abs(DAYLIGHT_SKY_ROTATION - (0.6112152105481597 - Math.PI / 4)) <
      1e-12,
    "rotate the retained photographic sun by exactly 45 degrees, not the horizon",
  );
  assert.ok(
    sunOffset("day").distanceTo(
      new T.Vector3(278 / Math.SQRT2, 149.61315223935466, 278 / Math.SQRT2),
    ) < 1e-10,
    "preserve the measured elevation and offset length while changing azimuth",
  );
  assert.ok(Math.abs(source.rotationY - DAYLIGHT_SKY_ROTATION) < 1e-10);
  assert.ok(
    new T.Vector3(...source.dayOffset).distanceTo(sunOffset("day")) < 1e-10,
  );
  const state = {
    weather: "day",
    scene: new T.Scene(),
    sun: new T.DirectionalLight(),
    water: { uniforms: { sunDir: { value: new T.Vector3() } } },
  };
  for (const mode of ["southeast", "southwest"] as const) {
    applyDaylightOrientation(state, mode);
    const disc = centroid
      .clone()
      .applyAxisAngle(new T.Vector3(0, 1, 0), state.scene.backgroundRotation.y);
    assert.ok(
      disc.angleTo(state.sun.position.clone().sub(state.sun.target.position)) <
        1e-7,
    );
    assert.ok(disc.distanceTo(state.water.uniforms.sunDir.value) < 1e-10);
    assert.equal(
      state.scene.backgroundRotation.y,
      state.scene.environmentRotation.y,
    );
    assert.equal(disc.y, centroid.y);
  }
  t.diagnostic(
    `${pixels} half-peak pixels; azimuth ${azimuth.toFixed(6)} / elevation ${elevation.toFixed(6)} degrees; peak ${peak.toFixed(2)}`,
  );
});
