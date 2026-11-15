import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher, walls } from "../src/world/geometry";
import { profileRender } from "../src/rendering/render-profile";
import { batchStaticChunks } from "../src/world/static-chunk-batch";

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
  assert.deepEqual(batchStaticChunks(root, chunks, false), []);
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
  const [batch] = batchStaticChunks(root, chunks, true);
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
  const [batch] = batchStaticChunks(root, chunks, true);
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
  const [batch] = batchStaticChunks(root, chunks, true);
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

test("special callbacks, shader hooks, depth materials and distinct render policies are not combined", () => {
  for (const mutate of [
    (m: T.Mesh) => {
      m.onBeforeRender = () => {};
    },
    (m: T.Mesh) => {
      m.onAfterShadow = () => {};
    },
    (m: T.Mesh) => {
      m.customDepthMaterial = new T.MeshDepthMaterial();
    },
    (m: T.Mesh) => {
      m.geometry.setDrawRange(0, 3);
    },
    (m: T.Mesh) => {
      m.frustumCulled = false;
    },
  ]) {
    const { root, chunks } = fixture();
    mutate(chunks[0]);
    const batches = batchStaticChunks(root, chunks, true);
    assert.equal(batches.length, 1);
    assert.equal(
      chunks[0].parent,
      root,
      "special object remains on original renderer path",
    );
  }
  const custom = fixture();
  custom.material.onBeforeCompile = () => {};
  assert.equal(batchStaticChunks(custom.root, custom.chunks, true).length, 0);
  const policies = fixture();
  policies.chunks[0].userData.detail = true;
  policies.chunks[1].receiveShadow = false;
  policies.chunks[2].layers.set(2);
  assert.equal(
    batchStaticChunks(policies.root, policies.chunks, true).length,
    0,
  );
});

test("interleaved layouts preserve every component and single-material geometry groups do not trim draws", () => {
  const { root, chunks } = fixture();
  const geometry = chunks[0].geometry;
  const count = geometry.attributes.position.count;
  const data = new Float32Array(count * 8);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      data[i * 8 + c] = geometry.attributes.position.getComponent(i, c);
      data[i * 8 + 3 + c] = geometry.attributes.normal.getComponent(i, c);
    }
    data[i * 8 + 6] = geometry.attributes.uv.getX(i);
    data[i * 8 + 7] = geometry.attributes.uv.getY(i);
  }
  const buffer = new T.InterleavedBuffer(data, 8);
  geometry.setAttribute(
    "position",
    new T.InterleavedBufferAttribute(buffer, 3, 0),
  );
  geometry.setAttribute(
    "normal",
    new T.InterleavedBufferAttribute(buffer, 3, 3),
  );
  geometry.setAttribute("uv", new T.InterleavedBufferAttribute(buffer, 2, 6));
  // Three ignores these groups for a single material: the full index range draws.
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 0);
  const [batch] = batchStaticChunks(root, chunks, true);
  assert.ok(batch);
  chunks.forEach((source, id) => {
    const range = batch.getGeometryRangeAt(id)!;
    assert.equal(range.indexCount, source.geometry.index!.count);
    for (const [name, attr] of Object.entries(source.geometry.attributes))
      for (let i = 0; i < attr.count; i++)
        for (let c = 0; c < attr.itemSize; c++)
          assert.equal(
            batch.geometry.attributes[name].getComponent(
              range.vertexStart + i,
              c,
            ),
            attr.getComponent(i, c),
          );
  });
});

test("packed static buffers are additional retained CPU storage, not a memory saving", () => {
  const { root, chunks } = fixture();
  const originals = chunks.map((c) => c.geometry);
  const bytes = (geometries: T.BufferGeometry[]) => {
    const buffers = new Set<ArrayBufferLike>();
    for (const g of geometries) {
      if (g.index) buffers.add(g.index.array.buffer);
      for (const a of Object.values(g.attributes)) buffers.add(a.array.buffer);
    }
    return [...buffers].reduce((n, b) => n + b.byteLength, 0);
  };
  const sourceBytes = bytes(originals);
  const [batch] = batchStaticChunks(root, chunks, true);
  assert.ok(chunks.every((c, i) => c.geometry === originals[i]));
  const packedBytes = bytes([batch.geometry]);
  assert.equal(sourceBytes, 2256);
  assert.equal(packedBytes, 2256);
  assert.notEqual(
    batch.geometry.attributes.position.array.buffer,
    originals[0].attributes.position.array.buffer,
  );
  const textures = batch as unknown as {
    _matricesTexture: T.DataTexture;
    _indirectTexture: T.DataTexture;
  };
  const metadataBytes =
    textures._matricesTexture.image.data!.byteLength +
    textures._indirectTexture.image.data!.byteLength;
  console.log(
    `Three-cell fixture: ${sourceBytes} retained source CPU bytes + ${packedBytes} packed CPU bytes + ${metadataBytes} matrix/indirection texture bytes; driver allocation not measured.`,
  );
});

test("memory profile covers invisible loaded batches and deduplicates shared source buffers", async () => {
  const { staticBatchMemoryProfile } = await import(
    "../src/world/static-chunk-batch"
  );
  const { root, chunks } = fixture();
  // Distinct chunks share one geometry, as can happen with reused source buffers.
  chunks[1].geometry = chunks[0].geometry;
  const sourceBuffers = new Set<ArrayBufferLike>();
  for (const c of chunks) {
    sourceBuffers.add(c.geometry.index!.array.buffer);
    Object.values(c.geometry.attributes).forEach((a) =>
      sourceBuffers.add(a.array.buffer),
    );
  }
  const expected = [...sourceBuffers].reduce((n, b) => n + b.byteLength, 0);
  const [batch] = batchStaticChunks(root, chunks, true);
  batch.visible = false;
  const memory = staticBatchMemoryProfile(root);
  assert.equal(memory.batchCount, 1);
  assert.equal(memory.sourceCount, 3);
  assert.equal(memory.retainedSourceGeometryBytes, expected);
  assert.equal(memory.packedGeometryBytes, 2256);
  assert.equal(memory.matrixAndIndirectionTextureBytes, 272);
  assert.equal(memory.totalUniqueBackingBufferBytes, expected + 2256 + 272);
  assert.deepEqual(batch.userData.staticBatchMemory, {
    sourceCount: 3,
    retainedSourceGeometryBytes: expected,
    packedGeometryBytes: 2256,
    matrixAndIndirectionTextureBytes: 272,
  });
  const renderer = {
    info: { render: { calls: 0, triangles: 0, lines: 0, points: 0 } },
    extensions: { has: () => true },
  } as unknown as T.WebGLRenderer;
  const scene = new T.Scene();
  scene.add(root);
  assert.deepEqual(
    profileRender(renderer, scene, camera(0), () => {}).staticBatchMemory,
    memory,
  );
  const secondMaterial = new T.MeshStandardMaterial();
  const more = chunks.map((source) => {
    const mesh = new T.Mesh(source.geometry, secondMaterial);
    root.add(mesh);
    return mesh;
  });
  batchStaticChunks(root, more, true);
  const combined = staticBatchMemoryProfile(scene);
  assert.equal(combined.batchCount, 2);
  assert.equal(combined.sourceCount, 6);
  assert.equal(
    combined.retainedSourceGeometryBytes,
    expected,
    "shared source storage is counted once across batches",
  );
  assert.equal(combined.packedGeometryBytes, 4512);
  assert.equal(combined.matrixAndIndirectionTextureBytes, 544);
});

test("owned pre-render release keeps only bounds and preserves render/reflection eligibility", async () => {
  const { staticBatchMemoryProfile } = await import(
    "../src/world/static-chunk-batch"
  );
  const { root, chunks, material } = fixture();
  const bounds = chunks.map((c) => c.geometry.boundingSphere!.clone());
  const expected = chunks.map((c) =>
    Array.from(c.geometry.attributes.position.array),
  );
  const [batch] = batchStaticChunks(root, chunks, true, {
    releaseOwnedPreRenderGeometry: true,
  });
  chunks.forEach((source, id) => {
    assert.equal(Object.keys(source.geometry.attributes).length, 0);
    assert.equal(source.geometry.index, null);
    assert.ok(source.geometry.boundingSphere!.equals(bounds[id]));
    assert.ok(source.geometry.boundingBox);
    const range = batch.getGeometryRangeAt(id)!;
    assert.deepEqual(
      Array.from(
        batch.geometry.attributes.position.array.slice(
          range.vertexStart * 3,
          (range.vertexStart + range.vertexCount) * 3,
        ),
      ),
      expected[id],
    );
  });
  const memory = staticBatchMemoryProfile(root);
  assert.equal(
    memory.retainedSourceGeometryBytes,
    0,
    "diagnostic buffer sets also release source references",
  );
  assert.equal(memory.releasedOwnedSourceGeometryBytes, 2256);
  assert.equal(memory.packedGeometryBytes, 2256);
  assert.equal(memory.totalUniqueBackingBufferBytes, 2528);
  const view = camera(0, 400),
    renderer = {} as T.WebGLRenderer,
    scene = new T.Scene(),
    depth = new T.MeshDepthMaterial();
  root.updateMatrixWorld(true);
  const f = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      view.projectionMatrix,
      view.matrixWorldInverse,
    ),
  );
  assert.ok(
    chunks.every((c) => f.intersectsObject(c)),
    "bounds-only records retain Frustum predicates",
  );
  // World and reflection capture only change flags/centres on these records.
  chunks[1].visible = false;
  chunks[2].castShadow = false;
  batch.onBeforeShadow(
    renderer,
    batch as unknown as T.Scene,
    view,
    view,
    batch.geometry,
    depth,
    null as never,
  );
  assert.equal(dispatched(batch), 1);
  batch.onBeforeRender(
    renderer,
    scene,
    view,
    batch.geometry,
    material,
    null as never,
  );
  assert.equal(dispatched(batch), 2);
  chunks[1].visible = true;
  chunks[2].castShadow = true;
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
});

test("owned-release option cannot strip unsupported or ineligible fallback geometry", () => {
  for (const supported of [false, true]) {
    const { root, chunks, material } = fixture();
    if (supported) material.onBeforeCompile = () => {};
    const geometries = chunks.map((c) => c.geometry);
    assert.equal(
      batchStaticChunks(root, chunks, supported, {
        releaseOwnedPreRenderGeometry: true,
      }).length,
      0,
    );
    assert.ok(
      chunks.every(
        (c, i) =>
          c.parent === root &&
          c.geometry === geometries[i] &&
          c.geometry.attributes.position.count > 0,
      ),
    );
  }
});
