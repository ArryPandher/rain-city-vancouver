import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { SceneReflections } from "../src/rendering/reflection-probes";

test("focal captures use fixed 256/512 faces while ordinary probes retain 128 and weather reuses targets", () => {
  const reflections = new SceneReflections(
    new T.Scene(),
    new T.Group(),
    [],
    new T.DirectionalLight(),
    [
      { name: "ordinary", position: [0, 2, 0], materials: [] },
      {
        name: "focal windows",
        position: [4, 12, 0],
        materials: [],
        resolution: 256,
      },
      {
        name: "close street windows",
        position: [8, 12, 0],
        materials: [],
        resolution: 512,
      },
    ],
  );
  const targets = reflections.probes.map((probe) => probe.target);
  assert.deepEqual(
    targets.map((target) => [target.width, target.height]),
    [
      [128, 128],
      [256, 256],
      [512, 512],
    ],
  );
  for (const target of targets) {
    assert.equal(target.texture.type, T.HalfFloatType);
    assert.equal(target.texture.format, T.RGBAFormat);
    assert.equal(target.texture.generateMipmaps, true);
    assert.equal(target.depthBuffer, true);
    assert.equal(target.stencilBuffer, false);
    assert.equal(target.samples, 0);
  }
  for (let i = 0; i < 3; i++) reflections.invalidate();
  assert.deepEqual(
    reflections.probes.map((probe) => probe.target),
    targets,
  );
  const disposed: string[] = [];
  targets.forEach((target, i) =>
    target.addEventListener("dispose", () => disposed.push(String(i))),
  );
  reflections.dispose();
  assert.deepEqual(disposed, ["0", "1", "2"]);
});

test("authored reflection intensities follow night and restore daylight without changing other probes", () => {
  const dayGlass = new T.MeshPhysicalMaterial({ envMapIntensity: 1.05 });
  const unchanged = new T.MeshPhysicalMaterial({ envMapIntensity: 0.4 });
  const reflections = new SceneReflections(
    new T.Scene(),
    new T.Group(),
    [],
    new T.DirectionalLight(),
    [
      {
        name: "tower",
        position: [0, 2, 0],
        materials: [dayGlass],
        intensity: { day: 1.05, night: 0.2 },
      },
      { name: "basin", position: [20, 2, 0], materials: [unchanged] },
    ],
  );
  reflections.setNight(true);
  assert.equal(dayGlass.envMapIntensity, 0.2);
  assert.equal(unchanged.envMapIntensity, 0.4);
  reflections.invalidate();
  assert.equal(dayGlass.envMapIntensity, 0.2);
  reflections.setNight(false);
  assert.equal(dayGlass.envMapIntensity, 1.05);
  reflections.dispose();
});

for (const fail of [false, true])
  test(`local reflections restore scene and renderer state after ${fail ? "a capture failure" : "capture"}`, () => {
    const scene = new T.Scene();
    const root = new T.Group();
    const sun = new T.DirectionalLight();
    sun.position.set(100, 330, 250);
    sun.target.position.set(40, 27, 50);
    const actor = new T.Group();
    const nearby = new T.Mesh(
      new T.BoxGeometry(),
      new T.MeshStandardMaterial(),
    );
    nearby.visible = false;
    nearby.castShadow = false;
    nearby.userData.center = [10, 15];
    nearby.position.set(10, 1, 15); // Actual caster bounds, not only a cell label.
    const material = new T.MeshPhysicalMaterial();
    const surface = new T.Mesh(new T.PlaneGeometry(), material);
    root.add(nearby, surface);
    scene.add(root, sun, sun.target, actor);
    const reflections = new SceneReflections(scene, root, [nearby], sun, [
      { name: "test basin", position: [10, 1, 15], materials: [material] },
    ]);
    const previous = new T.WebGLRenderTarget(8, 8);
    let restored: unknown[] = [];
    const renderer = {
      shadowMap: { autoUpdate: true, needsUpdate: false },
      xr: { enabled: true },
      getRenderTarget: () => previous,
      getActiveCubeFace: () => 3,
      getActiveMipmapLevel: () => 2,
      setRenderTarget: (...args: unknown[]) => {
        restored = args;
      },
    } as unknown as T.WebGLRenderer;
    reflections.probes[0].camera.update = () => {
      assert.deepEqual(
        sun.position.clone().sub(sun.target.position).toArray(),
        [60, 303, 200],
        "probe preserves full sun-target direction at nonzero ground height",
      );
      assert.deepEqual(
        sun.target.position.toArray(),
        [10, 1, 15],
        "capture pair is translated to the probe",
      );
      assert.equal(actor.visible, false, "moving actor is omitted");
      assert.equal(surface.visible, false, "surface cannot reflect itself");
      assert.equal(
        nearby.visible,
        true,
        "probe uses its own static visibility",
      );
      assert.equal(nearby.castShadow, true);
      renderer.xr.enabled = false;
      if (fail) throw new Error("simulated graphics failure");
    };
    const warn = console.warn;
    assert.equal(reflections.currentTexture("test basin"), null);
    assert.equal(reflections.probes[0].valid, false);
    try {
      if (fail) console.warn = () => {};
      reflections.update(renderer, new T.Vector3(10, 1, 15));
    } finally {
      console.warn = warn;
    }
    assert.equal(actor.visible, true);
    assert.equal(surface.visible, true);
    assert.equal(nearby.visible, false);
    assert.equal(nearby.castShadow, false);
    assert.deepEqual(sun.position.toArray(), [100, 330, 250]);
    assert.deepEqual(sun.target.position.toArray(), [40, 27, 50]);
    assert.equal(renderer.shadowMap.autoUpdate, true);
    assert.equal(renderer.shadowMap.needsUpdate, true);
    assert.equal(renderer.xr.enabled, true);
    assert.deepEqual(restored, [previous, 3, 2]);
    assert.equal(
      reflections.probes[0].dirty,
      false,
      "failure does not repeat every frame",
    );
    assert.equal(reflections.captures, fail ? 0 : 1);
    assert.equal(reflections.probes[0].valid, !fail);
    assert.equal(
      reflections.currentTexture("test basin"),
      fail ? null : reflections.probes[0].target.texture,
    );
    if (fail) {
      assert.equal(material.envMap, null, "sky fallback remains available");
      assert.match(reflections.lastError!, /simulated graphics failure/);
    } else assert.equal(material.envMap, reflections.probes[0].target.texture);
    reflections.invalidate();
    assert.equal(
      material.envMap,
      null,
      "weather change removes stale lighting",
    );
    assert.equal(reflections.probes[0].dirty, true);
    assert.equal(reflections.currentTexture("test basin"), null);
    assert.equal(reflections.probes[0].valid, false);
    reflections.dispose();
    previous.dispose();
  });

test("capture invalidated during rendering cannot become current or publish a borrowed texture", () => {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight(),
    material = new T.MeshPhysicalMaterial();
  scene.add(root, sun, sun.target);
  const reflections = new SceneReflections(scene, root, [], sun, [
    { name: "street", position: [0, 2, 0], materials: [material] },
  ]);
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: false },
    xr: { enabled: false },
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: () => {},
  } as unknown as T.WebGLRenderer;
  reflections.probes[0].camera.update = () => reflections.invalidate();
  reflections.update(renderer, new T.Vector3());
  assert.equal(reflections.currentTexture("street"), null);
  assert.equal(reflections.probes[0].dirty, true);
  assert.equal(reflections.probes[0].valid, false);
  assert.equal(reflections.captures, 0);
  assert.equal(material.envMap, null);
  reflections.probes[0].camera.update = () => {};
  reflections.update(renderer, new T.Vector3());
  assert.equal(
    reflections.currentTexture("street"),
    reflections.probes[0].target.texture,
  );
  assert.equal(reflections.captures, 1);
  reflections.dispose();
});
