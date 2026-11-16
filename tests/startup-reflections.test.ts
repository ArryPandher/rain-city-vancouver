import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { SceneReflections } from "../src/rendering/reflection-probes";
import {
  prepareStartupReflections,
  nextNearbyReflection,
} from "../src/rendering/startup-reflections";

function fixture() {
  const scene = new T.Scene(),
    root = new T.Group(),
    sun = new T.DirectionalLight();
  scene.add(root, sun, sun.target);
  scene.environment = new T.Texture();
  sun.position.set(100, 160, 100);
  const definitions: [string, [number, number, number]][] = [
    ["distant first in source order", [2000, 3, 0]],
    ["local lobby", [0, 3, 0]],
    ["near tall tower", [175, 300, 0]],
    ["strict boundary", [180, 3, 0]],
    ["other neighborhood", [-2000, 3, 0]],
  ];
  const materials = definitions.map(
    () => new T.MeshPhysicalMaterial({ roughness: 0.2 }),
  );
  const reflections = new SceneReflections(
    scene,
    root,
    [],
    sun,
    definitions.map(([name, position], i) => ({
      name,
      position,
      materials: [materials[i]],
    })),
  );
  const captures: string[] = [];
  reflections.probes.forEach((p) => {
    p.camera.update = () => {
      captures.push(p.spec.name);
    };
  });
  const renderer = {
    shadowMap: { autoUpdate: true, needsUpdate: false },
    xr: { enabled: false },
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget() {},
  } as unknown as T.WebGLRenderer;
  const viewer = new T.Vector3();
  const stages: string[] = [];
  const options = {
    reflections,
    viewer: () => viewer,
    enabled: () => true,
    beforeCapture: async (name: string) => {
      stages.push(name);
    },
    capture: (p: { x: number; y: number; z: number }) =>
      reflections.update(renderer, new T.Vector3(p.x, p.y, p.z)),
  };
  return {
    scene,
    reflections,
    materials,
    renderer,
    viewer,
    captures,
    stages,
    options,
  };
}

test("startup prepares only actual local receivers and leaves deferred glass on unchanged sky fallback", async () => {
  const f = fixture(),
    sky = f.scene.environment;
  try {
    const result = await prepareStartupReflections(f.options);
    assert.deepEqual(result, {
      total: 5,
      initiallyNearby: 2,
      attempted: 2,
      captured: 2,
      deferredDirty: 3,
    });
    assert.deepEqual(f.captures, ["local lobby", "near tall tower"]);
    assert.deepEqual(f.stages, f.captures);
    assert.equal(f.scene.environment, sky);
    for (const i of [0, 3, 4]) {
      assert.equal(f.materials[i].envMap, null);
      assert.equal(f.reflections.probes[i].dirty, true);
      assert.equal(
        f.reflections.currentTexture(f.reflections.probes[i].spec.name),
        null,
      );
    }
    for (const i of [1, 2])
      assert.equal(
        f.materials[i].envMap,
        f.reflections.probes[i].target.texture,
      );
    assert.equal(
      nextNearbyReflection(f.reflections.probes, new T.Vector3(NaN, 0, 0)),
      undefined,
    );
  } finally {
    f.reflections.dispose();
  }
});

test("first render after fast travel lazily prepares distant probe; weather invalidation retains sky until recapture", async () => {
  const f = fixture(),
    sky = f.scene.environment;
  try {
    await prepareStartupReflections(f.options);
    f.viewer.set(2000, 4, 0);
    f.reflections.update(f.renderer, f.viewer);
    assert.equal(f.captures.at(-1), "distant first in source order");
    assert.equal(f.reflections.probes[0].valid, true);
    // Weather/heading changes keep their existing generation contract.
    f.reflections.setNight(true);
    f.reflections.invalidate();
    assert.ok(f.materials.every((m) => m.envMap === null));
    assert.equal(f.scene.environment, sky);
    f.reflections.update(f.renderer, f.viewer);
    assert.equal(f.reflections.probes[0].valid, true);
    assert.equal(f.reflections.probes[1].valid, false);
    f.viewer.set(0, 4, 0);
    f.reflections.update(f.renderer, f.viewer);
    assert.equal(f.reflections.probes[1].valid, true);
    assert.equal(
      f.reflections.probes[2].dirty,
      true,
      "one capture per normal update, not a travel burst",
    );
  } finally {
    f.reflections.dispose();
  }
});

test("low quality does no startup capture and an upgrade uses the existing lazy path", async () => {
  const f = fixture();
  try {
    const summary = await prepareStartupReflections({
      ...f.options,
      enabled: () => false,
    });
    assert.equal(summary.attempted, 0);
    assert.equal(summary.deferredDirty, 5);
    assert.deepEqual(f.stages, []);
    assert.ok(f.materials.every((m) => m.envMap === null));
    f.reflections.update(f.renderer, f.viewer);
    assert.deepEqual(f.captures, ["local lobby"]);
  } finally {
    f.reflections.dispose();
  }
});

test("loading-stage yields recheck actual position and quality instead of capturing obsolete queued regions", async () => {
  for (const action of ["travel", "low"] as const) {
    const f = fixture();
    let enabled = true,
      changed = false;
    try {
      const result = await prepareStartupReflections({
        ...f.options,
        enabled: () => enabled,
        beforeCapture: async () => {
          if (changed) return;
          changed = true;
          if (action === "travel") f.viewer.set(-2000, 3, 0);
          else enabled = false;
        },
      });
      assert.equal(
        f.reflections.probes[1].valid,
        false,
        "old nearby region was not prepared",
      );
      assert.deepEqual(
        f.captures,
        action === "travel" ? ["other neighborhood"] : [],
      );
      assert.ok(result.attempted <= result.initiallyNearby);
    } finally {
      f.reflections.dispose();
    }
  }
});

test("a callback invalidating the capture cannot cause stale publish or unbounded startup retries", async () => {
  const f = fixture();
  try {
    f.reflections.probes[1].camera.update = () => {
      f.reflections.invalidate();
    };
    const result = await prepareStartupReflections(f.options);
    assert.equal(result.attempted, 1);
    assert.equal(result.captured, 0);
    assert.equal(result.deferredDirty, 5);
    assert.equal(f.materials[1].envMap, null);
    f.reflections.probes[1].camera.update = () => {};
    f.reflections.update(f.renderer, f.viewer);
    assert.equal(
      f.reflections.probes[1].valid,
      true,
      "normal lazy retry still works",
    );
  } finally {
    f.reflections.dispose();
  }
});

test("failed local capture keeps sky and does not prevent the next initial receiver from preparing", async () => {
  const f = fixture(),
    warn = console.warn;
  try {
    f.reflections.probes[1].camera.update = () => {
      throw Error("controlled capture failure");
    };
    console.warn = () => {};
    const result = await prepareStartupReflections(f.options);
    assert.equal(result.attempted, 2);
    assert.equal(result.captured, 1);
    assert.equal(f.materials[1].envMap, null);
    assert.equal(f.reflections.probes[1].dirty, false);
    assert.equal(f.reflections.probes[2].valid, true);
  } finally {
    console.warn = warn;
    f.reflections.dispose();
  }
});

test("main startup uses live player readiness while actual render still captures lazily before drawing", () => {
  const source = fs.readFileSync("src/main.ts", "utf8");
  const start = source.indexOf("await prepareStartupReflections(");
  assert.ok(start > 0);
  const block = source.slice(
    start,
    source.indexOf("// Filter existing street captures", start),
  );
  assert.match(block, /viewer: \(\) => this\.player/);
  assert.match(block, /enabled: \(\) => this\.quality !== "low"/);
  assert.doesNotMatch(block, /world\.reflections\.entries|probe\.position/);
  const render = source.slice(source.indexOf("  render() {"));
  assert.match(render, /if \(!ui\.introOpen && this\.quality !== "low"\)/);
  assert.ok(
    render.indexOf("this.reflections?.update(") <
      render.indexOf("this.composer.render()"),
  );
  assert.ok(render.includes("this.photo ? this.photoPos : this.player"));
});

test("a probe prepared by another update during a loading yield is not captured twice or counted as startup work", async () => {
  const f = fixture();
  let intervened = false;
  try {
    const summary = await prepareStartupReflections({
      ...f.options,
      beforeCapture: async () => {
        if (!intervened) {
          intervened = true;
          f.reflections.update(f.renderer, f.viewer);
        }
      },
    });
    assert.deepEqual(f.captures, ["local lobby", "near tall tower"]);
    assert.equal(summary.attempted, 1);
    assert.equal(summary.captured, 1);
    assert.equal(f.reflections.captures, 2);
    assert.equal(summary.deferredDirty, 3);
  } finally {
    f.reflections.dispose();
  }
});
