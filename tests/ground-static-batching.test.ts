import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { Batcher } from "../src/world/geometry";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, type CityData } from "../src/world/data";
import { staticBatchMemoryProfile } from "../src/world/static-chunk-batch";

// Actual mapped inputs and actual World generators; skip browser-only material
// canvas/image loading, not geometry, road grading, markings or batching logic.
function fixture(capability: boolean, method: "roads" | "terrain") {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas = data.areas.slice(0, 180);
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = [];
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads.slice(0, 240);
  const materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  for (const name of [
    "grass",
    "concrete",
    "asphalt",
    "stone",
    "yellow",
  ] as const)
    materials[name] = new T.MeshStandardMaterial({ name });
  const world = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    data,
    materials,
    facadeMultiDraw: capability,
    collision: new CollisionWorld(data),
    forestHabitat: { woodland: data.areas.filter((a) => a.kind === "forest") },
    stats: { roads: 0 },
  }) as World;
  const snapshots = new Map<T.Mesh, T.BufferGeometry>();
  const finish = Batcher.prototype.finish;
  Batcher.prototype.finish = function (...args) {
    const chunks = finish.apply(this, args);
    for (const c of chunks) snapshots.set(c, c.geometry.clone());
    return chunks;
  };
  try {
    world[method]();
  } finally {
    Batcher.prototype.finish = finish;
  }
  world.root.updateMatrixWorld(true);
  return { world, snapshots };
}
for (const method of ["roads", "terrain"] as const) {
  test(`actual mapped ${method} preserve payload, bounds and shadow policy with owned-buffer release`, (t) => {
    const { world, snapshots } = fixture(true, method);
    const batches = world.root.children.filter(
      (c): c is T.BatchedMesh => c instanceof T.BatchedMesh,
    );
    assert.ok(batches.length > 0);
    const packed = new Set<T.Mesh>();
    let triangleCount = 0;
    for (const batch of batches) {
      const sources = [...snapshots.keys()].filter(
        (c) => c.material === batch.material && c.parent === null,
      );
      assert.equal(
        sources.length,
        batch.userData.staticBatchMemory.sourceCount,
      );
      sources.forEach((source, id) => {
        packed.add(source);
        assert.ok(world.chunks.includes(source));
        assert.equal(source.userData.allowShadow, false);
        assert.equal(source.castShadow, false);
        const original = snapshots.get(source)!,
          range = batch.getGeometryRangeAt(id)!;
        triangleCount += range.indexCount / 3;
        assert.equal(source.geometry.getAttribute("position"), undefined);
        assert.deepEqual(
          source.geometry.boundingSphere,
          original.boundingSphere,
        );
        for (const [name, attr] of Object.entries(original.attributes)) {
          const actual = batch.geometry.getAttribute(name).array;
          assert.deepEqual(
            Array.from(
              actual.slice(
                range.vertexStart * attr.itemSize,
                (range.vertexStart + range.vertexCount) * attr.itemSize,
              ),
            ),
            Array.from(attr.array),
          );
        }
        assert.deepEqual(
          Array.from(
            batch.geometry.index!.array.slice(
              range.indexStart,
              range.indexStart + range.indexCount,
            ),
            (v) => v - range.vertexStart,
          ),
          Array.from(original.index!.array),
        );
      });
      const camera = new T.PerspectiveCamera(100, 1, 0.1, 30000);
      camera.position.set(0, 10000, 0);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      batch.onBeforeShadow(
        {} as T.WebGLRenderer,
        new T.Scene(),
        camera,
        camera,
        batch.geometry,
        new T.MeshDepthMaterial(),
        null as any,
      );
      assert.equal(
        (batch as any)._multiDrawCount,
        0,
        "no ground shadows introduced by batching",
      );
      const frustum = new T.Frustum().setFromProjectionMatrix(
        new T.Matrix4().multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
      const render = () =>
        batch.onBeforeRender(
          {} as T.WebGLRenderer,
          new T.Scene(),
          camera,
          batch.geometry,
          batch.material as T.Material,
          null as any,
        );
      render();
      assert.equal(
        (batch as any)._multiDrawCount,
        sources.filter((s) => s.visible && frustum.intersectsObject(s)).length,
        "beauty still sees original per-cell frustum bounds after shadow pass",
      );
      sources.forEach((s) => (s.visible = false));
      render();
      assert.equal(
        (batch as any)._multiDrawCount,
        0,
        "World source visibility flags remain authoritative",
      );
      sources.forEach((s) => (s.visible = true));
    }
    const memory = staticBatchMemoryProfile(world.root);
    assert.equal(memory.retainedSourceGeometryBytes, 0);
    assert.ok(memory.releasedOwnedSourceGeometryBytes > 0);
    for (const [mesh, geometry] of snapshots)
      if (!packed.has(mesh)) {
        assert.equal(
          mesh.parent,
          world.root,
          "ineligible/custom material stays rendered",
        );
        assert.deepEqual(
          Array.from(mesh.geometry.getAttribute("position").array),
          Array.from(geometry.getAttribute("position").array),
        );
      }
    t.diagnostic(
      `${snapshots.size} original chunks; ${packed.size} packed into ${batches.length} batches; ${triangleCount} exact packed triangles; ${memory.releasedOwnedSourceGeometryBytes} released source bytes`,
    );
  });
  test(`actual mapped ${method} unsupported fallback retains original full chunks`, () => {
    const { world, snapshots } = fixture(false, method);
    assert.ok(snapshots.size > 1);
    assert.ok(world.root.children.every((c) => !(c instanceof T.BatchedMesh)));
    for (const [mesh, original] of snapshots) {
      assert.equal(mesh.parent, world.root);
      assert.ok(world.chunks.includes(mesh));
      assert.equal(mesh.castShadow, false);
      assert.equal(mesh.userData.allowShadow, false);
      assert.deepEqual(
        Array.from(mesh.geometry.index!.array),
        Array.from(original.index!.array),
      );
      assert.deepEqual(
        Array.from(mesh.geometry.getAttribute("position").array),
        Array.from(original.getAttribute("position").array),
      );
    }
  });
}
