import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import {
  WaterOpticsComparison,
  WATER_OPTICS,
  waterOpticsFragment,
  waterOpticsInput,
  waterOpticsRotation,
} from "../src/world/water-optics";
import { World } from "../src/world/world";
import { applyDaylightOrientation } from "../src/world/daylight-orientation";

const worldSource = fs.readFileSync("src/world/world.ts", "utf8");
const original = worldSource
  .slice(worldSource.indexOf("this.water = new T.ShaderMaterial"))
  .match(/fragmentShader: `([^`]+)`/)![1]
  .replaceAll("\\n", "\n");
function material() {
  return new T.ShaderMaterial({
    fragmentShader: original,
    uniforms: {
      time: { value: 12 },
      deep: { value: new T.Color(0x294956) },
      sky: { value: new T.Color(0xb2c8d4) },
      sunDir: { value: new T.Vector3() },
      sunColor: { value: new T.Color(0xffd5a3) },
      night: { value: 0 },
    },
  });
}
function source() {
  const pixels = new Uint16Array(512 * 256 * 4).fill(
    T.DataUtils.toHalfFloat(1),
  );
  const t = new T.DataTexture(pixels, 512, 256, T.RGBAFormat, T.HalfFloatType);
  t.colorSpace = T.LinearSRGBColorSpace;
  t.flipY = true;
  return t;
}
function renderer() {
  const oldTarget = new T.WebGLRenderTarget(2, 2);
  const r = {
    target: oldTarget,
    face: 2,
    mip: 1,
    autoClear: true,
    toneMapping: T.ACESFilmicToneMapping as T.ToneMapping,
    xr: { enabled: true },
    getRenderTarget() {
      return this.target;
    },
    getActiveCubeFace() {
      return this.face;
    },
    getActiveMipmapLevel() {
      return this.mip;
    },
    setRenderTarget(target: T.WebGLRenderTarget, face: number, mip: number) {
      this.target = target;
      this.face = face;
      this.mip = mip;
    },
  };
  return { r, typed: r as unknown as T.WebGLRenderer, oldTarget };
}
function target() {
  const t = new T.WebGLRenderTarget(384, 512, {
    type: T.HalfFloatType,
    format: T.RGBAFormat,
    depthBuffer: false,
    generateMipmaps: false,
  });
  t.texture.mapping = T.CubeUVReflectionMapping;
  return t;
}

test("original water remains exact; candidate replaces the complete lighting lobe before unchanged noise/fog/tone mapping", () => {
  const shader = waterOpticsFragment(original);
  for (const part of [
    "float wave(vec2 p)",
    "float eps=.15;",
    "float fres=pow(1.-max(dot(n,v),0.),3.);",
    "float fog=1.-exp(-length(vView)*.00035);",
    "#include <tonemapping_fragment>",
    "#include <colorspace_fragment>",
  ])
    assert.ok(shader.includes(part));
  assert.equal(shader.match(/color\+=sunColor\*spec\*2.3/g)?.length, 1);
  assert.ok(
    shader.includes(
      "color = mix(deep,waterRadiance,fres*.85)",
    ),
  );
  assert.ok(shader.includes("if (waterHdrEnabled > 0.0)"));
  assert.ok(!shader.includes("waterReflection.y"));
  assert.ok(!shader.includes("waterHdrWeight"));
  assert.ok(
    shader.includes(
      T.ShaderChunk.cube_uv_reflection_fragment
        .replace(/CUBEUV_MAX_MIP/g, "7.0")
        .replace(/CUBEUV_TEXEL_WIDTH/g, "(1.0 / 384.0)")
        .replace(/CUBEUV_TEXEL_HEIGHT/g, "(1.0 / 512.0)"),
    ),
  );
  assert.throws(() => waterOpticsFragment("unrelated shader"));
});

test("real clamped daytime HDR is bounded, orientation-preserving and energy-filtered without touching the shared input", () => {
  const b = fs.readFileSync("public/textures/afternoon-sky.hdr");
  const hdr = new HDRLoader()
    .setDataType(T.HalfFloatType)
    .parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const data: unknown = hdr.data;
  assert.ok(data instanceof Uint16Array);
  const pixels = data;
  for (let i = 0; i < pixels.length; i += 4) {
    const c = [0, 1, 2].map((j) => T.DataUtils.fromHalfFloat(pixels[i + j]));
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (l > 16)
      for (let j = 0; j < 3; j++)
        pixels[i + j] = T.DataUtils.toHalfFloat((c[j] * 16) / l);
  }
  const src = new T.DataTexture(
    pixels,
    hdr.width,
    hdr.height,
    T.RGBAFormat,
    T.HalfFloatType,
  );
  src.flipY = true;
  src.colorSpace = T.LinearSRGBColorSpace;
  const before = pixels.slice(),
    filtered = waterOpticsInput(src);
  assert.deepEqual(pixels, before);
  assert.equal(filtered.flipY, true);
  assert.equal(filtered.colorSpace, src.colorSpace);
  assert.equal(filtered.image.width, 512);
  assert.equal(filtered.image.height, 256);
  assert.ok(filtered.image.data instanceof Uint16Array);
  assert.equal(filtered.image.data.byteLength, 1048576);
  const energy = (data: Uint16Array, w: number, h: number) => {
    let sum = 0,
      weight = 0;
    for (let y = 0; y < h / 2; y++) {
      const a = Math.sin((Math.PI * (y + 0.5)) / h);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        sum +=
          (0.2126 * T.DataUtils.fromHalfFloat(data[i]) +
            0.7152 * T.DataUtils.fromHalfFloat(data[i + 1]) +
            0.0722 * T.DataUtils.fromHalfFloat(data[i + 2])) *
          a;
        weight += a;
      }
    }
    return sum / weight;
  };
  // Compare only the actual upper sky: lower-source energy intentionally goes.
  const horizon = filtered.image.data.subarray(127 * 512 * 4, 128 * 512 * 4);
  for (let row = 128; row < 256; row++)
    assert.deepEqual(filtered.image.data.subarray(row * 512 * 4, (row + 1) * 512 * 4), horizon);
  const oldEnergy = energy(pixels, hdr.width, hdr.height),
    newEnergy = energy(filtered.image.data as Uint16Array, 512, 256);
  assert.ok(Math.abs(newEnergy / oldEnergy - 1) < 0.001);
  // The independently recorded original solar direction follows the same inverse
  // PMREM lookup rotation as the actual shared day sun at all three orientations.
  const metadata = JSON.parse(
    fs.readFileSync("docs/sources/afternoon-daylight.json", "utf8"),
  );
  for (const orientation of ["southeast", "south", "southwest"] as const) {
    const state = {
      weather: "day",
      scene: new T.Scene(),
      sun: new T.DirectionalLight(),
      water: material(),
    };
    applyDaylightOrientation(state, orientation);
    const sun = state.sun.position
      .clone()
      .sub(state.sun.target.position)
      .normalize();
    const lookup = sun.applyMatrix3(
      waterOpticsRotation(state.scene.backgroundRotation),
    );
    assert.ok(
      lookup.angleTo(new T.Vector3(...metadata.sourceSunDirection)) < 1e-7,
    );
  }
  filtered.dispose();
  src.dispose();
});

test("owned PMREM, temporary resources and renderer state are restored across toggles and weather", () => {
  const m = material(),
    src = source(),
    { r, typed, oldTarget } = renderer(),
    output = target();
  let outputDisposed = 0,
    inputDisposed = 0,
    generatorDisposed = 0,
    sourceDisposed = 0,
    calls = 0;
  output.addEventListener("dispose", () => outputDisposed++);
  src.addEventListener("dispose", () => sourceDisposed++);
  const oldUniforms = { ...m.uniforms };
  const c = new WaterOpticsComparison(m, src, typed, () => ({
    fromEquirectangular(input) {
      calls++;
      input.addEventListener("dispose", () => inputDisposed++);
      r.autoClear = false;
      r.xr.enabled = false;
      r.toneMapping = T.NoToneMapping;
      r.target = output;
      return output;
    },
    dispose() {
      generatorDisposed++;
    },
  }));
  assert.equal(inputDisposed, 1);
  assert.equal(generatorDisposed, 1);
  assert.equal(outputDisposed, 0);
  assert.equal(sourceDisposed, 0);
  assert.equal(r.target, oldTarget);
  assert.equal(r.autoClear, true);
  assert.equal(r.xr.enabled, true);
  assert.equal(r.toneMapping, T.ACESFilmicToneMapping);
  c.update("day", new T.Euler(0, -0.959581, 0), 1);
  assert.equal(c.diagnostics().active, true);
  assert.equal(c.diagnostics().retainedGpuBytes, 1572864);
  for (const weather of ["overcast", "golden", "night"]) {
    c.update(weather, new T.Euler(), 0.67);
    assert.equal(c.diagnostics().active, false);
  }
  c.update("day", new T.Euler(), 1);
  assert.equal(calls, 1);
  for (const [key, u] of Object.entries(oldUniforms))
    assert.equal(m.uniforms[key], u);
  c.dispose();
  c.dispose();
  assert.equal(outputDisposed, 1);
  assert.equal(sourceDisposed, 0);
  assert.equal(m.fragmentShader, original);
  assert.deepEqual(m.uniforms, oldUniforms);
  assert.equal(c.diagnostics().retainedGpuBytes, 0);
});

test("filter failure cannot modify default water or leave temporary ownership/renderer state", () => {
  const m = material(),
    src = source(),
    { r, typed, oldTarget } = renderer();
  let released = 0,
    inputs = 0;
  assert.throws(
    () =>
      new WaterOpticsComparison(m, src, typed, () => ({
        fromEquirectangular(input) {
          input.addEventListener("dispose", () => inputs++);
          r.autoClear = false;
          r.xr.enabled = false;
          throw Error("filter failure");
        },
        dispose() {
          released++;
        },
      })),
    /filter failure/,
  );
  assert.equal(inputs, 1);
  assert.equal(released, 1);
  assert.equal(m.fragmentShader, original);
  assert.equal(r.target, oldTarget);
  assert.equal(r.autoClear, true);
  assert.equal(r.xr.enabled, true);
  assert.equal(m.uniforms.waterHdrMap, undefined);
});

test("World refuses non-debug allocation; disabling and material disposal release an existing comparison", () => {
  const world = Object.create(World.prototype) as World;
  Object.assign(world, {
    water: material(),
    skyTextures: { day: source() },
    scene: new T.Scene(),
    weather: "day",
  });
  assert.equal(world.setDebugWaterOptics({} as T.WebGLRenderer, true), false);
  assert.equal(world.waterOpticsDiagnostics().active, false);
  const output = target();
  let disposed = 0;
  output.addEventListener("dispose", () => disposed++);
  const c = new WaterOpticsComparison(
    world.water,
    world.skyTextures.day,
    renderer().typed,
    () => ({ fromEquirectangular: () => output, dispose() {} }),
  );
  Object.assign(world, { waterOpticsComparison: c });
  world.water.dispose();
  assert.equal(disposed, 1);
  assert.equal(world.setDebugWaterOptics({} as T.WebGLRenderer, false), true);
  assert.equal(disposed, 1);
  assert.equal(world.waterOpticsDiagnostics().status, "original");
});

test("actual World weather/orientation hooks switch only the diagnostic lobe and preserve accepted optics", () => {
  function fixture() {
    const world = Object.create(World.prototype) as World;
    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0xffffff);
    Object.assign(world, {
      scene,
      water: material(),
      sun: new T.DirectionalLight(),
      ambient: new T.HemisphereLight(),
      weather: "day",
      debugDaylightOrientation: "south",
      skyTextures: { day: source() },
      reflectionTextures: {},
      nightLights: [],
      rain: { visible: false },
      materials: { setNight() {}, asphalt: new T.MeshStandardMaterial() },
    });
    return world;
  }
  const baseline = fixture(),
    trial = fixture(),
    output = target();
  const comparison = new WaterOpticsComparison(
    trial.water,
    trial.skyTextures.day,
    renderer().typed,
    () => ({ fromEquirectangular: () => output, dispose() {} }),
  );
  Object.assign(trial, { waterOpticsComparison: comparison });
  for (const weather of [
    "day",
    "overcast",
    "night",
    "golden",
    "day",
  ] as const) {
    baseline.setWeather(weather);
    trial.setWeather(weather);
    assert.equal(comparison.diagnostics().active, weather === "day");
    for (const key of ["deep", "sky", "sunDir", "sunColor"])
      assert.deepEqual(
        trial.water.uniforms[key].value.toArray(),
        baseline.water.uniforms[key].value.toArray(),
      );
    assert.equal(trial.sun.intensity, baseline.sun.intensity);
    assert.deepEqual(trial.sun.color.toArray(), baseline.sun.color.toArray());
    assert.equal(
      trial.scene.environmentIntensity,
      baseline.scene.environmentIntensity,
    );
    assert.equal(
      trial.scene.backgroundIntensity,
      baseline.scene.backgroundIntensity,
    );
    assert.equal(
      (trial.scene.fog as T.FogExp2).density,
      (baseline.scene.fog as T.FogExp2).density,
    );
  }
  for (const orientation of ["southeast", "southwest", "south"] as const) {
    baseline.setDebugDaylightOrientation(orientation);
    trial.setDebugDaylightOrientation(orientation);
    assert.deepEqual(
      comparison.uniforms.waterHdrRotation.value.toArray(),
      waterOpticsRotation(trial.scene.backgroundRotation).toArray(),
    );
    assert.deepEqual(
      trial.water.uniforms.sunDir.value.toArray(),
      baseline.water.uniforms.sunDir.value.toArray(),
    );
  }
  comparison.dispose();
});


test("pre-PMREM continuation preserves upper solar radiance and azimuth but excludes lower mirrored emitters in both pixel orientations", () => {
  for (const flipY of [true, false]) {
    const width = 512, height = 256;
    const pixels = new Float32Array(width * height * 4);
    // Independent latitude-based source: upper sky varies by longitude, one
    // real solar texel at +28 degrees, and a fictitious lower solar image.
    const rowAt = (elevation: number) => Math.floor(height * (flipY ? .5 - elevation / 180 : .5 + elevation / 180));
    for (let row = 0; row < height; row++) {
      const elevation = (flipY ? .5 - (row + .5) / height : (row + .5) / height - .5) * 180;
      for (let x = 0; x < width; x++) {
        const i = (row * width + x) * 4;
        pixels.set(elevation > 0 ? [1 + x / width, .5, .25, 1] : [32, 32, 32, 1], i);
      }
    }
    pixels.set([16, 12, 8, 1], (rowAt(28) * width + 320) * 4);
    const source = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.FloatType);
    source.flipY = flipY;
    const filtered = waterOpticsInput(source);
    const result = filtered.image.data as Uint16Array;
    const rgb = (row: number, x: number) => Array.from(result.subarray((row * width + x) * 4, (row * width + x) * 4 + 3), T.DataUtils.fromHalfFloat);
    assert.deepEqual(rgb(rowAt(28), 320), [16, 12, 8]);
    for (const x of [0, 128, 320, 511]) {
      const upper = rgb(rowAt(.35), x);
      for (const elevation of [-.35, -1, -10, -28, -80])
        assert.deepEqual(rgb(rowAt(elevation), x), upper);
      assert.ok(upper[0] < 2 && upper[1] === .5 && upper[2] === .25);
    }
    assert.notDeepEqual(rgb(rowAt(-28), 0), rgb(rowAt(-28), 511));
    assert.equal(pixels[(rowAt(-28) * width + 320) * 4], 32);
    source.dispose(); filtered.dispose();
  }
});
