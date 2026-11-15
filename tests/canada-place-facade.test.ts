import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ORIGIN,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_FACADE_SOURCE,
  CANADA_PLACE_WEST_FACES,
  CANADA_PLACE_FACADE_OPENINGS,
  canadaPlaceFacadePoint,
  canadaPlaceFacadeCompatible,
  replaceCanadaPlaceWestFaces,
  addCanadaPlaceWestFacade,
} from "../src/world/canada-place-facade";
async function scene() {
  await MeshoptDecoder.ready;
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(CANADA_PLACE_FACADE_SOURCE.file))
      .digest("hex"),
    CANADA_PLACE_FACADE_SOURCE.sha256,
  );
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(CANADA_PLACE_FACADE_SOURCE.file);
  const root = new T.Group(),
    original = new T.Group(),
    materials = new Map<string, T.MeshStandardMaterial>(),
    removed: Record<string, number> = {};
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        pos = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++)
        pos.set(a.getElement(i, []), i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      const name = pr.getMaterial()!.getName(),
        mat = new T.MeshStandardMaterial({ name });
      materials.set(name, mat);
      original.add(new T.Mesh(g.clone(), mat));
      const vertices = Array.from(g.getAttribute("position").array),
        indices = Array.from(g.getIndex()!.array);
      const paving = extractCanadaPlacePaving(g, name);
      if (name === "concrete")
        assert.ok(paving, "paving extraction succeeds before facade removal");
      if (paving) {
        const mesh = new T.Mesh(paving, mat);
        mesh.name = "paving";
        root.add(mesh);
      }
      removed[name] = replaceCanadaPlaceWestFaces(g, name);
      assert.deepEqual(
        Array.from(g.getAttribute("position").array),
        vertices,
        "never move original deck/hotel/sail vertices",
      );
      if (!["concrete", "glass", "trim"].includes(name))
        assert.deepEqual(
          Array.from(g.getIndex()!.array),
          indices,
          `retain every ${name} triangle`,
        );
      // Kept triangle indices must remain an ordered subsequence, no re-winding,
      // generated replacement indices, or changes to unrelated source primitives.
      let cursor = 0;
      const next = Array.from(g.getIndex()!.array);
      for (let i = 0; i < next.length; i += 3) {
        while (
          cursor < indices.length &&
          !next.slice(i, i + 3).every((v, j) => v === indices[cursor + j])
        )
          cursor += 3;
        assert.ok(cursor < indices.length);
        cursor += 3;
      }
      root.add(new T.Mesh(g, mat));
    }
  assert.equal(canadaPlaceFacadeCompatible(original), true);
  const snapshots = [...materials].map(([name, m]) => [
    name,
    m.color.getHex(),
    m.roughness,
    m.metalness,
    m.transparent,
    m.opacity,
  ]);
  const additions = addCanadaPlaceWestFacade(root, materials);
  assert.deepEqual(
    [...materials].map(([name, m]) => [
      name,
      m.color.getHex(),
      m.roughness,
      m.metalness,
      m.transparent,
      m.opacity,
    ]),
    snapshots,
    "facade never mutates shared Canada materials",
  );
  root.updateMatrixWorld(true);
  original.updateMatrixWorld(true);
  return { root, original, removed, additions };
}
const fixture = scene();
function ray(root: T.Object3D, from: T.Vector3, to: T.Vector3) {
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.015,
  ).intersectObject(root, true)[0];
}
test("source-pinned replacement is limited to reviewed west podium surfaces and three small batches", async () => {
  const { removed, additions, original } = await fixture;
  assert.equal(removed.concrete, 10);
  assert.equal(removed.glass, 100);
  assert.equal(removed.trim, 480);
  assert.equal(additions.length, 3);
  assert.ok(
    additions.reduce((s, m) => s + m.geometry.getIndex()!.count / 3, 0) < 7000,
  );
  for (const m of additions) {
    assert.equal((m.material as T.Material).side, T.FrontSide);
    assert.equal((m.material as T.Material).transparent, false);
    for (const v of m.geometry.getAttribute("position").array)
      assert.ok(Number.isFinite(v));
  }
  const mesh = original.children.find(
    (o) =>
      (o as T.Mesh).material instanceof T.Material &&
      (o as T.Mesh<T.BufferGeometry, T.Material>).material.name === "glass",
  ) as T.Mesh;
  const originalIndex = mesh.geometry.getIndex();
  mesh.geometry.setIndex([0, 1, 2]);
  assert.equal(canadaPlaceFacadeCompatible(original), false);
  mesh.geometry.setIndex(originalIndex);
});
test("actual GLB west openings have recessed first-hit panes instead of opaque front walls", async () => {
  const { root } = await fixture;
  for (const h of CANADA_PLACE_FACADE_OPENINGS) {
    const lights = Math.max(1, Math.round((h.r - h.l) / 1.35)),
      u = h.l + ((h.r - h.l) / lights) * 0.4,
      y = h.b + (h.t - h.b) * 0.27;
    const from = canadaPlaceFacadePoint(h.face, u, y, -1.5),
      to = canadaPlaceFacadePoint(h.face, u, y, h.depth);
    const hit = ray(root, from, to);
    assert.ok(hit, `pane missing face${h.face}`);
    assert.equal(hit.object.name, "canada-west-glass");
    assert.ok(Math.abs(hit.distance - (1.5 + h.depth)) < 0.004);
  }
});
test("front-sided jamb, head and sill reveals produce real oblique parallax", async () => {
  const { root } = await fixture;
  for (const f of CANADA_PLACE_WEST_FACES) {
    const h = CANADA_PLACE_FACADE_OPENINGS.find((h) => h.face === f.index)!;
    const y = (h.b + h.t) / 2 - 0.4;
    const casts = [
      [
        canadaPlaceFacadePoint(f.index, h.l + 0.3, y, -0.8),
        canadaPlaceFacadePoint(f.index, h.l, y, 0.17),
      ],
      [
        canadaPlaceFacadePoint(f.index, h.r - 0.3, y, -0.8),
        canadaPlaceFacadePoint(f.index, h.r, y, 0.17),
      ],
      [
        canadaPlaceFacadePoint(f.index, h.l + 0.5, h.t - 0.3, -0.8),
        canadaPlaceFacadePoint(f.index, h.l + 0.5, h.t, 0.17),
      ],
      [
        canadaPlaceFacadePoint(f.index, h.l + 0.5, h.b + 0.3, -0.8),
        canadaPlaceFacadePoint(f.index, h.l + 0.5, h.b, 0.17),
      ],
    ];
    for (const [from, to] of casts) {
      const hit = ray(root, from, to);
      assert.ok(hit, `reveal missing face${f.index}`);
      assert.equal(hit.object.name, "canada-west-wall");
      assert.ok(hit.distance < from.distanceTo(to) + 0.01);
    }
  }
});

test("simultaneous paving extraction preserves the exact promenade walking plane", async () => {
  const { root, original } = await fixture;
  for (const [x, z] of CANADA_PLACE_DECK_ROUTE) {
    const from = new T.Vector3(
        x - CANADA_PLACE_ORIGIN[0],
        9.3,
        z - CANADA_PLACE_ORIGIN[1],
      ),
      to = from.clone().setY(7.5);
    const before = ray(original, from, to),
      after = ray(root, from, to);
    assert.ok(before && after);
    assert.equal(after.object.name, "paving");
    assert.ok(Math.abs(after.point.y - before.point.y) < 1e-7);
  }
});
test("facade preflight rejects the unrelated gallery asset", async () => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read("public/models/vancouver/vancouver-art-gallery.glb");
  const root = new T.Group();
  for (const n of doc.getRoot().listNodes())
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(
          new Float32Array(p.getAttribute("POSITION")!.getCount() * 3),
          3,
        ),
      );
      g.setIndex(Array.from(p.getIndices()!.getArray()!));
      root.add(
        new T.Mesh(
          g,
          new T.MeshStandardMaterial({ name: p.getMaterial()!.getName() }),
        ),
      );
    }
  assert.equal(canadaPlaceFacadeCompatible(root), false);
});
test("upper glazing retains the source's shallow band instead of repeating the lower storey", () => {
  for (const f of CANADA_PLACE_WEST_FACES) {
    const openings = CANADA_PLACE_FACADE_OPENINGS.filter(
      (h) => h.face === f.index,
    );
    const lower = openings.filter((h) => h.b < 14),
      upper = openings.filter((h) => h.b >= 14);
    assert.equal(lower.length, f.bays);
    assert.equal(upper.length, f.bays);
    for (const h of lower) {
      assert.equal(h.b, 8.65);
      assert.equal(h.t, 12.15);
      assert.equal(h.depth, 0.34);
    }
    for (const h of upper) {
      assert.equal(h.b, 15);
      assert.equal(h.t, 16.7);
      assert.ok(h.t - h.b < 1.71);
      assert.equal(h.depth, 0.34);
    }
  }
});
