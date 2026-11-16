import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import fs from "node:fs";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadVancouverLandmarks } from "../src/world/vancouver-landmarks";
import type { Materials } from "../src/world/materials";
import { geo } from "../src/world/data";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  HOTEL_VANCOUVER_CORNICES as S,
  createHotelVancouverCorniceGeometry,
  hotelVancouverCornicesCompatible,
  replaceHotelVancouverCornices,
} from "../src/world/hotel-vancouver-cornices";
async function fixture(path = S.source) {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
      .read(path),
    root = new T.Group(),
    mats = new Map<string, T.MeshStandardMaterial>();
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      const name = pr.getMaterial()!.getName(),
        m = new T.MeshStandardMaterial({ name });
      m.color.fromArray(pr.getMaterial()!.getBaseColorFactor());
      m.roughness = pr.getMaterial()!.getRoughnessFactor();
      m.metalness = pr.getMaterial()!.getMetallicFactor();
      mats.set(name, m);
      root.add(new T.Mesh(g, m));
    }
  return root;
}

const root = await fixture();
const meshes = root.children as T.Mesh<
  T.BufferGeometry,
  T.MeshStandardMaterial
>[];
const stone = meshes.find((m) => m.material.name === "stone")!.geometry;
const count = (g: T.BufferGeometry) =>
  (g.index?.count ?? g.attributes.position.count) / 3;

test("complete actual-stone fingerprint selects only56 old tier bars and preserves all other source triangles", () => {
  assert.ok(hotelVancouverCornicesCompatible(stone, "stone"));
  const g = stone.clone(),
    positions = Array.from(g.attributes.position.array),
    old = Array.from(g.index!.array);
  const detail = replaceHotelVancouverCornices(g, "stone")!;
  assert.ok(detail);
  assert.equal(old.length - g.index!.count, 672 * 3);
  const remove = new Set(S.removedTriangles);
  assert.deepEqual(
    Array.from(g.index!.array),
    old.filter((_, i) => !remove.has(Math.floor(i / 3))),
  );
  assert.deepEqual(Array.from(g.attributes.position.array), positions);
  for (const t of S.removedTriangles) {
    const ys = old
      .slice(t * 3, t * 3 + 3)
      .map((i) => stone.attributes.position.getY(i));
    assert.ok(
      [40, 60, 80].some((y) => ys.every((v) => v > y - 0.75 && v < y + 0.05)),
    );
  }
  assert.equal(count(detail), 1568);
  assert.equal(
    replaceHotelVancouverCornices(g, "stone"),
    null,
    "second call cannot install duplicate bands",
  );
  for (const m of meshes.filter((m) => m.material.name !== "stone")) {
    const g = m.geometry.clone(),
      ix = Array.from(g.index!.array);
    assert.equal(replaceHotelVancouverCornices(g, m.material.name), null);
    assert.deepEqual(Array.from(g.index!.array), ix);
  }
  for (const change of ["position", "index", "group", "range"]) {
    const bad = stone.clone();
    if (change === "position")
      bad.attributes.position.setX(0, bad.attributes.position.getX(0) + 0.01);
    if (change === "index") bad.index!.setX(0, bad.index!.getX(0) + 1);
    if (change === "group") bad.addGroup(0, 3, 0);
    if (change === "range") bad.setDrawRange(3, 3);
    const before = Array.from(bad.index!.array);
    assert.equal(replaceHotelVancouverCornices(bad, "stone"), null);
    assert.deepEqual(Array.from(bad.index!.array), before);
  }
});

test("replacement cornices are closed modest solid mouldings with outward normals and metric UVs", () => {
  const g = createHotelVancouverCorniceGeometry(),
    p = g.attributes.position,
    edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const vs = [0, 1, 2].map((j) =>
      new T.Vector3().fromBufferAttribute(p, i + j),
    );
    const normal = vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0]));
    assert.ok(normal.length() > 1e-7);
    volume += vs[0].dot(vs[1].clone().cross(vs[2])) / 6;
    for (let j = 0; j < 3; j++) {
      const key = [vs[j], vs[(j + 1) % 3]]
        .map((v) =>
          v
            .toArray()
            .map((n) => n.toFixed(4))
            .join(),
        )
        .sort()
        .join("|");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every((n) => n === 2));
  assert.ok(volume > 0 && volume < 1500);
  assert.equal(g.attributes.uv.count, p.count);
  assert.ok(Array.from(g.attributes.uv.array).every(Number.isFinite));
  const mesh = new T.Mesh(g, new T.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  let windows = 0;
  for (const m of meshes.filter((m) =>
    ["glass", "glow"].includes(m.material.name),
  )) {
    const a = m.geometry.attributes.position,
      ix = m.geometry.index!;
    for (let i = 0; i < ix.count; i += 3) {
      const v = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(a, ix.getX(i + j)),
      );
      const n = v[1]
        .clone()
        .sub(v[0])
        .cross(v[2].clone().sub(v[0]))
        .normalize();
      if (Math.abs(n.y) > 0.01) continue;
      const c = v[0]
        .clone()
        .add(v[1])
        .add(v[2])
        .multiplyScalar(1 / 3);
      const hits = new T.Raycaster(
        c.clone().addScaledVector(n, 2),
        n.clone().negate(),
        0,
        2.01,
      ).intersectObject(mesh);
      assert.equal(hits.length, 0, `original window at${c.toArray()} covered`);
      windows++;
    }
  }
  assert.ok(windows > 1000, `${windows} actual window triangles checked`);
});

test("actual landmark loader applies one Hotel-only batch using the existing stone material and safe source fallback", async () => {
  const catalog = JSON.parse(
    fs.readFileSync("public/data/vancouver-landmarks.json", "utf8"),
  );
  const hotel = catalog.find((a: { id: string }) => a.id === S.id);
  const other = catalog.find((a: { id: string }) => a.id === "marine-building");
  const neighbor = await fixture(`public/${other.file}`);
  const oldLoad = GLTFLoader.prototype.loadAsync,
    oldFetch = globalThis.fetch;
  const materials = { texture: () => new T.Texture() } as unknown as Materials;
  let incompatible = false;
  const refs: Parameters<typeof loadVancouverLandmarks>[2] = [];
  globalThis.fetch = async () => new Response(JSON.stringify([hotel, other]));
  GLTFLoader.prototype.loadAsync = async (url) => {
    const scene = (String(url).endsWith(hotel.file) ? root : neighbor).clone(
      true,
    );
    if (incompatible && String(url).endsWith(hotel.file)) {
      const m = scene.children.find(
        (o) =>
          (o as T.Mesh).material &&
          ((o as T.Mesh).material as T.Material).name === "stone",
      ) as T.Mesh;
      m.geometry = m.geometry.clone();
      m.geometry.attributes.position.setX(
        0,
        m.geometry.attributes.position.getX(0) + 0.01,
      );
    }
    return { scene } as unknown as GLTF;
  };
  try {
    const parent = new T.Group();
    const result = await loadVancouverLandmarks(parent, materials, refs);
    assert.equal(result.count, 2);
    assert.equal(refs.length, 0);
    const group = parent.children.find((o) => o.name === hotel.name)!;
    const list = group.children as T.Mesh<
      T.BufferGeometry,
      T.MeshStandardMaterial
    >[];
    assert.equal(list.length, 7);
    const detail = list.find(
      (m) => m.name === "Hotel Vancouver layered stone cornices",
    )!;
    const wall = list.find((m) => m !== detail && m.material.name === "stone")!;
    assert.equal(detail.material, wall.material);
    assert.ok(detail.castShadow && detail.receiveShadow);
    assert.equal(detail.material.userData.landmarkId, S.id);
    assert.equal(
      list.reduce((n, m) => n + count(m.geometry), 0),
      24028,
    );
    const [x, z] = geo(hotel.origin[1], hotel.origin[0]);
    assert.deepEqual(group.position.toArray(), [x, 0.08, z]);
    for (const old of meshes.filter((m) => m.material.name !== "stone")) {
      const current = list.find((m) => m.material.name === old.material.name)!;
      assert.deepEqual(
        Array.from(current.geometry.index!.array),
        Array.from(old.geometry.index!.array),
      );
      assert.deepEqual(
        Array.from(current.geometry.attributes.position.array),
        Array.from(old.geometry.attributes.position.array),
      );
    }
    const otherGroup = parent.children.find((o) => o.name === other.name)!;
    assert.equal(otherGroup.children.length, neighbor.children.length);
    neighbor.children.forEach((o, i) => {
      assert.deepEqual(
        Array.from((otherGroup.children[i] as T.Mesh).geometry.index!.array),
        Array.from((o as T.Mesh).geometry.index!.array),
      );
      assert.deepEqual(
        Array.from(
          (otherGroup.children[i] as T.Mesh).geometry.attributes.position.array,
        ),
        Array.from((o as T.Mesh).geometry.attributes.position.array),
      );
    });
    incompatible = true;
    const fallbackParent = new T.Group();
    await loadVancouverLandmarks(fallbackParent, materials, []);
    const fallback = fallbackParent.children.find(
      (o) => o.name === hotel.name,
    )!;
    assert.equal(fallback.children.length, 6);
    assert.ok(
      !fallback.children.some(
        (m) => m.name === "Hotel Vancouver layered stone cornices",
      ),
    );
    assert.equal(
      fallback.children.reduce((n, m) => n + count((m as T.Mesh).geometry), 0),
      23132,
    );
  } finally {
    GLTFLoader.prototype.loadAsync = oldLoad;
    globalThis.fetch = oldFetch;
  }
});
