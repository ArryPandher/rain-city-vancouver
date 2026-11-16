import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { Batcher } from "../src/world/geometry";
import {
  ArchitecturalMesh,
  facadeFrame,
} from "../src/world/architectural-mesh";
import {
  GALLERY_HOOPER as d,
  addGalleryHooperFacade,
  galleryHooperBays,
  galleryHooperSourceCompatible,
  removeOriginalGalleryHooperFace,
} from "../src/world/gallery-hooper-facade";
import source from "../src/world/gallery-hooper-source.json";
async function originals() {
  await MeshoptDecoder.ready;
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(source.source))
      .digest("hex"),
    source.sha256,
  );
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(source.source);
  const result = new Map<string, T.BufferGeometry>();
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized()),
        p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(p, 3),
      );
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      result.set(pr.getMaterial()!.getName(), g);
    }
  return result;
}
function candidate() {
  const root = new T.Group(),
    batch = new Batcher(root),
    mesh = new ArchitecturalMesh(batch, 0, 0);
  const mats = ["stone", "frame", "glass"].map(
    (name) => new T.MeshStandardMaterial({ name }),
  );
  addGalleryHooperFacade(mesh, mats[0], mats[1], mats[2]);
  mesh.finish();
  const chunks = batch.finish();
  root.updateMatrixWorld(true);
  return { root, chunks };
}
const f = facadeFrame(d.a, d.b),
  at = (x: number, y: number, z: number) => new T.Vector3(...f.p(x, y, z));
function ray(root: T.Object3D, x: number, y: number) {
  return new T.Raycaster(
    at(x, y, -3),
    new T.Vector3(-f.outward[0], 0, -f.outward[1]),
    0,
    5,
  ).intersectObject(root, true);
}
test("decoded source loses only the 210 stone and 20 glass target triangles; every other attribute and triangle survives", async () => {
  for (const [name, g] of await originals()) {
    const positions = Array.from(g.attributes.position.array),
      ix = Array.from(g.index!.array);
    const s = source.materials[name as keyof typeof source.materials],
      selected = new Set(s?.triangles.map((t) => t.join(",")) ?? []),
      expected: number[] = [];
    for (let i = 0; i < ix.length; i += 3)
      if (!selected.has(ix.slice(i, i + 3).join(",")))
        expected.push(...ix.slice(i, i + 3));
    assert.equal(
      removeOriginalGalleryHooperFace(g, name),
      name === "stone" ? 210 : name === "glass" ? 20 : 0,
    );
    assert.deepEqual(Array.from(g.index!.array), expected);
    assert.deepEqual(Array.from(g.attributes.position.array), positions);
    assert.equal(removeOriginalGalleryHooperFace(g, name), 0, "idempotent cut");
  }
});
test("same-count coordinate drift and incomplete selected faces fail closed", async () => {
  const g = (await originals()).get("stone")!;
  assert.equal(galleryHooperSourceCompatible(g, "stone"), true);
  const changed = g.clone(),
    id = source.materials.stone.vertices[0][0];
  changed.attributes.position.setY(
    id,
    changed.attributes.position.getY(id) + 0.01,
  );
  const before = Array.from(changed.index!.array);
  assert.equal(removeOriginalGalleryHooperFace(changed, "stone"), 0);
  assert.deepEqual(Array.from(changed.index!.array), before);
  const missing = g.clone(),
    tri = source.materials.stone.triangles[0].join(","),
    ix = Array.from(missing.index!.array),
    keep: number[] = [];
  for (let i = 0; i < ix.length; i += 3)
    if (ix.slice(i, i + 3).join(",") !== tri) keep.push(...ix.slice(i, i + 3));
  missing.setIndex(keep);
  assert.equal(removeOriginalGalleryHooperFace(missing, "stone"), 0);
  assert.deepEqual(Array.from(missing.index!.array), keep);
});
test("three two-row bays have closed .38m glass with no retained old five-bay panes", async () => {
  const { root } = candidate();
  for (const [name, g] of await originals()) {
    removeOriginalGalleryHooperFace(g, name);
    g.rotateY(source.angle);
    root.add(new T.Mesh(g, new T.MeshStandardMaterial({ name })));
  }
  root.updateMatrixWorld(true);
  for (const x of galleryHooperBays())
    for (const [b, t] of d.rows) {
      const hits = ray(root, x - 0.5, b + (t - b) * 0.35);
      assert.ok(hits.length);
      assert.equal(
        ((hits[0].object as T.Mesh).material as T.Material).name,
        "glass",
      );
      assert.ok(Math.abs(hits[0].distance - 3.38) < 0.0001);
      assert.equal(
        hits.filter(
          (h) =>
            ((h.object as T.Mesh).material as T.Material).name === "glass" &&
            h.distance < 3.5,
        ).length,
        1,
      );
    }
});
test("engaged pilasters and projected cornice retain bounded silhouette and source datum", (t) => {
  const { root, chunks } = candidate();
  assert.equal(chunks.length, 3);
  let tris = 0;
  const bounds = new T.Box3().setFromObject(root);
  t.diagnostic(
    JSON.stringify({
      bounds: bounds.min.toArray().concat(bounds.max.toArray()),
    }),
  );
  assert.ok(bounds.min.y >= 3.19999 && bounds.max.y <= 18.00001);
  assert.ok(bounds.min.x > -9.25 && bounds.max.x < -8.2);
  assert.ok(bounds.min.z >= 33.69 && bounds.max.z < 49.38);
  for (const m of chunks) {
    tris += m.geometry.index!.count / 3;
    for (const key of ["position", "normal"]) {
      for (const v of m.geometry.attributes[key].array)
        assert.ok(Number.isFinite(v));
    }
  }
  t.diagnostic(`${tris} triangles, three reused material batches`);
  assert.ok(tris < 3000);
  const span = d.length - 2 * d.pilasterInset;
  for (let i = 0; i < 4; i++)
    assert.ok(
      Math.abs(
        ray(root, d.pilasterInset + (span * i) / 3, 7)[0].distance - 2.74,
      ) < 0.0001,
    );
  assert.ok(
    Math.abs(ray(root, d.length / 2, 13.97)[0].distance - 2.47) < 0.0001,
  );
});
test("four reveal normals face each physical aperture", () => {
  const { root } = candidate(),
    x = galleryHooperBays()[1],
    l = x - d.windowWidth / 2,
    r = x + d.windowWidth / 2,
    b = 9.05,
    t = 12.2;
  for (const [start, target, normal] of [
    [
      at(l + 0.3, 10, -0.3),
      at(l, 10, 0.15),
      new T.Vector3(
        (d.b[0] - d.a[0]) / d.length,
        0,
        (d.b[1] - d.a[1]) / d.length,
      ),
    ],
    [
      at(r - 0.3, 10, -0.3),
      at(r, 10, 0.15),
      new T.Vector3(
        -(d.b[0] - d.a[0]) / d.length,
        0,
        -(d.b[1] - d.a[1]) / d.length,
      ),
    ],
    [at(x - 0.4, t - 0.3, -0.3), at(x - 0.4, t, 0.15), new T.Vector3(0, -1, 0)],
    [at(x - 0.4, b + 0.3, -0.3), at(x - 0.4, b, 0.15), new T.Vector3(0, 1, 0)],
  ]) {
    const delta = target.clone().sub(start),
      hit = new T.Raycaster(
        start,
        delta.clone().normalize(),
        0,
        delta.length() + 0.01,
      ).intersectObject(root, true)[0];
    assert.ok(hit);
    assert.ok(hit.point.distanceTo(target) < 0.001);
    assert.ok(hit.face!.normal.dot(normal) > 0.999);
  }
});

test("raking cornice presents a closed exterior profile beneath the retained roof apex", () => {
  const { root } = candidate();
  const g = d.gable,
    mid = (g.start + g.end) / 2,
    slope = (g.apex - g.spring) / ((g.end - g.start) / 2);
  for (const sign of [-1, 1]) {
    const v = mid + sign * 3,
      y = g.apex - slope * 3 - 0.1;
    const hit = new T.Raycaster(
      new T.Vector3(g.u + 2, y, v),
      new T.Vector3(-1, 0, 0),
      0,
      3,
    ).intersectObject(root, true)[0];
    assert.ok(hit, "both raking profiles face the courtyard");
    assert.ok(hit.point.x > g.u + 0.3 && hit.point.x < g.u + 0.35);
  }
});
