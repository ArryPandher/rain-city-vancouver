import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { installBloomHighlightFilter } from "../src/rendering/bloom-highlight-filter";

const luma = (rgb: number[]) =>
  rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
const close = (a: number, b: number, tolerance = 1e-10) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

/** Execute the arithmetic actually installed in the high-pass shader, with
 * only GLSL scalar syntax/vector multiplication translated for JS evaluation.
 * This checks extraction math; it does not assert GPU shader compilation.
 */
function extraction(pass: UnrealBloomPass) {
  const source = pass.materialHighPassFilter.fragmentShader;
  const block = source.match(
    /\/\/ Rain City bloom highlight filter v1 begin([\s\S]*?)\/\/ Rain City bloom highlight filter v1 end/,
  )?.[1];
  assert.ok(block);
  const evaluate = new Function(
    "input",
    "v",
    "rainCityBloomHighlightFilterEnabled",
    "exp",
    `let texel={rgb:input.slice()};\n${block
      .replace(/\bfloat /g, "const ")
      .replace(
        "texel.rgb *= bloomFilteredLuminance / v;",
        "texel.rgb = texel.rgb.map(channel => channel * bloomFilteredLuminance / v);",
      )}\nreturn {rgb:texel.rgb,gateLuminance:v};`,
  );
  return (input: number[]) =>
    evaluate(
      input,
      luma(input),
      pass.materialHighPassFilter.uniforms.rainCityBloomHighlightFilterEnabled
        .value,
      Math.exp,
    ) as { rgb: number[]; gateLuminance: number };
}

test("bloom extraction keeps low radiance and original threshold luminance exact", () => {
  const pass = new UnrealBloomPass(new T.Vector2(32, 32), 0.12, 0.4, 2.2);
  try {
    installBloomHighlightFilter(pass);
    const sample = extraction(pass);
    for (const input of [
      [0, 0, 0],
      [1, 2, 0.3],
      [8, 8, 8],
      [12, 2, 4],
    ]) {
      assert.ok(luma(input) <= 8);
      assert.deepEqual(sample(input).rgb, input);
      assert.equal(sample(input).gateLuminance, luma(input));
    }
    const bright = sample([100, 60, 20]);
    assert.equal(bright.gateLuminance, luma([100, 60, 20]));
    assert.ok(luma(bright.rgb) < bright.gateLuminance);
    assert.ok(
      pass.materialHighPassFilter.fragmentShader.includes(
        "smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v )",
      ),
    );
  } finally {
    pass.dispose();
  }
});

test("highlights compress monotonically below 16 while preserving hue and continuity", () => {
  const pass = new UnrealBloomPass(new T.Vector2(32, 32), 0.12, 0.4, 2.2);
  try {
    installBloomHighlightFilter(pass);
    const sample = extraction(pass);
    let previous = 8;
    for (const input of [8, 8.000001, 8.01, 9, 12, 20, 40, 100, 1000, 65504]) {
      const output = sample([input, input, input]).rgb;
      assert.ok(output[0] >= previous - 1e-10 && output[0] <= 16 + 1e-10);
      assert.ok(output.every(Number.isFinite));
      assert.ok(output[0] <= input);
      previous = output[0];
    }
    close(
      (sample([8.000001, 8.000001, 8.000001]).rgb[0] - 8) / 0.000001,
      1,
      1e-6,
    );
    const rgb = sample([160, 80, 40]).rgb;
    close(rgb[0] / rgb[1], 2);
    close(rgb[1] / rgb[2], 2);
    assert.ok(luma(rgb) <= 16 + 1e-10);
  } finally {
    pass.dispose();
  }
});

test("disabled mode is stock math without recompiling or allocating render resources", () => {
  const pass = new UnrealBloomPass(new T.Vector2(32, 32), 0.12, 0.4, 2.2);
  try {
    const material = pass.materialHighPassFilter;
    const uniforms = material.uniforms;
    const target = pass.renderTargetBright;
    const horizontal = pass.renderTargetsHorizontal.slice();
    const vertical = pass.renderTargetsVertical.slice();
    const version = material.version;
    const controller = installBloomHighlightFilter(pass);
    assert.equal(controller.enabled, true);
    assert.equal(material.version, version + 1);
    const patchedVersion = material.version;
    const sample = extraction(pass);
    controller.setEnabled(false);
    assert.equal(controller.enabled, false);
    for (const rgb of [
      [0, 0, 0],
      [9, 2, 6],
      [10000, 20000, 50000],
    ])
      assert.deepEqual(sample(rgb).rgb, rgb);
    controller.setEnabled(true);
    assert.equal(material.version, patchedVersion);
    assert.equal(pass.materialHighPassFilter, material);
    assert.equal(material.uniforms, uniforms);
    assert.equal(pass.renderTargetBright, target);
    assert.deepEqual(pass.renderTargetsHorizontal, horizontal);
    assert.deepEqual(pass.renderTargetsVertical, vertical);
    assert.equal(pass.strength, 0.12);
    assert.equal(pass.radius, 0.4);
    assert.equal(pass.threshold, 2.2);
    assert.throws(() => installBloomHighlightFilter(pass), /already installed/);
  } finally {
    pass.dispose();
  }
});

test("unexpected upstream shader fails before any mutation", () => {
  const pass = new UnrealBloomPass(new T.Vector2(32, 32), 0.12, 0.4, 2.2);
  try {
    const material = pass.materialHighPassFilter;
    material.fragmentShader = material.fragmentShader.replace(
      "float v = luminance( texel.xyz );",
      "float v = 0.0;",
    );
    const before = material.fragmentShader,
      count = Object.keys(material.uniforms).length;
    assert.throws(
      () => installBloomHighlightFilter(pass),
      /expected Three's original/,
    );
    assert.equal(material.fragmentShader, before);
    assert.equal(Object.keys(material.uniforms).length, count);
  } finally {
    pass.dispose();
  }
});
