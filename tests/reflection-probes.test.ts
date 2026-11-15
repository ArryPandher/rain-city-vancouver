import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { SceneReflections } from "../src/rendering/reflection-probes";

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
    reflections.dispose();
    previous.dispose();
  });
