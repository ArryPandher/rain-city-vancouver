import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { bakeGeometry } from "../src/world/geometry";
import {
  panPacificHowePodiumCompatible,
  replacePanPacificHowePodiumFaces,
} from "../src/world/pan-pacific-howe-podium-source";
import {
  canadaPlaceHotelCompatible,
  replaceCanadaPlaceHotelFaces,
} from "../src/world/canada-place-hotel-source";
import {
  canadaPlaceCanopyCompatible,
  replaceCanadaPlaceCanopyFaces,
} from "../src/world/canada-place-canopy";
import {
  canadaPlaceFacadeCompatible,
  replaceCanadaPlaceWestFaces,
} from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";

type Mesh = T.Mesh<T.BufferGeometry, T.Material>;
const counts: Record<string, number> = { concrete: 30, glass: 20, trim: 20 };
// Independent original triangle audit, deliberately not imported from the
// implementation. Only tests use these original offsets, before any edits.
const originalRanges: Record<string, number[]> = {
  concrete: [288, 1728, 1900],
  glass: [856, 944],
  trim: [17324, 17412],
};
async function load() {
  const bytes = fs.readFileSync("public/models/vancouver/canada-place.glb");
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  );
  await MeshoptDecoder.ready;
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  return { root: gltf.scene, meshes };
}
function attributes(g: T.BufferGeometry) {
  return Object.entries(g.attributes).map(([name, attribute]) => ({
    name,
    attribute,
    array: Array.from(attribute.array),
  }));
}
function assertAttributes(
  g: T.BufferGeometry,
  before: ReturnType<typeof attributes>,
) {
  for (const { name, attribute, array } of before) {
    assert.equal(g.getAttribute(name), attribute, `${name} attribute identity`);
    assert.deepEqual(
      Array.from(g.getAttribute(name).array),
      array,
      `${name} data`,
    );
  }
}
function assertUnchanged(
  g: T.BufferGeometry,
  action: () => unknown,
  result: unknown,
) {
  const index = g.getIndex(),
    indices = index && Array.from(index.array),
    before = attributes(g);
  assert.equal(action(), result);
  assert.equal(g.getIndex(), index, "failure preserves index identity");
  assert.deepEqual(index && Array.from(index.array), indices);
  assertAttributes(g, before);
}

test("actual normalized GLB preflights unchanged and removes exactly the audited 70 faces", async () => {
  const { root, meshes } = await load();
  const original = meshes.map((m) => attributes(m.geometry));
  assert.equal(panPacificHowePodiumCompatible(root), true);
  assert.equal(canadaPlaceHotelCompatible(root), true);
  assert.equal(canadaPlaceCanopyCompatible(root), true);
  assert.equal(canadaPlaceFacadeCompatible(root), true);
  let removed = 0;
  for (const [i, mesh] of meshes.entries()) {
    assert.ok(
      mesh.geometry.getAttribute("position").array instanceof Int16Array,
    );
    assert.equal(mesh.geometry.getAttribute("position").normalized, true);
    assertAttributes(mesh.geometry, original[i]);
    const g = bakeGeometry(mesh.geometry, mesh.matrixWorld),
      name = mesh.material.name;
    assert.ok(g.getAttribute("position").array instanceof Float32Array);
    // A caller-owned nonstandard array must also survive the index-only edit.
    g.setAttribute("custom", new T.Float32BufferAttribute([9, 8, 7], 1));
    const before = attributes(g),
      indices = Array.from(g.index!.array);
    const excluded = new Set(
      (originalRanges[name] ?? []).flatMap((first) =>
        Array.from({ length: 10 }, (_, j) => first + j),
      ),
    );
    const expected = indices.filter((_, j) => !excluded.has(Math.floor(j / 3)));
    const count = replacePanPacificHowePodiumFaces(g, name);
    assert.equal(count, counts[name] ?? 0);
    removed += count;
    assert.deepEqual(
      Array.from(g.index!.array),
      expected,
      `${name}: every cap, PIER floor, adjacent face, west face and tower triangle retained in order`,
    );
    assertAttributes(g, before);
    assertUnchanged(g, () => replacePanPacificHowePodiumFaces(g, name), 0);
  }
  assert.equal(removed, 70);
});

test("all six west/canopy/hotel cut orders coexist with paving and podium before or after", async () => {
  const { meshes } = await load();
  const edits = [
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
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const results = new Map<string, number[]>();
  for (const order of orders)
    for (const podiumFirst of [true, false]) {
      for (const mesh of meshes) {
        const name = mesh.material.name,
          g = bakeGeometry(mesh.geometry, mesh.matrixWorld);
        const before = attributes(g),
          paving = extractCanadaPlacePaving(g, name);
        if (name === "concrete")
          assert.equal(paving?.getAttribute("position").count, 93);
        else assert.equal(paving, null);
        if (podiumFirst)
          assert.equal(
            replacePanPacificHowePodiumFaces(g, name),
            counts[name] ?? 0,
          );
        for (const i of order)
          assert.equal(
            edits[i].fn(g, name),
            (edits[i].counts as Record<string, number>)[name] ?? 0,
          );
        if (!podiumFirst)
          assert.equal(
            replacePanPacificHowePodiumFaces(g, name),
            counts[name] ?? 0,
          );
        const actual = Array.from(g.index!.array);
        if (results.has(name))
          assert.deepEqual(actual, results.get(name), `${name}: edits commute`);
        else results.set(name, actual);
        assertAttributes(g, before);
        paving?.dispose();
        g.dispose();
      }
    }
});

test("changed source indices, geometry, transforms and scene membership fail preflight without buffer mutation", async () => {
  for (const change of [
    "position",
    "unrelated-position",
    "index",
    "unrelated-index",
    "missing",
    "duplicate",
    "transform",
    "array-material",
  ] as const) {
    const { root, meshes } = await load(),
      mesh = meshes.find((m) => m.material.name === "concrete")!;
    if (change === "position" || change === "unrelated-position") {
      const p = mesh.geometry.getAttribute("position"),
        id = change === "position" ? 864 : 0;
      p.setX(id, p.getX(id) + 0.01);
    }
    if (change === "index") mesh.geometry.index!.setX(288 * 3, 865);
    if (change === "unrelated-index") mesh.geometry.index!.setX(0, 1);
    if (change === "missing") mesh.removeFromParent();
    if (change === "duplicate") root.add(mesh.clone());
    if (change === "transform") mesh.position.x += 0.1;
    if (change === "array-material")
      (mesh as T.Mesh).material = [mesh.material];
    const snapshots = meshes.map((m) => ({
      attrs: attributes(m.geometry),
      index: m.geometry.index,
      values: Array.from(m.geometry.index!.array),
    }));
    assert.equal(panPacificHowePodiumCompatible(root), false, change);
    for (const [i, m] of meshes.entries()) {
      assertAttributes(m.geometry, snapshots[i].attrs);
      assert.equal(m.geometry.index, snapshots[i].index);
      assert.deepEqual(
        Array.from(m.geometry.index!.array),
        snapshots[i].values,
      );
    }
  }
});

test("altered, partial, duplicate and reordered target triples fail atomically after existing cuts", async () => {
  const { meshes } = await load();
  for (const mesh of meshes.filter((m) => counts[m.material.name])) {
    for (const change of [
      "position",
      "partial",
      "reverse",
      "duplicate",
      "order",
      "invalid-index",
      "group",
      "range",
    ] as const) {
      const name = mesh.material.name,
        g = bakeGeometry(mesh.geometry, mesh.matrixWorld);
      const original = Array.from(g.index!.array);
      const target = original.slice(
        originalRanges[name][0] * 3,
        originalRanges[name][0] * 3 + 3,
      );
      extractCanadaPlacePaving(g, name);
      replaceCanadaPlaceHotelFaces(g, name);
      replaceCanadaPlaceCanopyFaces(g, name);
      replaceCanadaPlaceWestFaces(g, name);
      const indices = Array.from(g.index!.array);
      const offset = indices.findIndex(
        (_, i) => i % 3 === 0 && target.every((v, j) => indices[i + j] === v),
      );
      assert.ok(offset >= 0);
      if (change === "position") g.getAttribute("position").setY(target[0], 0);
      if (change === "partial") indices.splice(offset, 3);
      if (change === "reverse")
        [indices[offset], indices[offset + 1]] = [
          indices[offset + 1],
          indices[offset],
        ];
      if (change === "duplicate") indices.splice(offset + 3, 0, ...target);
      if (change === "order")
        indices.splice(
          offset,
          6,
          ...indices.slice(offset + 3, offset + 6),
          ...target,
        );
      if (change === "invalid-index")
        indices[0] = g.getAttribute("position").count;
      if (change === "group") g.addGroup(0, 3, 0);
      if (change === "range") g.setDrawRange(0, 3);
      g.setIndex(indices);
      assertUnchanged(g, () => replacePanPacificHowePodiumFaces(g, name), 0);
    }
  }
});

test("retained source PIER floor supports every inward edge sample after all source cuts", async () => {
  const { meshes } = await load();
  const concrete = meshes.find((m) => m.material.name === "concrete")!;
  const g = bakeGeometry(concrete.geometry, concrete.matrixWorld);
  const paving = extractCanadaPlacePaving(g, "concrete")!;
  replaceCanadaPlaceHotelFaces(g, "concrete");
  replaceCanadaPlaceCanopyFaces(g, "concrete");
  replaceCanadaPlaceWestFaces(g, "concrete");
  assert.equal(replacePanPacificHowePodiumFaces(g, "concrete"), 30);
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const floors = [new T.Mesh(g, material), new T.Mesh(paving, material)];
  const points = [
    [-130.7525017667, 106.1208705729],
    [-120.9504206147, 100.9445142506],
    [-108.3674527358, 94.1651572612],
    [-90.2227114033, 84.1464030898],
    [-84.3414627125, 80.8958739586],
    [-76.4126681809, 76.5098860215],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    for (const inward of [1, 3]) {
      const x = (a[0] + b[0]) / 2 + (dz / length) * inward;
      const z = (a[1] + b[1]) / 2 - (dx / length) * inward;
      const ray = new T.Raycaster(
        new T.Vector3(x, 10, z),
        new T.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObjects(floors)[0];
      assert.ok(hit, `edge ${36 + i}, inward ${inward} retains floor`);
      assert.ok(Math.abs(hit.point.y - 7.7989358902) < 0.00001);
      assert.ok(
        Math.abs(hit.point.y + 0.08 - 7.88) < 0.0011,
        "source floor with scene transform agrees with shared finished deck",
      );
    }
  }
});
