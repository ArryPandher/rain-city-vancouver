import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  galleryRoofCompatible,
  replaceGalleryRoofFaces,
  addGalleryRoofs,
  GALLERY_ROOFS,
} from "../src/world/gallery-roof";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import {
  replaceGalleryWingFaces,
  addGalleryFacade,
} from "../src/world/gallery-facade";
import source from "../src/world/gallery-rear-entry-data.json";
async function fixture() {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
      .read(source.source),
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
      mats.set(name, m);
      root.add(new T.Mesh(g, m));
    }
  assert.equal(galleryRoofCompatible(root), true);
  const removed: Record<string, number> = {};
  for (const o of root.children as T.Mesh[]) {
    const name = (o.material as T.Material).name,
      g = o.geometry;
    repairGalleryRearEntry(g, name);
    replaceGalleryWingFaces(g, name);
    const positions = Array.from(g.getAttribute("position").array),
      old = Array.from(g.index!.array);
    removed[name] = replaceGalleryRoofFaces(g, name);
    const kept = new Set(
      Array.from({ length: g.index!.count / 3 }, (_, i) =>
        [
          g.index!.getX(i * 3),
          g.index!.getX(i * 3 + 1),
          g.index!.getX(i * 3 + 2),
        ].join(","),
      ),
    );
    const ranges =
      source.materials[name as keyof typeof source.materials]?.ranges ?? [];
    for (let i = 0; i < old.length; i += 3) {
      const tri = old.slice(i, i + 3);
      if (tri.some((id) => ranges.some(([a, b]) => id >= a && id <= b)))
        assert.ok(
          kept.has(tri.join(",")),
          "all protected translated entry triangles remain",
        );
    }

    assert.deepEqual(Array.from(g.getAttribute("position").array), positions);
    if (!["stone", "copper"].includes(name))
      assert.deepEqual(Array.from(g.index!.array), old);
  }
  addGalleryFacade(root, mats);
  const chunks = addGalleryRoofs(root, mats);
  root.updateMatrixWorld(true);
  return { root, chunks, removed, mats };
}
function p(x: number, y: number, z: number) {
  return new T.Vector3(x, y, z).applyAxisAngle(
    new T.Vector3(0, 1, 0),
    -source.angle,
  );
}
function ray(root: T.Object3D, a: T.Vector3, b: T.Vector3) {
  return new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b),
  ).intersectObject(root, true);
}
test("source-specific roof removal coexists with retained gallery facade/entry repair", async () => {
  const f = await fixture();
  assert.deepEqual(f.removed, {
    foundation: 0,
    glass: 0,
    stone: 4,
    copper: 8,
    trim: 0,
  });
  assert.equal(galleryRoofCompatible(new T.Group()), false);
  for (const r of GALLERY_ROOFS) {
    const x = r.minX + 1.2;
    const hits = ray(f.root, p(x, 15, r.maxZ + 4), p(x, 15, r.maxZ - 1));
    assert.ok(hits.length);
    assert.equal((hits[0].object as T.Mesh).material, f.mats.get("glass"));
    assert.ok(
      Math.abs(hits[0].distance - 4.36) < 0.006,
      "old slope cannot occlude new clerestory",
    );
    const oblique = ray(
      f.root,
      p(r.minX + 0.29, 15, r.maxZ + 2),
      p(r.minX + 0.7, 15, r.maxZ - 0.5),
    );
    assert.ok(oblique.length);
  }
});
test("closed eaves, roof ends, supported cornice and finite geometry retain18m crest", async () => {
  const { root, chunks, mats } = await fixture();
  let count = 0,
    max = -Infinity;
  for (const o of chunks) {
    const g = o.geometry,
      pos = g.getAttribute("position"),
      normal = g.getAttribute("normal");
    count += g.index!.count / 3;
    for (let i = 0; i < pos.count; i++) {
      max = Math.max(max, pos.getY(i));
      assert.ok(
        [
          pos.getX(i),
          pos.getY(i),
          pos.getZ(i),
          normal.getX(i),
          normal.getY(i),
          normal.getZ(i),
        ].every(Number.isFinite),
      );
      assert.ok(
        Math.abs(
          Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1,
        ) < 0.001,
      );
    }
  }
  assert.ok(Math.abs(max - 18) < 0.003);
  for (const r of GALLERY_ROOFS) {
    const cz = (r.minZ + r.maxZ) / 2;
    assert.ok(
      ray(root, p(r.maxX + 2, 17, cz), p(r.maxX - 1, 17, cz)).some(
        (h) => (h.object as T.Mesh).material === mats.get("stone"),
      ),
      "closed gable end",
    );
    assert.ok(
      ray(
        root,
        p(r.maxX - 1, 15.5, r.maxZ + 0.25),
        p(r.maxX - 1, 16.2, r.maxZ + 0.25),
      ).length,
      "eave underside closed",
    );
    assert.ok(
      ray(
        root,
        p((r.minX + r.maxX) / 2, 20, cz),
        p((r.minX + r.maxX) / 2, 17, cz),
      ).length,
    );
  }
  assert.ok(
    ray(root, p(14, 13.4, 25), p(14, 13.4, 22.5)).length,
    "connected rear cornice",
  );
  assert.ok(count < 9000);
  console.log({ roofTriangles: count, batches: chunks.length });
});
