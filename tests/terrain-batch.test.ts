import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { terrainMeshes } from "../src/world/terrain-mesh";
import { Terrain } from "../src/world/terrain";
import { cliffMaterials } from "../src/world/cliff-material";
import { coastalCoverMaterials } from "../src/world/coastal-cover";
import { forestGround } from "../src/world/forest";
import { batchTerrainTiles } from "../src/world/terrain-batch";
function fixture() {
  const meta = JSON.parse(
    fs.readFileSync("public/data/stanley-terrain.json", "utf8"),
  );
  const bytes = fs.readFileSync("public/data/stanley-height.u16");
  const terrain = new Terrain(
    meta,
    new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  );
  const library = { texture: () => new T.Texture() } as any;
  const cliff = cliffMaterials(library),
    cover = coastalCoverMaterials(
      library,
      { roads: [] } as any,
      { groundHeight: () => 0 } as any,
    );
  const material = cover(
    cliff(forestGround(library)),
  ) as T.MeshStandardMaterial;
  const tiles = terrainMeshes(terrain, [], material),
    root = new T.Group();
  root.add(...tiles);
  return { tiles, root, material };
}
test("actual elevation tiles preserve packed attributes, shaders and per-pass culling after owned release", () => {
  const { tiles, root, material } = fixture();
  const source = tiles.map((t) => ({ g: t.geometry, visible: t.visible }));
  const shader = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile(shader as any, {} as any);
  assert.match(shader.vertexShader, /vForestPosition = \(modelMatrix/);
  assert.match(shader.vertexShader, /vCliffPosition = \(modelMatrix/);
  const [batch] = batchTerrainTiles(root, tiles, true);
  assert.ok(batch);
  assert.equal(batch.material, material);
  let offset = 0,
    total = 0;
  for (let i = 0; i < tiles.length; i++) {
    const g = source[i].g;
    for (const key of ["position", "normal", "uv"]) {
      const a = g.getAttribute(key),
        b = batch.geometry.getAttribute(key);
      for (let j = 0; j < a.count; j++)
        for (let k = 0; k < a.itemSize; k++)
          assert.equal(
            b.array[(offset + j) * a.itemSize + k],
            a.array[j * a.itemSize + k],
          );
    }
    offset += g.attributes.position.count;
    total += g.index!.count;
    assert.equal(tiles[i].parent, null);
    assert.equal(tiles[i].geometry.getAttribute("position"), undefined);
    assert.deepEqual(tiles[i].geometry.boundingSphere, g.boundingSphere);
  }
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 10000);
  camera.position.set(0, 100, 500);
  camera.lookAt(-2000, 0, -2000);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);
  const draw = () =>
    batch.onBeforeRender(
      {} as any,
      {} as any,
      camera,
      batch.geometry,
      material,
      null as any,
    );
  draw();
  const frustum = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const expected = source.reduce(
    (sum, s, i) =>
      sum +
      (frustum.intersectsSphere(s.g.boundingSphere!) ? s.g.index!.count : 0),
    0,
  );
  const internal = batch as unknown as {
    _multiDrawCount: number;
    _multiDrawCounts: Int32Array;
  };
  assert.equal(
    Array.from(internal._multiDrawCounts)
      .slice(0, internal._multiDrawCount)
      .reduce((a, b) => a + b, 0),
    expected,
  );
  const visible = tiles.map((t) => t.visible);
  tiles[0].visible = false;
  draw();
  assert.equal(batch.getVisibleAt(0), false);
  tiles[0].visible = visible[0];
  // All original terrain tiles were noncasters. Shadow eligibility stays independent.
  batch.onBeforeShadow(
    {} as any,
    {} as any,
    camera,
    camera,
    batch.geometry,
    new T.MeshDepthMaterial(),
    null as any,
  );
  for (let i = 0; i < tiles.length; i++)
    assert.equal(batch.getVisibleAt(i), false);
  draw();
  assert.equal(batch.getVisibleAt(0), true);
  console.log({
    tiles: tiles.length,
    triangles: total / 3,
    batches: 1,
    memory: batch.userData.terrainBatchMemory,
  });
});
test("unsupported and failed allocation leave original terrain attached with buffers", () => {
  const { tiles, root } = fixture(),
    geometries = tiles.map((t) => t.geometry);
  assert.deepEqual(batchTerrainTiles(root, tiles, false), []);
  const base = tiles[0].material as T.Material,
    other = base.clone();
  other.onBeforeCompile = base.onBeforeCompile;
  other.customProgramCacheKey = base.customProgramCacheKey;
  const half = Math.ceil(tiles.length / 2);
  tiles.slice(half).forEach((t) => (t.material = other));
  const original = T.BatchedMesh.prototype.addGeometry;
  let calls = 0;
  T.BatchedMesh.prototype.addGeometry = function (...args) {
    if (++calls > half) throw Error("allocation failed");
    return original.apply(this, args);
  };
  try {
    assert.throws(
      () => batchTerrainTiles(root, tiles, true),
      /allocation failed/,
    );
  } finally {
    T.BatchedMesh.prototype.addGeometry = original;
  }
  tiles.forEach((t, i) => {
    assert.equal(t.parent, root);
    assert.equal(t.geometry, geometries[i]);
  });
  assert.equal(root.children.length, tiles.length);
});
