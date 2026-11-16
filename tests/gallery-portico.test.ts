import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { Batcher } from "../src/world/geometry";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import {
  addGalleryPortico,
  removeOriginalGalleryPortico,
} from "../src/world/gallery-portico";
import {
  GALLERY_PORTICO as D,
  galleryPorticoSourceTriangle,
} from "../src/world/gallery-portico-data";
import { galleryPorticoBlocked } from "../src/world/gallery-portico-contact";
import { GALLERY_BANNERS } from "../src/world/gallery-banners";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import entry from "../src/world/gallery-rear-entry-data.json";

function assembly() {
  const root = new T.Group(),
    batch = new Batcher(root, 512),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  addGalleryPortico(mesh, new T.MeshStandardMaterial());
  mesh.finish();
  const chunks = batch.finish();
  root.updateMatrixWorld(true);
  return { root, chunks };
}
function ray(root: T.Object3D, x: number, y: number, z: number) {
  return new T.Raycaster(
    new T.Vector3(x, y, z),
    new T.Vector3(0, 0, -1),
    0,
    5,
  ).intersectObject(root, true)[0];
}
test("five supported shafts and forward Ionic heads form four clear banner bays", (t) => {
  const { root, chunks } = assembly();
  assert.equal(chunks.length, 1);
  let triangles = 0;
  for (const m of chunks) triangles += m.geometry.index!.count / 3;
  assert.ok(triangles < 8000);
  t.diagnostic(`${triangles} portico triangles in existing stone batch`);
  for (const u of D.shaftU) {
    for (const y of [4, 7, 10.5]) {
      const hit = ray(root, u, y, 26)!;
      assert.ok(hit);
      assert.ok(hit.face!.normal.z > 0.97);
      assert.equal(
        galleryPorticoBlocked(hit.point.x, hit.point.z, 0.01, y + 0.08, true),
        true,
      );
    }
    for (const side of [-1, 1]) {
      const hit = ray(root, u + side * D.scrollOffset, D.scrollCentreY, 26)!;
      assert.ok(
        hit && hit.point.z > D.shaftV + 0.42,
        "Ionic scrolls face the public front",
      );
    }
    const top = new T.Raycaster(
      new T.Vector3(u, 12.5, D.shaftV),
      new T.Vector3(0, -1, 0),
      0,
      1,
    ).intersectObject(root, true)[0];
    assert.ok(
      top && Math.abs(top.point.y - D.entablatureBottom) < 1e-6,
      "capital bears directly on entablature",
    );
  }
  assert.equal(GALLERY_BANNERS.shaftU.length - 1, 4);
  assert.ok(GALLERY_BANNERS.top + 0.2 < D.entablatureBottom);
  for (let i = 1; i < D.shaftU.length; i++) {
    const centre = (D.shaftU[i - 1] + D.shaftU[i]) / 2;
    assert.equal(ray(root, centre, 10.5, 26), undefined);
    assert.ok(
      (D.shaftU[i] - D.shaftU[i - 1] - GALLERY_BANNERS.width) / 2 > 0.7,
    );
  }
});
test("all portico solids close with outward winding, finite normals and no route projection", () => {
  const { chunks } = assembly();
  const edges = new Map<string, number>();
  for (const m of chunks) {
    const p = m.geometry.getAttribute("position"),
      n = m.geometry.getAttribute("normal"),
      ix = m.geometry.index!;
    const key = (i: number) =>
      [p.getX(i), p.getY(i), p.getZ(i)]
        .map((v) => Math.round(v * 1e4))
        .join(",");
    for (let i = 0; i < p.count; i++) {
      assert.ok(p.getY(i) >= 3.19999 && p.getY(i) <= D.capitalTop + 0.00001);
      assert.ok(p.getZ(i) > 22.89 && p.getZ(i) < 24.1);
      assert.ok(
        Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5,
      );
    }
    for (let i = 0; i < ix.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = key(ix.getX(i + j)),
          b = key(ix.getX(i + ((j + 1) % 3)));
        assert.notEqual(a, b);
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(k, (edges.get(k) ?? 0) + (a < b ? 1 : -1));
      }
  }
  for (const [edge, balance] of edges)
    assert.equal(balance, 0, `closed oriented edge ${edge}`);
  assert.equal(
    galleryPorticoBlocked(D.shaftU[2], D.shaftV, 0.36, 0, false),
    false,
    "no infinite column below source plinth",
  );
  assert.equal(
    galleryPorticoBlocked(D.shaftU[2], D.shaftV, 0.25, 13, true),
    false,
    "no infinite column above bearing",
  );
  assert.equal(
    galleryPorticoBlocked(D.shaftU[2], 25, 0.36, 3.28, false),
    false,
    "stair flight outside columns clear",
  );
});
test("actual source removes only two superseded upper shafts/heads, preserving exact base and all other triangles", async () => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(entry.source);
  for (const node of doc.getRoot().listNodes())
    for (const pr of node.getMesh()?.listPrimitives() ?? []) {
      if (pr.getMaterial()!.getName() !== "trim") continue;
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        pos = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        pos.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(pos, 3),
      );
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      repairGalleryRearEntry(g, "trim");
      const before = g.clone(),
        positions = Array.from(g.getAttribute("position").array),
        old = Array.from(g.index!.array);
      assert.equal(removeOriginalGalleryPortico(g, "stone"), 0);
      assert.equal(removeOriginalGalleryPortico(g, "trim"), 712);
      assert.deepEqual(Array.from(g.getAttribute("position").array), positions);
      const expected: number[] = [];
      for (let i = 0; i < old.length; i += 3)
        if (!galleryPorticoSourceTriangle(old.slice(i, i + 3)))
          expected.push(...old.slice(i, i + 3));
      assert.deepEqual(Array.from(g.index!.array), expected);
      const p = before.getAttribute("position");
      p.setY(1162, p.getY(1162) + 20);
      const changed = Array.from(before.index!.array);
      assert.equal(removeOriginalGalleryPortico(before, "trim"), 0);
      assert.deepEqual(
        Array.from(before.index!.array),
        changed,
        "changed source fails closed",
      );
    }
});
