import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  panPacificTowerCompatible,
  replacePanPacificTowerFaces,
  replacePanPacificTowerSource,
} from "../src/world/pan-pacific-tower-source";
import { replacePanPacificHowePodiumFaces } from "../src/world/pan-pacific-howe-podium-source";
import { replaceCanadaPlaceHotelFaces } from "../src/world/canada-place-hotel-source";
import { replaceCanadaPlaceCanopyFaces } from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";

type Mesh = T.Mesh<T.BufferGeometry, T.Material>;
const audit: Record<
  string,
  { firstTriangle: number; firstVertex: number; triangles: number }
> = {
  concrete: { firstTriangle: 1916, firstVertex: 4596, triangles: 1802 },
  glass: { firstTriangle: 960, firstVertex: 1920, triangles: 168 },
  trim: { firstTriangle: 17428, firstVertex: 33473, triangles: 638 },
  glow: { firstTriangle: 0, firstVertex: 0, triangles: 64 },
  roof: { firstTriangle: 0, firstVertex: 0, triangles: 468 },
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

test("actual normalized source preflight removes exactly all 3140 audited tower triangles atomically", async () => {
  const { scene, meshes } = await load(),
    raw = meshes.map((m) => snapshot(m.geometry));
  assert.equal(panPacificTowerCompatible(scene), true);
  meshes.forEach((m, i) => {
    assert.ok(m.geometry.getAttribute("position").array instanceof Int16Array);
    assert.equal(m.geometry.getAttribute("position").normalized, true);
    unchanged(m.geometry, raw[i]);
  });
  const entries = baked(meshes);
  for (const { geometry } of entries)
    geometry.setAttribute("custom", new T.Float32BufferAttribute([1, 2, 3], 1));
  const before = entries.map((e) => snapshot(e.geometry));
  assert.equal(replacePanPacificTowerSource(entries), 3140);
  entries.forEach(({ geometry, material }, i) => {
    const spec = audit[material];
    const expected = spec
      ? before[i].indices.slice(0, spec.firstTriangle * 3)
      : before[i].indices;
    assert.deepEqual(
      Array.from(geometry.index!.array),
      expected,
      `${material}: preserves every earlier PIER/podium/hall/steel/fabric triangle in exact order`,
    );
    assert.equal(
      before[i].indices.length - geometry.index!.count,
      (spec?.triangles ?? 0) * 3,
    );
    assert.equal(
      geometry.index!.array.constructor,
      before[i].index!.array.constructor,
    );
    preservedAttributes(geometry, before[i]);
  });
  const removed = entries.map((e) => snapshot(e.geometry));
  assert.equal(
    replacePanPacificTowerSource(entries),
    0,
    "repeated removal fails without touching any primitive",
  );
  entries.forEach((e, i) => unchanged(e.geometry, removed[i]));
});

test("tower selection commutes at every position among existing cuts after paving first", async () => {
  const { meshes } = await load();
  const edits = [
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
  const baseline = new Map<string, number[]>();
  for (const order of [edits, [...edits].reverse()])
    for (let slot = 0; slot <= edits.length; slot++) {
      const entries = baked(meshes),
        before = entries.map((e) => snapshot(e.geometry));
      for (const { geometry, material } of entries) {
        const paving = extractCanadaPlacePaving(geometry, material);
        if (material === "concrete")
          assert.equal(paving?.getAttribute("position").count, 93);
        else assert.equal(paving, null);
        paving?.dispose();
      }
      for (let i = 0; i <= order.length; i++) {
        if (i === slot)
          assert.equal(replacePanPacificTowerSource(entries), 3140);
        if (i === order.length) break;
        for (const { geometry, material } of entries)
          assert.equal(
            order[i].fn(geometry, material),
            (order[i].counts as Record<string, number>)[material] ?? 0,
          );
      }
      entries.forEach(({ geometry, material }, i) => {
        const indices = Array.from(geometry.index!.array);
        if (baseline.has(material))
          assert.deepEqual(indices, baseline.get(material));
        else baseline.set(material, indices);
        preservedAttributes(geometry, before[i]);
        geometry.dispose();
      });
    }
});

test("complete original scene preflight rejects altered indices/positions/transforms and missing/duplicate tower materials", async () => {
  for (const change of [
    "position",
    "unrelated-position",
    "index",
    "unrelated-index",
    "transform",
    "missing-roof",
    "duplicate-glow",
    "material-array",
  ] as const) {
    const { scene, meshes } = await load(),
      concrete = meshes.find((m) => m.material.name === "concrete")!;
    if (change === "position" || change === "unrelated-position") {
      const id = change === "position" ? 4596 : 0,
        p = concrete.geometry.getAttribute("position");
      p.setX(id, p.getX(id) + 0.01);
    }
    if (change === "index") concrete.geometry.index!.setX(1916 * 3, 4597);
    if (change === "unrelated-index") concrete.geometry.index!.setX(0, 1);
    if (change === "transform") concrete.position.x += 0.1;
    if (change === "missing-roof")
      meshes.find((m) => m.material.name === "roof")!.removeFromParent();
    if (change === "duplicate-glow")
      scene.add(meshes.find((m) => m.material.name === "glow")!.clone());
    if (change === "material-array")
      (concrete as T.Mesh).material = [concrete.material];
    const before = meshes.map((m) => snapshot(m.geometry));
    assert.equal(panPacificTowerCompatible(scene), false, change);
    meshes.forEach((m, i) => unchanged(m.geometry, before[i]));
  }
});

test("all-material transaction fails without mutation for a bad last primitive or partial/reordered/duplicate triples", async () => {
  const { meshes } = await load();
  for (const change of [
    "position",
    "missing",
    "duplicate",
    "partial",
    "reverse",
    "reorder",
    "reorder-after-cuts",
    "duplicate-after-cuts",
    "mixed",
    "invalid",
    "group",
    "range",
  ] as const) {
    const entries = baked(meshes);
    for (const { geometry, material } of entries) {
      extractCanadaPlacePaving(geometry, material)?.dispose();
      replacePanPacificHowePodiumFaces(geometry, material);
      replaceCanadaPlaceHotelFaces(geometry, material);
      replaceCanadaPlaceCanopyFaces(geometry, material);
      replaceCanadaPlaceWestFaces(geometry, material);
    }
    const bad = entries.find((e) => e.material === "roof")!;
    if (change === "position")
      bad.geometry.getAttribute("position").setY(0, -100);
    if (change === "missing") entries.splice(entries.indexOf(bad), 1);
    if (change === "duplicate") entries.push(bad);
    if (["partial", "reverse", "reorder", "invalid"].includes(change)) {
      const ids = Array.from(bad.geometry.index!.array);
      if (change === "partial") ids.splice(0, 3);
      if (change === "reverse") [ids[0], ids[1]] = [ids[1], ids[0]];
      if (change === "reorder")
        ids.splice(0, 6, ...ids.slice(3, 6), ...ids.slice(0, 3));
      if (change === "invalid") ids[0] = 299;
      bad.geometry.setIndex(ids);
    }
    if (change === "mixed") {
      const g = entries.find((e) => e.material === "concrete")!.geometry;
      const ids = Array.from(g.index!.array),
        target = ids.findIndex((id) => id >= 4596);
      ids[target] = 0;
      g.setIndex(ids);
    }
    if (change === "reorder-after-cuts" || change === "duplicate-after-cuts") {
      const g = entries.find((e) => e.material === "concrete")!.geometry;
      const ids = Array.from(g.index!.array),
        target = ids.findIndex((id) => id >= 4596);
      const first = ids.slice(target, target + 3),
        second = ids.slice(target + 3, target + 6);
      ids.splice(
        target,
        6,
        ...(change === "reorder-after-cuts" ? second : first),
        ...first,
      );
      g.setIndex(ids);
    }
    if (change === "group") bad.geometry.addGroup(0, 3, 0);
    if (change === "range") bad.geometry.setDrawRange(0, 3);
    const before = entries.map((e) => snapshot(e.geometry));
    assert.equal(replacePanPacificTowerSource(entries), 0, change);
    entries.forEach((e, i) => unchanged(e.geometry, before[i]));
  }
});

test("per-primitive removal has exact audited counts and preserves unknown primitives", async () => {
  const { meshes } = await load();
  for (const { geometry, material } of baked(meshes)) {
    const before = snapshot(geometry);
    assert.equal(
      replacePanPacificTowerFaces(geometry, material),
      audit[material]?.triangles ?? 0,
    );
    if (!audit[material]) unchanged(geometry, before);
    const after = snapshot(geometry);
    assert.equal(replacePanPacificTowerFaces(geometry, material), 0);
    unchanged(geometry, after);
  }
});
