import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher, walls } from "../src/world/geometry";
import { profileRender } from "../src/rendering/render-profile";
import { batchPhotographicFacades } from "../src/world/photographic-facade-batch";

function fixture() {
  const root = new T.Group();
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    map: new T.Texture(),
  });
  const builder = new Batcher(root, 270);
  for (const [x, z] of [
    [0, 0],
    [280, 0],
    [-280, 0],
  ]) {
    const geometry = walls(
      [x - 2, z - 2, x + 2, z - 2, x + 2, z + 2, x - 2, z + 2],
      5,
    );
    geometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(
        Array.from(
          { length: geometry.attributes.position.count * 3 },
          (_, i) => 0.4 + i / 100,
        ),
        3,
      ),
    );
    builder.add(geometry, material, x, z);
  }
  const chunks = builder.finish();
  root.updateMatrixWorld(true);
  return { root, material, chunks };
}
function camera(x: number, width = 10) {
  const c = new T.OrthographicCamera(-width, width, 10, -10, 0.1, 100);
  c.position.set(x, 3, 20);
  c.lookAt(x, 3, 0);
  c.updateMatrixWorld(true);
  return c;
}
const dispatched = (batch: T.BatchedMesh) =>
  (batch as unknown as { _multiDrawCount: number })._multiDrawCount;

test("unsupported capability preserves original mesh objects, materials and cell policy", () => {
  const { root, chunks, material } = fixture();
  const children = root.children.slice();
  assert.deepEqual(
    batchPhotographicFacades(root, chunks, [material], false),
    [],
  );
  assert.deepEqual(root.children, children);
  assert.ok(
    chunks.every(
      (c) =>
        c.parent === root &&
        c.material === material &&
        c.castShadow &&
        c.receiveShadow,
    ),
  );
});

test("batch retains exact per-cell attributes, topology, material and spatial records", () => {
  const { root, chunks, material } = fixture();
  const centers = chunks.map((c) => c.userData.center.slice());
  const [batch] = batchPhotographicFacades(root, chunks, [material], true);
  assert.equal(batch.material, material);
  assert.equal(batch.perObjectFrustumCulled, true);
  assert.equal(root.children.length, 1);
  assert.ok(chunks.every((c) => c.parent === null));
  assert.deepEqual(
    chunks.map((c) => c.userData.center),
    centers,
  );
  chunks.forEach((source, id) => {
    const range = batch.getGeometryRangeAt(id)!;
    for (const [name, attribute] of Object.entries(
      source.geometry.attributes,
    )) {
      const actual = batch.geometry.getAttribute(name);
      const begin = range.vertexStart * attribute.itemSize;
      assert.deepEqual(
        Array.from(actual.array.slice(begin, begin + attribute.array.length)),
        Array.from(attribute.array),
        name,
      );
    }
    const indices = batch.geometry.index!.array.slice(
      range.indexStart,
      range.indexStart + range.indexCount,
    );
    assert.deepEqual(
      Array.from(indices, (i) => i - range.vertexStart),
      Array.from(source.geometry.index!.array),
    );
    assert.deepEqual(
      batch.getMatrixAt(id, new T.Matrix4()).elements,
      source.matrix.elements,
    );
  });
});

test("beauty, multiple shadow cameras and reflection views independently match original chunk eligibility", () => {
  const { root, chunks, material } = fixture();
  const [batch] = batchPhotographicFacades(root, chunks, [material], true);
  root.updateMatrixWorld(true);
  chunks[0].castShadow = false; // Visible shell beyond the existing shadow cutoff.
  chunks[1].castShadow = true; // Offscreen in main view, visible to a shadow camera.
  chunks[2].visible = false; // Existing per-cell distance policy rejects this cell.
  const renderer = {} as T.WebGLRenderer;
  const scene = new T.Scene(),
    depth = new T.MeshDepthMaterial();
  const main = camera(0),
    reflection = camera(280),
    wideShadow = camera(0, 400),
    leftShadow = camera(-280);
  const expected = (view: T.Camera, shadow: boolean) => {
    const f = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(
        view.projectionMatrix,
        view.matrixWorldInverse,
      ),
    );
    return chunks.filter(
      (c) => c.visible && (!shadow || c.castShadow) && f.intersectsObject(c),
    ).length;
  };
  for (const [view, shadow] of [
    [wideShadow, true],
    [main, false],
    [leftShadow, true],
    [reflection, false],
    [wideShadow, true],
    [main, false],
  ] as const) {
    if (shadow)
      batch.onBeforeShadow(
        renderer,
        batch as unknown as T.Scene,
        main,
        view,
        batch.geometry,
        depth,
        null as never,
      );
    else
      batch.onBeforeRender(
        renderer,
        scene,
        view,
        batch.geometry,
        material,
        null as never,
      );
    assert.equal(dispatched(batch), expected(view, shadow));
    assert.equal(batch.visible, true);
  }
  assert.equal(expected(main, false), 1);
  assert.equal(expected(wideShadow, true), 1);
  chunks[2].visible = true; // Moving back into range must restore the same source cell.
  batch.onBeforeRender(
    renderer,
    scene,
    leftShadow,
    batch.geometry,
    material,
    null as never,
  );
  assert.equal(dispatched(batch), 1);
  // Wide camera contains all three original cells, now one material dispatch list.
  batch.onBeforeRender(
    renderer,
    scene,
    wideShadow,
    batch.geometry,
    material,
    null as never,
  );
  assert.equal(dispatched(batch), 3);
});

test("existing profiler observes the batch and restores pass callbacks without counting detached records", () => {
  const { root, chunks, material } = fixture();
  material.name = "Photographic fixture";
  const [batch] = batchPhotographicFacades(root, chunks, [material], true);
  const scene = new T.Scene();
  scene.add(root);
  scene.updateMatrixWorld(true);
  const view = camera(0, 400),
    depth = new T.MeshDepthMaterial();
  const counters = { calls: 0, triangles: 0, lines: 0, points: 0 };
  const renderer = {
    info: { render: counters },
    extensions: { has: () => true },
  } as unknown as T.WebGLRenderer;
  const before = batch.onBeforeRender,
    shadowBefore = batch.onBeforeShadow;
  const profile = profileRender(renderer, scene, view, () => {
    batch.onBeforeShadow(
      renderer,
      batch as unknown as T.Scene,
      view,
      view,
      batch.geometry,
      depth,
      null as never,
    );
    assert.equal(dispatched(batch), 3);
    // Simulate the one multi-draw counter update; this is not a GPU benchmark.
    counters.calls++;
    counters.triangles += 24;
    batch.onAfterShadow(
      renderer,
      batch as unknown as T.Scene,
      view,
      view,
      batch.geometry,
      depth,
      null as never,
    );
    batch.onBeforeRender(
      renderer,
      scene,
      view,
      batch.geometry,
      material,
      null as never,
    );
    counters.calls++;
    counters.triangles += 24;
    batch.onAfterRender(
      renderer,
      scene,
      view,
      batch.geometry,
      material,
      null as never,
    );
  });
  assert.equal(profile.totals.beauty.calls, 1);
  assert.equal(profile.totals.shadow.calls, 1);
  assert.equal(profile.topObjects.length, 2);
  assert.ok(
    profile.topObjects.every((row) => row.material === "Photographic fixture"),
  );
  assert.equal(batch.onBeforeRender, before);
  assert.equal(batch.onBeforeShadow, shadowBefore);
});
