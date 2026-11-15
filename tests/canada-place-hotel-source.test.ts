import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  canadaPlaceHotelCompatible,
  replaceCanadaPlaceHotelFaces,
  CANADA_PLACE_HOTEL_SOURCE as specs,
} from "../src/world/canada-place-hotel-source";
import {
  canadaPlaceCanopyCompatible,
  replaceCanadaPlaceCanopyFaces,
} from "../src/world/canada-place-canopy";
import { replaceCanadaPlaceWestFaces } from "../src/world/canada-place-facade";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
async function load() {
  const file = "public/models/vancouver/canada-place.glb";
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    "1b7eab323b7bb3aa242438c2518910a3d88fae170bef74d31408bcb8c5096cbe",
  );
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(file);
  const root = new T.Group();
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        pos = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++)
        pos.set(a.getElement(i, []), i * 3);
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(pos, 3),
      );
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      root.add(
        new T.Mesh(
          g,
          new T.MeshStandardMaterial({ name: pr.getMaterial()!.getName() }),
        ),
      );
    }
  return root;
}
function primitives(root: T.Group) {
  return root.children as T.Mesh<T.BufferGeometry, T.Material>[];
}
test("actual source preflight and exact face15 removal preserve every other triangle/vertex", async () => {
  const root = await load();
  assert.equal(canadaPlaceHotelCompatible(root), true);
  assert.equal(canadaPlaceCanopyCompatible(root), true);
  for (const mesh of primitives(root)) {
    const name = mesh.material.name,
      g = mesh.geometry,
      spec = specs[name as keyof typeof specs];
    const before = Array.from(g.index!.array),
      positions = Array.from(g.getAttribute("position").array);
    const expected: number[] = [];
    for (let i = 0; i < before.length; i += 3) {
      const t = before.slice(i, i + 3);
      if (
        spec &&
        [spec.selected.slice(0, 3), spec.selected.slice(3)].some((s) =>
          s.every((v, j) => v === t[j]),
        )
      )
        continue;
      expected.push(...t);
    }
    assert.equal(replaceCanadaPlaceHotelFaces(g, name), spec ? 2 : 0);
    assert.deepEqual(
      Array.from(g.index!.array),
      expected,
      `${name}: exact untouched caps, neighbors, tower and hall`,
    );
    assert.deepEqual(Array.from(g.getAttribute("position").array), positions);
    assert.equal(replaceCanadaPlaceHotelFaces(g, name), 0);
    assert.deepEqual(Array.from(g.index!.array), expected);
  }
});
test("after paving extraction, canopy/hall and hotel replacements commute without altered counts", async () => {
  for (const hotelFirst of [true, false])
    for (const mesh of primitives(await load())) {
      const name = mesh.material.name,
        g = mesh.geometry,
        spec = specs[name as keyof typeof specs];
      const paving = extractCanadaPlacePaving(g, name);
      if (name === "concrete")
        assert.equal(paving?.getAttribute("position").count, 93);
      if (hotelFirst)
        assert.equal(replaceCanadaPlaceHotelFaces(g, name), spec ? 2 : 0);
      assert.equal(
        replaceCanadaPlaceCanopyFaces(g, name),
        ({ concrete: 2, glass: 24, trim: 156 } as Record<string, number>)[
          name
        ] ?? 0,
      );
      assert.equal(
        replaceCanadaPlaceWestFaces(g, name),
        ({ concrete: 10, glass: 100, trim: 480 } as Record<string, number>)[
          name
        ] ?? 0,
      );
      if (!hotelFirst)
        assert.equal(replaceCanadaPlaceHotelFaces(g, name), spec ? 2 : 0);
    }
});
test("changed positions, changed target indices and incomplete faces fail without mutation", async () => {
  for (const change of ["position", "index", "partial"] as const) {
    const root = await load(),
      mesh = primitives(root).find((m) => m.material.name === "concrete")!,
      g = mesh.geometry;
    if (change === "position")
      g.getAttribute("position").setX(
        3906,
        g.getAttribute("position").getX(3906) + 0.05,
      );
    if (change === "index") g.index!.setX(1686 * 3, 3907);
    if (change === "partial")
      g.setIndex(
        Array.from(g.index!.array).filter(
          (_, i) => i < 1686 * 3 || i >= 1687 * 3,
        ),
      );
    const index = g.index,
      before = Array.from(index!.array),
      positions = Array.from(g.getAttribute("position").array);
    assert.equal(canadaPlaceHotelCompatible(root), false);
    assert.equal(replaceCanadaPlaceHotelFaces(g, "concrete"), 0);
    assert.equal(
      g.index,
      index,
      "failed selection retains even the existing index object",
    );
    assert.deepEqual(Array.from(g.index!.array), before);
    assert.deepEqual(Array.from(g.getAttribute("position").array), positions);
  }
});

test("actual GLTFLoader normalized Int16 source preflights and cuts after float baking", async () => {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { bakeGeometry } = await import("../src/world/geometry");
  const file = fs.readFileSync("public/models/vancouver/canada-place.glb");
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      "",
    );
  const meshes: T.Mesh<T.BufferGeometry, T.Material>[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  assert.ok(meshes.length >= 3);
  const snapshots = meshes.map((m) =>
    Array.from(m.geometry.getAttribute("position").array),
  );
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    assert.ok(p.array instanceof Int16Array);
    assert.equal(
      p.normalized,
      true,
      "exercise actual runtime quantization, not NodeIO floats",
    );
  }
  assert.equal(canadaPlaceHotelCompatible(gltf.scene), true);
  assert.equal(canadaPlaceCanopyCompatible(gltf.scene), true);
  for (const [i, mesh] of meshes.entries()) {
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute("position").array),
      snapshots[i],
      "preflight leaves normalized source buffers untouched",
    );
    const name = mesh.material.name;
    const spec = specs[name as keyof typeof specs];
    const geometry = bakeGeometry(mesh.geometry, mesh.matrixWorld);
    assert.ok(geometry.getAttribute("position").array instanceof Float32Array);
    const paving = extractCanadaPlacePaving(geometry, name);
    if (name === "concrete")
      assert.equal(paving?.getAttribute("position").count, 93);
    assert.equal(replaceCanadaPlaceHotelFaces(geometry, name), spec ? 2 : 0);
    assert.equal(
      replaceCanadaPlaceCanopyFaces(geometry, name),
      ({ concrete: 2, glass: 24, trim: 156 } as Record<string, number>)[name] ??
        0,
    );
    assert.equal(
      replaceCanadaPlaceWestFaces(geometry, name),
      ({ concrete: 10, glass: 100, trim: 480 } as Record<string, number>)[
        name
      ] ?? 0,
    );
  }
  // Position perturbation remains rejected through the runtime path as well.
  const concrete = meshes.find((m) => m.material.name === "concrete")!;
  const position = concrete.geometry.getAttribute("position");
  position.setX(3906, position.getX(3906) + 0.01);
  assert.equal(canadaPlaceHotelCompatible(gltf.scene), false);
});
