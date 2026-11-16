import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NorthHarbourWater } from "../src/world/north-harbour-water";
import { WaterWavesComparison } from "../src/world/water-waves";
import {
  WATER_PLANAR,
  WaterPlanarReflections,
} from "../src/world/water-planar-reflections";
import { fixture, compile, original } from "./helpers/north-water-fixture";
const frame = (
  now: number,
  quality = "balanced",
  enabled = true,
  allowCapture = true,
) => ({ now, quality, enabled, allowCapture });
function active(f = fixture()) {
  const owner = new NorthHarbourWater(f.context);
  owner.update(f.renderer, f.camera, frame(0));
  owner.update(f.renderer, f.camera, frame(1));
  return { f, owner };
}
test("normal lifecycle enables accepted planar, ripples and ocean-only directional normals without a debug URL or rejected optics", () => {
  const { f, owner } = active();
  const shader = compile(f.context.water);
  assert.equal(owner.diagnostics().status, "active");
  assert.equal(f.state.draws, 1);
  assert.equal(shader.uniforms.waterPlanarDistortion.value, 1);
  assert.equal(shader.uniforms.waterWavesEnabled.value, 1);
  assert.match(shader.fragmentShader, /abs\(vWorld.y-0.065\)<0.001/);
  assert.ok(!shader.fragmentShader.includes("waterHdrMap"));
  assert.ok(!shader.fragmentShader.includes("waterSceneMap"));
  assert.equal(owner.diagnostics().retainedTextureBytes, 2097152);
  assert.equal(owner.diagnostics().depthBudgetBytes, 1048576);
  owner.dispose();
  assert.equal(compile(f.context.water).fragmentShader, original);
  assert.equal(owner.diagnostics().retainedTextureBytes, 0);
});

test("day, quality, intro and geographic exits remove all owned layers and targets; re-entry can create a fresh capture", () => {
  for (const exit of ["region", "night", "low", "intro"]) {
    const { f, owner } = active();
    const hook = f.context.water.onBeforeCompile;
    if (exit === "region") f.camera.position.x += 400;
    if (exit === "night") owner.invalidate("night");
    owner.update(
      f.renderer,
      f.camera,
      frame(200, exit === "low" ? "low" : "balanced", exit !== "intro"),
    );
    assert.equal(owner.diagnostics().retainedTextureBytes, 0);
    assert.equal(owner.diagnostics().depthBudgetBytes, 0);
    assert.equal(compile(f.context.water).fragmentShader, original);
    assert.notEqual(f.context.water.onBeforeCompile, hook);
    if (exit === "region") f.camera.position.x -= 400;
    owner.invalidate("day");
    owner.update(f.renderer, f.camera, frame(201, "high"));
    owner.update(f.renderer, f.camera, frame(202, "high"));
    assert.equal(f.state.draws, 2);
    assert.equal(owner.diagnostics().status, "active");
    owner.dispose();
  }
  const f = fixture(),
    owner = new NorthHarbourWater(f.context);
  f.camera.position.x += 400;
  for (let i = 0; i < 10; i++) owner.update(f.renderer, f.camera, frame(i));
  assert.equal(f.state.draws, 0);
  assert.equal(owner.diagnostics().retainedTextureBytes, 0);
  owner.dispose();
});

test("cadence reuses texture and its exact capture projection together without a sky gap, while idle never recaptures", () => {
  const { f, owner } = active(),
    shader = compile(f.context.water);
  const texture = shader.uniforms.waterPlanarMap.value,
    matrix = (
      shader.uniforms.waterPlanarWorldProjection.value as T.Matrix4
    ).clone();
  f.camera.position.x += 0.5;
  f.camera.rotateY(0.02);
  for (const now of [20, 60, 100, 125]) {
    owner.update(f.renderer, f.camera, frame(now));
    assert.equal(f.state.draws, 1);
    assert.equal(shader.uniforms.waterPlanarMap.value, texture);
    assert.deepEqual(shader.uniforms.waterPlanarWorldProjection.value, matrix);
    assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
    assert.equal(shader.uniforms.waterWavesEnabled.value, 1);
  }
  owner.update(f.renderer, f.camera, frame(126));
  assert.equal(f.state.draws, 2);
  assert.notDeepEqual(shader.uniforms.waterPlanarWorldProjection.value, matrix);
  for (let i = 0; i < 100; i++)
    owner.update(f.renderer, f.camera, frame(1000 + i * 20));
  assert.equal(f.state.draws, 2);
  owner.dispose();
});

test("ordinary moving capture cadence is bounded and explicit dirty lighting refresh bypasses it without stale sampling", () => {
  const { f, owner } = active(),
    shader = compile(f.context.water);
  for (let t = 10; t <= 1000; t += 10) {
    f.camera.position.x += 0.1;
    owner.update(f.renderer, f.camera, frame(t));
  }
  assert.ok(f.state.draws <= 8);
  const before = f.state.draws;
  owner.invalidate("day");
  owner.update(f.renderer, f.camera, frame(1001, "balanced", true, false));
  assert.equal(shader.uniforms.waterPlanarWeight.value, 0);
  assert.equal(shader.uniforms.waterWavesEnabled.value, 0);
  assert.equal(f.state.draws, before);
  owner.update(f.renderer, f.camera, frame(1002));
  assert.equal(f.state.draws, before + 1);
  assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
  owner.dispose();
});

test("camera eligibility fade also blends ocean normals and failure tears down rather than retrying each frame", () => {
  const { f, owner } = active(),
    shader = compile(f.context.water);
  f.camera.position.x = WATER_PLANAR.viewerCentre[0] + 140;
  f.camera.position.z = WATER_PLANAR.viewerCentre[1];
  owner.update(f.renderer, f.camera, frame(20));
  assert.ok(
    shader.uniforms.waterWavesEnabled.value > 0 &&
      shader.uniforms.waterWavesEnabled.value < 1,
  );
  assert.equal(
    shader.uniforms.waterWavesEnabled.value,
    shader.uniforms.waterPlanarWeight.value,
  );
  owner.dispose();
  const failed = fixture(true),
    bad = new NorthHarbourWater(failed.context);
  bad.update(failed.renderer, failed.camera, frame(0));
  bad.update(failed.renderer, failed.camera, frame(1));
  assert.equal(bad.diagnostics().status, "error");
  assert.equal(bad.diagnostics().retainedTextureBytes, 0);
  for (let t = 10; t < 1000; t += 10)
    bad.update(failed.renderer, failed.camera, frame(t));
  assert.equal(failed.state.draws, 1);
  assert.equal(compile(failed.context.water).fragmentShader, original);
  bad.dispose();
});

test("comparison suspension removes production owners without disrupting a subsequent independent debug owner", () => {
  const { f, owner } = active();
  owner.suspend("debug comparison");
  const debug = new WaterWavesComparison(f.context.water);
  debug.update("day");
  owner.update(f.renderer, f.camera, frame(500, "balanced", false));
  assert.match(compile(f.context.water).fragmentShader, /harbourWaveNormal/);
  assert.ok(
    !compile(f.context.water).fragmentShader.includes("waterPlanarMap"),
  );
  debug.dispose();
  owner.update(f.renderer, f.camera, frame(501));
  owner.update(f.renderer, f.camera, frame(502));
  assert.equal(f.state.draws, 2);
  f.context.water.dispose();
  owner.dispose();
  assert.equal(owner.diagnostics().status, "disposed");
  assert.equal(owner.diagnostics().retainedTextureBytes, 0);
});

test("production capture retains actual mirrored camera clipping and texture projection registration", () => {
  const { f, owner } = active(),
    reflected = f.virtual();
  assert.ok(
    Math.abs(
      reflected.position.y - (2 * WATER_PLANAR.level - f.camera.position.y),
    ) < 1e-10,
  );
  for (const y of [-1, 1]) {
    const q = new T.Vector4(686, y, -900, 1)
      .applyMatrix4(reflected.matrixWorldInverse)
      .applyMatrix4(reflected.projectionMatrix);
    assert.ok((q.z + q.w) * y > 0);
  }
  const matrix = compile(f.context.water).uniforms.waterPlanarWorldProjection
    .value as T.Matrix4;
  const p = new T.Vector4(700, WATER_PLANAR.level, -1000, 1),
    projected = p.clone().applyMatrix4(matrix);
  const game = p
    .clone()
    .applyMatrix4(f.camera.matrixWorldInverse)
    .applyMatrix4(f.camera.projectionMatrix);
  assert.ok(
    Math.abs(projected.x / projected.w - (0.5 - (game.x / game.w) * 0.5)) <
      1e-10,
  );
  assert.ok(
    Math.abs(projected.y / projected.w - (0.5 + (game.y / game.w) * 0.5)) <
      1e-10,
  );
  owner.dispose();
});

test("renderer-style cached programs read new owner uniforms after region re-entry with bounded variant keys", () => {
  const f = fixture(),
    m = f.context.water,
    owner = new NorthHarbourWater(f.context);
  // Installed WebGLPrograms.getUniforms returns material.uniforms itself;
  // WebGLRenderer only invokes onBeforeCompile on a program-key cache miss.
  const programs = new Map<
    string,
    Parameters<T.Material["onBeforeCompile"]>[0]
  >();
  const draw = () => {
    const key = m.customProgramCacheKey();
    let shader = programs.get(key);
    if (!shader) {
      shader = {
        fragmentShader: m.fragmentShader,
        vertexShader: "",
        uniforms: m.uniforms,
      } as unknown as Parameters<T.Material["onBeforeCompile"]>[0];
      m.onBeforeCompile(shader, f.renderer);
      programs.set(key, shader);
    }
    return shader;
  };
  let firstKey = "";
  for (let entry = 0; entry < 12; entry++) {
    owner.update(f.renderer, f.camera, frame(entry * 1000));
    owner.update(f.renderer, f.camera, frame(entry * 1000 + 1));
    const shader = draw();
    if (!entry) firstKey = m.customProgramCacheKey();
    else assert.equal(m.customProgramCacheKey(), firstKey);
    assert.equal(shader.uniforms.waterPlanarWeight.value, 1);
    assert.ok(shader.uniforms.waterPlanarMap.value instanceof T.Texture);
    assert.equal(shader.uniforms.waterPlanarDistortion.value, 1);
    assert.equal(shader.uniforms.waterWavesEnabled.value, 1);
    owner.suspend("test exit");
    draw();
  }
  assert.equal(
    programs.size,
    2,
    "re-entry must not create a unique program key per owner",
  );
  const debug = new WaterWavesComparison(m);
  debug.update("day");
  const debugKey = m.customProgramCacheKey();
  assert.notEqual(debugKey, firstKey);
  const debugShader = draw();
  assert.ok(!debugShader.fragmentShader.includes("abs(vWorld.y-0.065)<0.001"));
  debug.dispose();
  const ocean = new WaterWavesComparison(m, 0.065);
  ocean.setWeight(1);
  assert.notEqual(
    m.customProgramCacheKey(),
    debugKey,
    "different GLSL needs a distinct stable variant key",
  );
  assert.match(draw().fragmentShader, /abs\(vWorld.y-0.065\)<0.001/);
  ocean.dispose();
  owner.dispose();
});

test("failed duplicate registration cannot replace the active owner uniform bindings", () => {
  const { f, owner } = active(),
    planar = f.context.water.uniforms.waterPlanarMap,
    waves = f.context.water.uniforms.waterWavesEnabled;
  assert.throws(
    () => new WaterPlanarReflections(f.context),
    /Duplicate water shader layer/,
  );
  assert.throws(
    () => new WaterWavesComparison(f.context.water, 0.065),
    /Duplicate water shader layer/,
  );
  assert.equal(f.context.water.uniforms.waterPlanarMap, planar);
  assert.ok(planar.value instanceof T.Texture);
  assert.equal(f.context.water.uniforms.waterWavesEnabled, waves);
  assert.equal(waves.value, 1);
  owner.dispose();
});
