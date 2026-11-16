import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  WATER_WAVES,
  waterWaveSample,
  waterWavesFragment,
  WaterWavesComparison,
} from "../src/world/water-waves";
import { WaterOpticsComparison } from "../src/world/water-optics";
import { World } from "../src/world/world";
const original = fs
  .readFileSync("src/world/world.ts", "utf8")
  .split("this.water = new T.ShaderMaterial")[1]
  .match(/fragmentShader: `([^`]+)`/)![1]
  .replaceAll("\\n", "\n");
function compile(material: T.ShaderMaterial) {
  const shader = {
    fragmentShader: material.fragmentShader,
    uniforms: { ...material.uniforms },
    vertexShader: "",
  } as unknown as Parameters<T.Material["onBeforeCompile"]>[0];
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
}
function optics(material: T.ShaderMaterial) {
  const source = new T.DataTexture(
    new Float32Array(512 * 256 * 4),
    512,
    256,
    T.RGBAFormat,
    T.FloatType,
  );
  source.flipY = true;
  const target = new T.WebGLRenderTarget(384, 512, { type: T.HalfFloatType });
  target.texture.mapping = T.CubeUVReflectionMapping;
  const renderer = {
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget() {},
    autoClear: true,
    toneMapping: T.NoToneMapping,
    xr: { enabled: false },
  } as unknown as T.WebGLRenderer;
  return {
    comparison: new WaterOpticsComparison(material, source, renderer, () => ({
      fromEquirectangular: () => target,
      dispose() {},
    })),
    target,
    source,
  };
}

test("authored wave field has physical slope units, gravity dispersion, bounded height and directional spread", () => {
  assert.equal(WATER_WAVES.length, 8);
  for (const w of WATER_WAVES) {
    assert.ok(Math.abs(Math.hypot(...w.direction) - 1) < 1e-12);
    assert.ok(Math.abs(w.omega * w.omega - 9.81 * w.k) < 1e-12);
    assert.ok(w.amplitude * w.k < 0.05);
    assert.ok(
      Math.abs(w.direction[0]) > 0.05 && Math.abs(w.direction[1]) > 0.05,
    );
  }
  assert.ok(
    Math.max(
      ...WATER_WAVES.map((w) => Math.atan2(w.direction[1], w.direction[0])),
    ) -
      Math.min(
        ...WATER_WAVES.map((w) => Math.atan2(w.direction[1], w.direction[0])),
      ) >
      1,
  );
  const maxHeight = WATER_WAVES.reduce((s, w) => s + w.amplitude, 0);
  const maxSlope = WATER_WAVES.reduce((s, w) => s + w.amplitude * w.k, 0);
  assert.ok(maxHeight < 0.2 && maxSlope < 0.3);
  for (const [x, z, t] of [
    [684, -694, 0],
    [701, -880, 17.5],
    [6800, -1600, 122],
    [0, 0, 10000],
  ]) {
    const h = 1e-4,
      s = waterWaveSample(x, z, t);
    const dx =
      (waterWaveSample(x + h, z, t).height -
        waterWaveSample(x - h, z, t).height) /
      (2 * h);
    const dz =
      (waterWaveSample(x, z + h, t).height -
        waterWaveSample(x, z - h, t).height) /
      (2 * h);
    assert.ok(Math.abs(dx - s.slope[0]) < 1e-7);
    assert.ok(Math.abs(dz - s.slope[1]) < 1e-7);
    assert.ok(Math.abs(s.normal.length() - 1) < 1e-12);
    assert.ok(
      Math.abs(s.height) <= maxHeight && Math.hypot(...s.slope) <= maxSlope,
    );
  }
});

test("pixel footprint removes unresolved crests in both screen axes without distance cutoffs or brightness changes", () => {
  const near = waterWaveSample(684, -694, 19, [0.001, 0], [0, 0.001]);
  assert.deepEqual(near, waterWaveSample(684, -694, 19));
  for (const screen of [
    [
      [100, 0],
      [0, 100],
    ],
    [
      [0, 100],
      [100, 0],
    ],
  ] as const) {
    const far = waterWaveSample(684, -694, 19, ...screen);
    assert.deepEqual(far.slope, [0, 0]);
    assert.equal(far.height, 0);
    assert.deepEqual(far.normal.toArray(), [-0, 1, -0]);
  }
  const shader = waterWavesFragment(original);
  assert.equal((shader.match(/float resolved/g) ?? []).length, 8);
  assert.ok(shader.includes("dFdx(p),pixelY=dFdy(p)"));
  for (const exact of [
    "float fres=pow(1.-max(dot(n,v),0.),3.);",
    "color+=sunColor*spec*2.3*(1.-night*.8);",
    "color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);",
    "float fog=1.-exp(-length(vView)*.00035);",
  ])
    assert.ok(shader.includes(exact));
  assert.throws(() => waterWavesFragment("other"));
});

test("independent HDR/wave toggle orders preserve target ownership, base shader, inherited hooks and cache keys", () => {
  for (const wavesFirst of [true, false]) {
    const material = new T.ShaderMaterial({ fragmentShader: original });
    let inheritedCalls = 0;
    const inherited: T.Material["onBeforeCompile"] = () => {
      inheritedCalls++;
    };
    const originalKey = () => "existing-water-hook";
    material.onBeforeCompile = inherited;
    material.customProgramCacheKey = originalKey;
    const initialVersion = material.version;
    let waves: WaterWavesComparison;
    if (wavesFirst) waves = new WaterWavesComparison(material);
    const hdr = optics(material);
    if (!wavesFirst) waves = new WaterWavesComparison(material);
    waves!.update("day");
    hdr.comparison.update("day", new T.Euler(), 1);
    const combined = compile(material);
    assert.ok(combined.fragmentShader.includes("harbourWaveNormal"));
    assert.ok(combined.fragmentShader.includes("waterHdrMap"));
    assert.equal(combined.uniforms.waterWavesEnabled.value, 1);
    assert.equal(hdr.comparison.diagnostics().retainedGpuBytes, 1572864);
    assert.ok(material.version > initialVersion);
    assert.notEqual(material.customProgramCacheKey(), originalKey());
    waves!.update("night");
    assert.equal(combined.uniforms.waterWavesEnabled.value, 0);
    waves!.update("day");
    // Remove HDR while the wave hook remains, then re-enable it without
    // replacing the wave hook or binding a second instance.
    hdr.comparison.dispose();
    const onlyWaves = compile(material);
    assert.ok(onlyWaves.fragmentShader.includes("harbourWaveNormal"));
    assert.ok(!onlyWaves.fragmentShader.includes("waterHdrMap"));
    const again = optics(material),
      retained = again.target.texture;
    waves!.dispose();
    const onlyHdr = compile(material);
    assert.ok(!onlyHdr.fragmentShader.includes("harbourWaveNormal"));
    assert.ok(onlyHdr.fragmentShader.includes("waterHdrMap"));
    assert.equal(again.comparison.uniforms.waterHdrMap.value, retained);
    assert.equal(material.onBeforeCompile, inherited);
    assert.equal(material.customProgramCacheKey, originalKey);
    again.comparison.dispose();
    assert.equal(material.fragmentShader, original);
    assert.ok(inheritedCalls >= 3);
    hdr.source.dispose();
    again.source.dispose();
    material.dispose();
  }
});

test("material disposal and World debug gate restore original hooks without touching geometry or HDR", () => {
  const material = new T.ShaderMaterial({ fragmentShader: original });
  const before = material.onBeforeCompile,
    key = material.customProgramCacheKey;
  const waves = new WaterWavesComparison(material);
  waves.update("day");
  material.dispose();
  waves.dispose();
  assert.equal(material.onBeforeCompile, before);
  assert.equal(material.customProgramCacheKey, key);
  assert.equal(waves.diagnostics().active, false);
  const world = Object.create(World.prototype) as World;
  Object.assign(world, { water: material, weather: "day" });
  assert.equal(world.setDebugWaterWaves(true), false);
  assert.deepEqual(world.waterWavesDiagnostics(), {
    requested: false,
    active: false,
    components: 0,
  });
  assert.equal(world.setDebugWaterWaves(false), true);
});
