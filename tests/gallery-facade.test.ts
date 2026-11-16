import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  GALLERY_FACADE,
  GALLERY_FACADE_EDGES,
  galleryFacadeCompatible,
  addGalleryFacade,
  replaceGalleryWingFaces,
} from "../src/world/gallery-facade";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import source from "../src/world/gallery-rear-entry-data.json";

async function scene() {
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
  const root = new T.Group(),
    before = new T.Group(),
    materials = new Map<string, T.MeshStandardMaterial>(),
    removed: Record<string, number> = {};
  for (const n of doc.getRoot().listNodes())
    for (const pr of n.getMesh()?.listPrimitives() ?? []) {
      const a = pr.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized());
      const pos = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        pos.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setIndex(new T.BufferAttribute(pr.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      const name = pr.getMaterial()!.getName(),
        mat = new T.MeshStandardMaterial({ name });
      materials.set(name, mat);
      repairGalleryRearEntry(g, name);
      before.add(new T.Mesh(g.clone(), mat));
      const positions = Array.from(g.getAttribute("position").array);
      const oldIndex = Array.from(g.getIndex()!.array);
      removed[name] = replaceGalleryWingFaces(g, name);
      const kept = new Set<string>();
      const nextIndex = g.getIndex()!;
      for (let i = 0; i < nextIndex.count; i += 3)
        kept.add([0, 1, 2].map((j) => nextIndex.getX(i + j)).join(","));
      const ranges =
        source.materials[name as keyof typeof source.materials]?.ranges ?? [];
      for (let i = 0; i < oldIndex.length; i += 3) {
        const triangle = oldIndex.slice(i, i + 3);
        if (
          name === "foundation" &&
          triangle.every((id) => id >= 3819 && id <= 4062)
        )
          assert.equal(
            kept.has(triangle.join(",")),
            false,
            "every superseded source-stair triangle removed",
          );
        if (
          name !== "foundation" &&
          triangle.some((id) => ranges.some(([a, b]) => id >= a && id <= b))
        )
          assert.ok(
            kept.has(triangle.join(",")),
            "every original translated column/pediment triangle retained",
          );
      }
      assert.deepEqual(
        Array.from(g.getAttribute("position").array),
        positions,
        "replacement never moves source vertices or landing",
      );
      root.add(new T.Mesh(g, mat));
    }
  assert.equal(galleryFacadeCompatible(before), true);
  const chunks = addGalleryFacade(root, materials);
  root.updateMatrixWorld(true);
  before.updateMatrixWorld(true);
  return { root, before, chunks, removed };
}
function point(u: number, y: number, v: number) {
  return new T.Vector3(u, y, v).applyAxisAngle(
    new T.Vector3(0, 1, 0),
    -GALLERY_FACADE.angle,
  );
}
function wingRay(
  along: number,
  y: number,
  root: T.Object3D,
  edge = GALLERY_FACADE,
) {
  const { a, b, length } = edge,
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const start = point(
    a[0] + dx * along + dz * 3,
    y,
    a[1] + dz * along - dx * 3,
  );
  const direction = point(-dz, 0, dx).normalize();
  return new T.Raycaster(start, direction, 0, 5).intersectObject(root, true);
}
test("actual gallery source replacement preserves landing and all other materials", async (t) => {
  const { root, before, removed } = await scene();
  t.diagnostic(JSON.stringify({ removed }));
  assert.deepEqual(removed, {
    foundation: 210 + 144,
    glass: 54,
    stone: 380,
    copper: 0,
    trim: 0,
  });
  for (const [name, count] of Object.entries(removed))
    if (!["stone", "foundation", "glass"].includes(name))
      assert.equal(count, 0);
  // The adjoining rear edge and opposite facade retain their exact surface hits.
  for (const [u, v, dv] of [
    [-8.8, 30, -1],
    [4.95, 30, -1],
    [10, -40, 1],
  ]) {
    const ray = new T.Raycaster(point(u, 5.5, v), point(0, 0, dv), 0, 60);
    const old = ray.intersectObject(before, true)[0],
      next = ray.intersectObject(root, true)[0];
    assert.ok(old && next);
    assert.ok(Math.abs(old.distance - next.distance) < 1e-6);
  }
  // Analytic evidence: old pale centre mullions are replaced by transparent-view
  // dark framing; sample off the horizontal meeting rail to reach closed glass.
  // The new raised bistro platform physically covers the lower foundation row
  // on this wing; its closed outward wall is checked in gallery-bistro.test.
  for (let i = 0; i < 6; i++)
    for (const y of [5.5, 10.4]) {
      const along =
        ((i + 0.5) * GALLERY_FACADE.length) / 6 - (y < 3 ? 0 : 0.55);
      const hit = wingRay(along, y, root)[0];
      assert.ok(hit);
      assert.equal(
        (hit.object as T.Mesh).material instanceof T.MeshStandardMaterial,
        true,
      );
      assert.equal(
        ((hit.object as T.Mesh).material as T.Material).name,
        "glass",
      );
      assert.ok(
        Math.abs(hit.distance - 3.38) < 0.004,
        "glass recessed .38 m, facing exterior",
      );
    }
  const adjacent = GALLERY_FACADE_EDGES[1];
  for (let i = 0; i < 3; i++)
    for (const y of [5.5, 10.4]) {
      const hit = wingRay(
        ((i + 0.5) * adjacent.length) / 3 - 0.65,
        y,
        root,
        adjacent,
      )[0];
      assert.ok(hit);
      assert.equal(
        ((hit.object as T.Mesh).material as T.Material).name,
        "glass",
      );
      assert.ok(Math.abs(hit.distance - 3.38) < 0.004);
    }
  const shorter = wingRay((0.5 * GALLERY_FACADE.length) / 6, 12, root)[0];
  assert.equal(
    ((shorter.object as T.Mesh).material as T.Material).name,
    "stone",
  );
});
test("added geometry is finite, bounded, economical and has outward sill faces", async (t) => {
  const { root, chunks } = await scene();
  let triangles = 0;
  assert.equal(chunks.length, 7);
  for (const mesh of chunks) {
    const p = mesh.geometry.getAttribute("position"),
      normal = mesh.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
      assert.ok(p.getY(i) >= -0.081 && p.getY(i) <= 16.751);
      assert.ok(
        p.getX(i) > -10.951 &&
          p.getX(i) < 20 &&
          p.getZ(i) > 22 &&
          p.getZ(i) < 33.4,
      );
      if (p.getZ(i) >= 25 || p.getY(i) < -0.001)
        assert.ok(
          p.getX(i) >= -8.831 &&
            p.getX(i) <= 19.001 &&
            (p.getX(i) <= 5.751 ? p.getY(i) <= 4.268 : p.getY(i) <= 6.231),
          "expanded bounds belong only to bounded terrace/rail assembly",
        );
      assert.ok(
        Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i)),
      );
    }
    triangles += mesh.geometry.getIndex()!.count / 3;
  }
  t.diagnostic(`${triangles} added triangles in ${chunks.length} draws`);
  assert.ok(
    triangles < 15500,
    `${triangles} added triangles including terrace framing`,
  );
  const hit = wingRay((0.5 * GALLERY_FACADE.length) / 6, 4.25, root)[0];
  assert.ok(
    hit && hit.distance < 3,
    "projecting sill visible from outside, not backface culled",
  );
});

test("source guard rejects absent or changed gallery primitives", () => {
  assert.equal(galleryFacadeCompatible(new T.Group()), false);
});

test("all four aperture reveals face the opening in an oblique exterior view", async () => {
  const { root } = await scene();
  for (const e of GALLERY_FACADE_EDGES) {
    // First bay on each edge, upper row: clear of retained entrance shafts.
    const centre = (0.5 * e.length) / e.bays,
      l = centre - 0.825,
      r = centre + 0.825,
      b = 9.55,
      t = 11.75;
    const at = (x: number, y: number, d: number) =>
      point(e.a[0] + e.dx * x - e.nx * d, y, e.a[1] + e.dz * x - e.nz * d);
    for (const [start, target, normal] of [
      [at(l + 0.3, 10.4, -0.3), at(l, 10.4, 0.15), point(e.dx, 0, e.dz)],
      [at(r - 0.3, 10.4, -0.3), at(r, 10.4, 0.15), point(-e.dx, 0, -e.dz)],
      [at(centre, t - 0.3, -0.3), at(centre, t, 0.15), new T.Vector3(0, -1, 0)],
      [at(centre, b + 0.3, -0.3), at(centre, b, 0.15), new T.Vector3(0, 1, 0)],
    ]) {
      const delta = target.clone().sub(start),
        ray = new T.Raycaster(
          start,
          delta.clone().normalize(),
          0,
          delta.length() + 0.01,
        );
      const hit = ray.intersectObject(root, true)[0];
      assert.ok(
        hit,
        "jamb/head/sill must not disappear through backface culling",
      );
      assert.equal(
        ((hit.object as T.Mesh).material as T.Material).name,
        "stone",
      );
      assert.ok(
        hit.point.distanceTo(target) < 0.002,
        "first hit is physical reveal, not backdrop or retained source",
      );
      const n = hit
        .face!.normal.clone()
        .transformDirection(hit.object.matrixWorld);
      assert.ok(n.dot(normal) > 0.999, "normal points into aperture");
    }
  }
});
