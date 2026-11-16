import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  filteredPicket,
  IronworkersPicketSelection,
  installIronworkersPicketSelection,
} from "../src/world/ironworkers-picket-selection";
import { ironworkersBandlimitedCoverage } from "../src/world/ironworkers-picket-radiance";
import { createIronworkersPathBoundary } from "../src/world/ironworkers-path-boundary";
import {
  ironworkersPoint,
  ironworkersTAtDistance,
  ironworkersGradeT,
} from "../src/world/ironworkers-alignment";
import { BRIDGES, bridgeY } from "../src/world/collision";

const section = { width: 0.05, depth: 0.04, pitch: 0.13 };
test("subpixel periodic modulation is eliminated while exact mean and grazing occlusion survive", () => {
  for (const slope of [0, 0.5, 1.8, 2, 5, -5])
    for (const footprint of [0.1, 0.3, 0.5, 0.75, 1.5, 7]) {
      let front = 0,
        side = 0,
        min = 1,
        max = 0;
      for (let i = 0; i < 2048; i++) {
        const value = ironworkersBandlimitedCoverage(
          section,
          (i + 0.5) / 2048,
          footprint,
          slope,
        );
        front += value.front;
        side += value.side;
        min = Math.min(min, value.total);
        max = Math.max(max, value.total);
        if (Math.abs(slope) >= 2)
          assert.ok(
            Math.abs(value.total - 1) < 1e-10,
            "full legal occlusion is never thinned",
          );
      }
      assert.ok(Math.abs(front / 2048 - section.width / section.pitch) < 1e-5);
      assert.ok(
        Math.abs(
          side / 2048 -
            Math.min(
              (section.depth * Math.abs(slope)) / section.pitch,
              1 - section.width / section.pitch,
            ),
        ) < 1e-5,
      );
      if (footprint >= 0.75)
        assert.ok(max - min < 1e-12, "no residual multi-pixel wave phase");
    }
  assert.equal(filteredPicket(2.9, 20, false), true);
  assert.equal(filteredPicket(3.2, 20, true), true);
  assert.equal(filteredPicket(3.5, 20, true), false);
  assert.equal(filteredPicket(3.2, 20, false), false);
  assert.equal(filteredPicket(0.1, 10, true), false);
});
function invoke(scene: T.Scene, camera: T.Camera, viewport: T.Vector4) {
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const renderer = {
    getCurrentViewport: (out: T.Vector4) => out.copy(viewport),
  } as T.WebGLRenderer;
  // Three182 passes four arguments for Scene, despite inherited Object3D types.
  (scene.onBeforeRender as Function).call(scene, renderer, scene, camera, null);
}
const transforms = (mesh: T.InstancedMesh) =>
  Array.from({ length: mesh.count }, (_, i) =>
    Array.from(mesh.instanceMatrix.array.slice(i * 16 + 12, i * 16 + 15)).join(
      ",",
    ),
  ).sort();
test("real bridge selector uses this render viewport, conserves every bar and restores close physical geometry", (t) => {
  const bridge = BRIDGES.find((b) => b.id === "ironworkers")!,
    height = (u: number) => bridgeY(bridge, u, [0, 0]);
  const boundary = createIronworkersPathBoundary(height, () => 0.07),
    view = boundary.createRenderGroup(
      new T.MeshBasicMaterial(),
      new T.MeshStandardMaterial(),
      { filterTrial: true },
    );
  const scene = new T.Scene();
  scene.add(view.group);
  const cells = view.group.children.filter((o) => o instanceof T.Group),
    all = cells.flatMap((c) => c.children) as T.InstancedMesh[];
  const original = new Map<T.InstancedMesh, string[]>();
  for (let i = 0; i < all.length; i += 2)
    original.set(all[i], transforms(all[i]));
  const camera = new T.PerspectiveCamera(62, 821 / 871, 0.1, 3000),
    viewport = new T.Vector4(0, 0, 821, 871);
  let mixed = 0,
    nearCount = 0,
    farCount = 0;
  for (const station of [64, 80, 96, 200, 640]) {
    const [x, z] = ironworkersPoint(ironworkersTAtDistance(station), 12.5);
    camera.position.set(x, height(ironworkersGradeT(x, z)) + 3.8, z);
    camera.lookAt(x, camera.position.y - 1, z - 50);
    invoke(scene, camera, viewport);
    mixed = 0;
    nearCount = 0;
    farCount = 0;
    for (let i = 0; i < all.length; i += 2) {
      const near = all[i],
        far = all[i + 1];
      assert.deepEqual(
        [...transforms(near), ...transforms(far)].sort(),
        original.get(near),
      );
      if (near.count && far.count) mixed++;
      nearCount += near.count;
      farCount += far.count;
      const m = new T.Matrix4(),
        p = new T.Vector3(),
        a = new T.Vector3(),
        b = new T.Vector3();
      for (let j = 0; j < far.count; j++) {
        far.getMatrixAt(j, m);
        p.setFromMatrixPosition(m).applyMatrix4(far.matrixWorld);
        assert.ok(
          p.distanceTo(camera.position) > 11.5,
          "all physical surface within10m remains near",
        );
        a.set(
          m.elements[12] - 0.5 * m.elements[0],
          m.elements[13] - 0.5 * m.elements[1],
          m.elements[14] - 0.5 * m.elements[2],
        )
          .applyMatrix4(far.matrixWorld)
          .project(camera);
        b.set(
          m.elements[12] + 0.5 * m.elements[0],
          m.elements[13] + 0.5 * m.elements[1],
          m.elements[14] + 0.5 * m.elements[2],
        )
          .applyMatrix4(far.matrixWorld)
          .project(camera);
        // Ignore points behind the beauty camera; their broadphase is deliberately far.
        const viewP = p.clone().applyMatrix4(camera.matrixWorldInverse);
        if (viewP.z < 0)
          assert.ok(
            Math.hypot(
              ((a.x - b.x) * viewport.z) / 2,
              ((a.y - b.y) * viewport.w) / 2,
            ) < 3.5001,
          );
      }
    }
    assert.equal(nearCount + farCount, view.stats.pickets);
  }
  t.diagnostic(
    `station640: ${nearCount} physical/${farCount} filtered bars; ${mixed} mixed side chunks; at most${45 + mixed} nonzero draws`,
  );
  // A different actual target size changes selection immediately, not next frame.
  invoke(scene, camera, new T.Vector4(0, 0, 128, 128));
  const low = all
    .filter((_, i) => i % 2 === 0)
    .reduce((s, m) => s + m.count, 0);
  invoke(scene, camera, new T.Vector4(0, 0, 3284, 3484));
  const high = all
    .filter((_, i) => i % 2 === 0)
    .reduce((s, m) => s + m.count, 0);
  assert.ok(high > low);
  const snapshots = all.map((m) => m.instanceMatrix.array.slice()),
    versions = all.map((m) => m.instanceMatrix.version);
  invoke(scene, camera, new T.Vector4(0, 0, 3284, 3484));
  all.forEach((m, i) => {
    assert.deepEqual(m.instanceMatrix.array, snapshots[i]);
    assert.equal(
      m.instanceMatrix.version,
      versions[i],
      "stationary frame needs no matrix upload",
    );
  });
  view.disposeSelection?.();
});

test("actual Scene callback chains prior handlers and survives detached roots, multiple fences and removal", () => {
  const make = () => {
    const group = new T.Group(),
      near = new T.InstancedMesh(
        new T.BoxGeometry(),
        new T.MeshBasicMaterial(),
        1,
      ),
      far = new T.InstancedMesh(
        new T.PlaneGeometry(),
        new T.MeshBasicMaterial(),
        1,
      );
    near.setMatrixAt(0, new T.Matrix4().makeTranslation(0, 0, -100));
    far.setMatrixAt(
      0,
      new T.Matrix4().makeScale(0.13, 3, 1).setPosition(0, 0, -100),
    );
    near.computeBoundingSphere();
    far.computeBoundingSphere();
    group.add(near, far);
    const selector = new IronworkersPicketSelection(near, far, 0.13);
    return {
      group,
      near,
      far,
      dispose: installIronworkersPicketSelection(group, [selector]),
    };
  };
  const scene = new T.Scene(),
    parent = new T.Group(),
    a = make(),
    b = make();
  let calls = 0;
  const original = () => {
    calls++;
  };
  scene.onBeforeRender = original;
  parent.add(a.group, b.group);
  scene.add(parent);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 200),
    viewport = new T.Vector4(0, 0, 128, 128);
  invoke(scene, camera, viewport);
  assert.equal(calls, 1);
  assert.equal(a.near.count, 0);
  assert.equal(b.near.count, 0);
  parent.remove(a.group);
  a.dispose();
  assert.notEqual(scene.onBeforeRender, original);
  parent.remove(b.group);
  b.dispose();
  assert.equal(scene.onBeforeRender, original);
  invoke(scene, camera, viewport);
  assert.equal(calls, 2);
});
