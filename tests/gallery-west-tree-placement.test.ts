import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { loadCity } from "./helpers/full-city-data";
import { World } from "../src/world/world";
import { Materials } from "../src/world/materials";
import { CollisionWorld } from "../src/world/collision";
import { reconcileTrees } from "../src/world/tree-profile";
import { galleryWestTreeExcluded } from "../src/world/gallery-west-tree-placement";
import {
  galleryStairLocal,
  galleryStairWorld,
} from "../src/world/gallery-stair-framing-data";
import {
  galleryWestPoint,
  GALLERY_WEST_TERRACE as D,
} from "../src/world/gallery-west-terrace-data";
import { galleryWestPavingGeometry } from "../src/world/gallery-west-terrace";
const original = globalThis.fetch;
let ground: CollisionWorld;
try {
  globalThis.fetch = async (input) =>
    new Response(new Uint8Array(fs.readFileSync(`public${input}`)));
  ground = new CollisionWorld(await loadCity());
} finally {
  globalThis.fetch = original;
}

test("exclude only three mapped stems piercing the new terrace; preserve original neighbors, source data and collision policy", (t) => {
  const before = JSON.stringify([ground.data.trees, ground.data.publicTrees]);
  const trees = reconcileTrees(ground.data.trees, ground.data.publicTrees),
    excluded = trees.filter(galleryWestTreeExcluded),
    kept = trees.filter((p) => !galleryWestTreeExcluded(p));
  assert.equal(excluded.length, 3);
  assert.deepEqual(
    excluded.map((p) => galleryStairLocal(p.x, p.z).map((n) => +n.toFixed(5))),
    [
      [-5.31757, 38.88597],
      [-5.72789, 45.60025],
      [-5.76376, 49.84274],
    ],
  );
  for (const p of excluded) {
    assert.equal(
      p.sourceId,
      undefined,
      "legacy mapped OSM point, not City inventory ID",
    );
    assert.equal(
      ground.blocked(p.x, p.z, 0.35),
      false,
      "ground-only filter previously missed overhead slab",
    );
    assert.equal(
      ground.forestObstacles.query(p.x, p.z, 1).length,
      0,
      "mapped street trees have no collision trunk to leave behind",
    );
  }
  for (const [u, v] of [
    [-5.26975, 33.22931],
    [-5.81755, 56.20648],
  ])
    assert.ok(
      kept.some((p) => {
        const q = galleryStairLocal(p.x, p.z);
        return Math.hypot(q[0] - u, q[1] - v) < 0.00002;
      }),
      "adjacent tree survives at original coordinates",
    );
  assert.equal(kept.length, trees.length - 3);
  assert.equal(
    JSON.stringify([ground.data.trees, ground.data.publicTrees]),
    before,
  );
  t.diagnostic(
    `Excluded exactly3 of ${trees.length} reconciled trees; fallback/detailed samples must both use filtered list`,
  );
});

test("mask uses finite stem/rectangle contact, not broad crown or arbitrary expanded bounds", () => {
  const tree = (u: number, v: number, diameter = 0.2) => {
    const [x, z] = galleryStairWorld(u, v);
    return { x, z, diameter };
  };
  for (const [u, v] of [
    [-8.5, 34.5],
    [-4.85, 52.9],
    [-6, 40],
  ])
    assert.equal(galleryWestTreeExcluded(tree(u, v)), true);
  assert.equal(galleryWestTreeExcluded(tree(-4.7, 40)), false);
  assert.equal(galleryWestTreeExcluded(tree(-4.75, 40)), true);
  assert.equal(
    galleryWestTreeExcluded(tree(-4.75, 53)),
    false,
    "round stem clearance at rectangle corner",
  );
  assert.equal(galleryWestTreeExcluded(tree(0, 43, 2)), false);
});

test("two upward concrete triangles occupy exact exterior footprint at established visual layer, with unchanged ground contact", () => {
  const g = galleryWestPavingGeometry(),
    m = new T.Mesh(g, new T.MeshBasicMaterial()),
    p = g.getAttribute("position");
  m.updateMatrixWorld(true);
  assert.equal(g.index!.count / 3, 2);
  for (let i = 0; i < p.count; i++) {
    assert.ok(p.getX(i) >= D.minU - 1e-5 && p.getX(i) <= D.maxU + 1e-5);
    assert.ok(p.getZ(i) >= D.rearV - 1e-5 && p.getZ(i) <= D.frontV + 1e-5);
    assert.ok(Math.abs(p.getY(i) + D.datum - 0.07) < 1e-6);
  }
  let count = 0;
  for (let a = D.minU + 0.3; a < D.maxU; a += 0.5)
    for (let b = D.rearV + 0.3; b < D.frontV; b += 0.4) {
      const hit = new T.Raycaster(
        new T.Vector3(a, 1, b),
        new T.Vector3(0, -1, 0),
        0,
        2,
      ).intersectObject(m)[0];
      assert.ok(hit);
      assert.ok(hit.face!.normal.y > 0.99);
      const [u, v] = galleryWestPoint(a, b),
        [x, z] = galleryStairWorld(u, v);
      assert.equal(ground.walkingHeight(x, z, 0), 0);
      count++;
    }
  assert.ok(count > 250);
  for (const [a, b] of [
    [D.minU - 0.01, 26],
    [D.maxU + 0.01, 26],
    [-18, D.rearV - 0.01],
    [-18, D.frontV + 0.01],
  ])
    assert.equal(
      new T.Raycaster(
        new T.Vector3(a, 1, b),
        new T.Vector3(0, -1, 0),
        0,
        2,
      ).intersectObject(m).length,
      0,
    );
  g.dispose();
  (m.material as T.Material).dispose();
});

test("actual vegetation hook feeds the same retained two trees to fallback instances and detailed-tree samples", () => {
  const sourceTrees = reconcileTrees(
    ground.data.trees,
    ground.data.publicTrees,
  ).filter((t) => {
    const [u, v] = galleryStairLocal(t.x, t.z);
    return u > -15 && u < 5 && v > 25 && v < 60;
  });
  assert.equal(sourceTrees.length, 5);
  const materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  const collision = Object.assign(Object.create(ground), {
    robsonGarden: undefined,
  }) as CollisionWorld;
  const world = Object.assign(Object.create(World.prototype), {
    root: new T.Group(),
    chunks: [],
    treeSamples: [],
    coniferSamples: [],
    data: {
      ...ground.data,
      trees: sourceTrees.flatMap((t) => [t.x, t.z]),
      publicTrees: undefined,
    },
    materials,
    collision,
    forestHabitat: { trees: () => [] },
    stats: {},
  }) as World;
  world.vegetation();
  assert.equal(
    world.treeSamples.length,
    2,
    "DetailedTrees receives this exact filtered sample list",
  );
  assert.equal(world.coniferSamples.length, 0);
  assert.equal(world.stats.trees, 2);
  for (const t of world.treeSamples) {
    assert.equal(galleryWestTreeExcluded(t), false);
    const pose = new T.Vector3().setFromMatrixPosition(t.trunkMatrix);
    assert.ok(
      Math.hypot(pose.x - t.x, pose.z - t.z) < 1e-6,
      "fallback trunk stayed at original source position",
    );
    assert.ok(sourceTrees.some((p) => p.x === t.x && p.z === t.z));
    assert.equal(collision.forestObstacles.query(t.x, t.z, 1).length, 0);
  }
  const geometries = new Set<T.BufferGeometry>(),
    mats = new Set<T.Material>();
  world.root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        mats.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
});
