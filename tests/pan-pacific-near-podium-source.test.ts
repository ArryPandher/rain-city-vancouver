import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  panPacificNearPodiumCompatible,
  replacePanPacificNearPodiumFaces,
  replacePanPacificNearPodiumSource,
} from "../src/world/pan-pacific-near-podium-source";
import { replacePanPacificHowePodiumFaces } from "../src/world/pan-pacific-howe-podium-source";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";

import { replacePanPacificTowerFaces } from "../src/world/pan-pacific-tower-source";

type Mesh = T.Mesh<T.BufferGeometry, T.Material>;
const audit: Record<string, { ranges: number[]; triangles: number }> = {
  concrete: { ranges: [278, 1718, 1890], triangles: 30 },
  glass: { ranges: [846, 934], triangles: 20 },
  trim: { ranges: [17314, 17402], triangles: 20 },
};
async function load() {
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  );
  await MeshoptDecoder.ready;
  const { scene } = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  return { scene, meshes };
}
function baked(meshes: Mesh[]) {
  return meshes.map((mesh) => ({
    material: mesh.material.name,
    geometry: bakeGeometry(mesh.geometry, mesh.matrixWorld),
  }));
}
function snapshot(g: T.BufferGeometry) {
  return {
    index: g.index,
    indices: Array.from(g.index!.array),
    attributes: Object.entries(g.attributes).map(([name, a]) => ({
      name,
      a,
      array: Array.from(a.array),
    })),
  };
}
function preservedAttributes(
  g: T.BufferGeometry,
  before: ReturnType<typeof snapshot>,
) {
  for (const { name, a, array } of before.attributes) {
    assert.equal(g.getAttribute(name), a);
    assert.deepEqual(
      Array.from(g.getAttribute(name).array),
      array,
      `${name} data changed`,
    );
  }
}
function unchanged(g: T.BufferGeometry, before: ReturnType<typeof snapshot>) {
  assert.equal(g.index, before.index);
  assert.deepEqual(Array.from(g.index!.array), before.indices);
  preservedAttributes(g, before);
}

test("actual GLB near-return removal is exactly70 triangles and preserves all caps, floor and adjoining faces", async () => {
  const { scene, meshes } = await load(),
    raw = meshes.map((m) => snapshot(m.geometry));
  assert.equal(panPacificNearPodiumCompatible(scene), true);
  meshes.forEach((m, i) => {
    assert.ok(m.geometry.getAttribute("position").array instanceof Int16Array);
    unchanged(m.geometry, raw[i]);
  });
  const entries = baked(meshes);
  for (const e of entries)
    e.geometry.setAttribute(
      "custom",
      new T.Float32BufferAttribute([5, 6, 7], 1),
    );
  const before = entries.map((e) => snapshot(e.geometry));
  assert.equal(replacePanPacificNearPodiumSource(entries), 70);
  entries.forEach(({ geometry, material }, i) => {
    const spec = audit[material];
    const removed = new Set(
      (spec?.ranges ?? []).flatMap((first) =>
        Array.from({ length: 10 }, (_, j) => first + j),
      ),
    );
    const expected = before[i].indices.filter(
      (_, j) => !removed.has(Math.floor(j / 3)),
    );
    assert.deepEqual(
      Array.from(geometry.index!.array),
      expected,
      `${material}: all nonselected source triangles remain in order`,
    );
    assert.equal(
      before[i].indices.length - geometry.index!.count,
      (spec?.triangles ?? 0) * 3,
    );
    preservedAttributes(geometry, before[i]);
    assert.equal(
      geometry.index!.array.constructor,
      before[i].index!.array.constructor,
    );
  });
  const after = entries.map((e) => snapshot(e.geometry));
  assert.equal(replacePanPacificNearPodiumSource(entries), 0);
  entries.forEach((e, i) => unchanged(e.geometry, after[i]));
});

const existing = [
  {
    fn: replacePanPacificTowerFaces,
    counts: { concrete: 1802, glass: 168, trim: 638, glow: 64, roof: 468 },
  },
  {
    fn: replacePanPacificHowePodiumFaces,
    counts: { concrete: 30, glass: 20, trim: 20 },
  },
  {
    fn: replaceCanadaPlaceHotelFaces,
    counts: { concrete: 2, glass: 2, trim: 2 },
  },
  {
    fn: replaceCanadaPlaceCanopyFaces,
    counts: { concrete: 2, glass: 24, trim: 156 },
  },
  {
    fn: replaceCanadaPlaceWestFaces,
    counts: { concrete: 10, glass: 100, trim: 480 },
  },
];
test("near return commutes at every insertion among all existing source cuts after paving first", async () => {
  const { meshes } = await load(),
    baseline = new Map<string, number[]>();
  for (const order of [existing, [...existing].reverse()])
    for (let slot = 0; slot <= existing.length; slot++) {
      const entries = baked(meshes),
        before = entries.map((e) => snapshot(e.geometry));
      for (const e of entries) {
        const paving = extractCanadaPlacePaving(e.geometry, e.material);
        if (e.material === "concrete")
          assert.equal(paving?.getAttribute("position").count, 93);
        paving?.dispose();
      }
      for (let i = 0; i <= order.length; i++) {
        if (i === slot)
          assert.equal(replacePanPacificNearPodiumSource(entries), 70);
        if (i === order.length) break;
        for (const e of entries)
          assert.equal(
            order[i].fn(e.geometry, e.material),
            (order[i].counts as Record<string, number>)[e.material] ?? 0,
          );
      }
      entries.forEach((e, i) => {
        const ids = Array.from(e.geometry.index!.array);
        if (baseline.has(e.material))
          assert.deepEqual(ids, baseline.get(e.material));
        else baseline.set(e.material, ids);
        preservedAttributes(e.geometry, before[i]);
      });
    }
});

test("original scene rejects changed source, missing or duplicated materials before any mutation", async () => {
  for (const change of [
    "position",
    "unrelated-position",
    "index",
    "unrelated-index",
    "transform",
    "missing",
    "duplicate",
    "material-array",
  ] as const) {
    const { scene, meshes } = await load(),
      mesh = meshes.find((m) => m.material.name === "concrete")!;
    if (change === "position" || change === "unrelated-position") {
      const id = change === "position" ? 834 : 0,
        p = mesh.geometry.getAttribute("position");
      p.setX(id, p.getX(id) + 0.01);
    }
    if (change === "index") mesh.geometry.index!.setX(278 * 3, 835);
    if (change === "unrelated-index") mesh.geometry.index!.setX(0, 1);
    if (change === "transform") mesh.position.x += 0.1;
    if (change === "missing")
      meshes.find((m) => m.material.name === "trim")!.removeFromParent();
    if (change === "duplicate") scene.add(mesh.clone());
    if (change === "material-array")
      (mesh as T.Mesh).material = [mesh.material];
    const before = meshes.map((m) => snapshot(m.geometry));
    assert.equal(panPacificNearPodiumCompatible(scene), false, change);
    meshes.forEach((m, i) => unchanged(m.geometry, before[i]));
  }
});

test("three-material transaction rejects partial, reversed, duplicated and reordered exact triples after other cuts", async () => {
  const { meshes } = await load();
  for (const change of [
    "position",
    "partial",
    "reverse",
    "duplicate-triple",
    "reorder",
    "mixed",
    "missing",
    "duplicate-material",
    "group",
    "range",
  ] as const) {
    const entries = baked(meshes);
    for (const e of entries) {
      extractCanadaPlacePaving(e.geometry, e.material)?.dispose();
      for (const edit of existing) edit.fn(e.geometry, e.material);
    }
    const bad = entries.find((e) => e.material === "trim")!;
    const ids = Array.from(bad.geometry.index!.array),
      target = ids.findIndex((id) => id === 33245);
    assert.ok(target >= 0);
    if (change === "position")
      bad.geometry.getAttribute("position").setY(33245, 0);
    if (change === "partial") ids.splice(target, 3);
    if (change === "reverse")
      [ids[target], ids[target + 1]] = [ids[target + 1], ids[target]];
    if (change === "duplicate-triple")
      ids.splice(target + 3, 3, ...ids.slice(target, target + 3));
    if (change === "reorder")
      ids.splice(
        target,
        6,
        ...ids.slice(target + 3, target + 6),
        ...ids.slice(target, target + 3),
      );
    if (change === "mixed") ids[target] = 0;
    if (change === "group") bad.geometry.addGroup(0, 3, 0);
    if (change === "range") bad.geometry.setDrawRange(0, 3);
    bad.geometry.setIndex(ids);
    if (change === "missing") entries.splice(entries.indexOf(bad), 1);
    if (change === "duplicate-material") entries.push(bad);
    const before = entries.map((e) => snapshot(e.geometry));
    assert.equal(replacePanPacificNearPodiumSource(entries), 0, change);
    entries.forEach((e, i) => unchanged(e.geometry, before[i]));
  }
});

test("per-primitive selection retains unsupported materials and fails safely on repeat", async () => {
  const { meshes } = await load();
  for (const { geometry, material } of baked(meshes)) {
    const before = snapshot(geometry);
    assert.equal(
      replacePanPacificNearPodiumFaces(geometry, material),
      audit[material]?.triangles ?? 0,
    );
    if (!audit[material]) unchanged(geometry, before);
    const after = snapshot(geometry);
    assert.equal(replacePanPacificNearPodiumFaces(geometry, material), 0);
    unchanged(geometry, after);
  }
});
