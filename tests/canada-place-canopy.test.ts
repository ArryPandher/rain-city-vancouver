import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  canadaPlaceCanopyCompatible,
  replaceCanadaPlaceCanopyFaces,
  addCanadaPlaceCanopy,
  CANADA_PLACE_CANOPY_LENGTH as L,
  canadaPlaceCanopyPoint as at,
  canadaPlaceCanopySection,
  CANADA_PLACE_CANOPY_WORLD_FOOTPRINT,
} from "../src/world/canada-place-canopy";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  replaceCanadaPlaceWestFaces,
  addCanadaPlaceWestFacade,
} from "../src/world/canada-place-facade";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ORIGIN,
} from "../src/world/canada-place-deck";
import { pointInPoly, segmentPoint } from "../src/world/data";
async function scene() {
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
      const g = new T.BufferGeometry().setAttribute(
        "position",
        new T.BufferAttribute(pos, 3),
      );
      g.setIndex(Array.from(pr.getIndices()!.getArray()!));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      g.computeVertexNormals();
      const name = pr.getMaterial()!.getName(),
        mat = new T.MeshStandardMaterial({ name });
      materials.set(name, mat);
      original.add(new T.Mesh(g.clone(), mat));
      const before = Array.from(g.getAttribute("position").array),
        ix = Array.from(g.getIndex()!.array);
      const paving = extractCanadaPlacePaving(g, name);
      if (paving) {
        const mesh = new T.Mesh(paving, mat);
        mesh.name = "paving";
        root.add(mesh);
      }
      const beforeCanopy = Array.from(g.getIndex()!.array);
      removed[name] = replaceCanadaPlaceCanopyFaces(g, name);
      const afterCanopy = Array.from(g.getIndex()!.array);
      assert.equal(beforeCanopy.length - afterCanopy.length, removed[name] * 3);
      // Whole triangles must be an ordered subsequence, not a reconstructed or
      // reordered surface that merely has the expected number of triangles.
      let keptTriangle = 0;
      for (let i = 0; i < beforeCanopy.length; i += 3) {
        if (
          beforeCanopy
            .slice(i, i + 3)
            .every((v, j) => v === afterCanopy[keptTriangle + j])
        )
          keptTriangle += 3;
      }
      assert.equal(
        keptTriangle,
        afterCanopy.length,
        `${name}: exact retained triangle order`,
      );
      assert.equal(
        replaceCanadaPlaceCanopyFaces(g, name),
        0,
        `${name}: idempotent removal`,
      );
      assert.deepEqual(Array.from(g.getIndex()!.array), afterCanopy);
      assert.deepEqual(
        Array.from(g.getAttribute("position").array),
        before,
        "original vertices untouched",
      );
      if (!["concrete", "glass", "trim"].includes(name))
        assert.deepEqual(
          Array.from(g.getIndex()!.array),
          ix,
          `retain every ${name} triangle`,
        );
      const west = replaceCanadaPlaceWestFaces(g, name);
      if (name === "concrete") assert.equal(west, 10);
      if (name === "glass") assert.equal(west, 100);
      if (name === "trim") assert.equal(west, 480);
      root.add(new T.Mesh(g, mat));
    }
  assert.equal(canadaPlaceCanopyCompatible(original), true);
  addCanadaPlaceWestFacade(root, materials);
  const meshes = addCanadaPlaceCanopy(root, materials);
  root.updateMatrixWorld(true);
  original.updateMatrixWorld(true);
  return { root, original, meshes, removed };
}
const fixture = scene();
function ray(root: T.Object3D, a: T.Vector3, b: T.Vector3) {
  return new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b) + 0.02,
  ).intersectObject(root, true)[0];
}
test("source-pinned entrance cuts preserve simultaneous paving and SAILS facade edits", async () => {
  const { meshes, removed } = await fixture;
  assert.equal(removed.concrete, 2);
  assert.equal(removed.glass, 24);
  assert.equal(removed.trim, 156);
  assert.equal(
    meshes.filter((m) => m.name === "canada-canopy-glass").length,
    3,
  );
  assert.equal(
    meshes.filter((m) => m.name === "canada-canopy-lining").length,
    1,
  );
  assert.ok(
    meshes.reduce((s, m) => s + m.geometry.getIndex()!.count / 3, 0) < 14000,
  );
  for (const m of meshes) {
    for (const v of m.geometry.getAttribute("position").array)
      assert.ok(Number.isFinite(v));
    for (const v of m.geometry.getAttribute("normal").array)
      assert.ok(Number.isFinite(v));
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    assert.ok(materials.length > 0);
    for (const material of materials) {
      if (m.name !== "canada-canopy-glass")
        assert.equal(material.side, T.FrontSide);
      else assert.equal(material.transparent, true);
    }
  }
});
test("actual GLB opening exposes curved panes at multiple heights and both oblique directions", async () => {
  const { root } = await fixture;
  for (const u of [7.5, 17.5, 28.5].map((n) => (L * n) / Math.ceil(L / 1.35)))
    for (const theta of [0.2, 0.6, 1.1]) {
      const s = canadaPlaceCanopySection(theta),
        target = at(u, s.y, s.outward);
      for (const shift of [-0.4, 0.4]) {
        const from = at(u + shift, s.y + 0.03, s.outward + 1.5);
        const hit = ray(root, from, target);
        assert.ok(hit);
        assert.equal(hit.object.name, "canada-canopy-glass");
        assert.ok(hit.distance < from.distanceTo(target) + 0.02);
      }
    }
});
test("closed glazed ends and capped deck-contact plinth are tangible from outside", async () => {
  const { root } = await fixture;
  for (const u of [0, L]) {
    const from = at(u + (u === 0 ? -1 : 1), 10, 1.3),
      to = at(u, 10, 1.3);
    const hit = ray(root, from, to);
    assert.ok(hit);
    assert.equal(hit.object.name, "canada-canopy-glass");
  }
  const foot = ray(root, at(L * 0.4, 8.1, 4), at(L * 0.4, 8.1, 3));
  assert.ok(foot);
  assert.equal(foot.object.name, "canada-canopy-stone");
  const top = ray(root, at(L * 0.4, 9, 2), at(L * 0.4, 8.65, 2));
  assert.ok(top);
  assert.equal(top.object.name, "canada-canopy-lining");
  assert.ok(Math.abs(top.point.y - 8.65) < 1e-5);
});
test("public promenade retains original support and stays outside the new closed footprint", async () => {
  const { root, original } = await fixture;
  assert.deepEqual(
    CANADA_PLACE_CANOPY_WORLD_FOOTPRINT,
    [
      [-138.04960662441343, 28.531185489873696],
      [-183.74182639442907, 53.088265158662885],
      [-185.16204407605167, 50.445731954177745],
      [-139.46982430603603, 25.888652285388556],
    ].flatMap(([x, z]) => [
      x + CANADA_PLACE_ORIGIN[0],
      z + CANADA_PLACE_ORIGIN[1],
    ]),
    "optics/depth changes must retain the reviewed closed footprint exactly",
  );
  for (let i = 1; i < CANADA_PLACE_DECK_ROUTE.length; i++) {
    const a = CANADA_PLACE_DECK_ROUTE[i - 1],
      b = CANADA_PLACE_DECK_ROUTE[i],
      steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j <= steps; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / steps,
        z = a[1] + ((b[1] - a[1]) * j) / steps;
      assert.equal(
        pointInPoly(x, z, CANADA_PLACE_CANOPY_WORLD_FOOTPRINT),
        false,
      );
      for (let k = 0; k < CANADA_PLACE_CANOPY_WORLD_FOOTPRINT.length; k += 2) {
        const p = CANADA_PLACE_CANOPY_WORLD_FOOTPRINT,
          kk = (k + 2) % p.length;
        assert.ok(
          segmentPoint(x, z, p[k], p[k + 1], p[kk], p[kk + 1]).d > 0.95,
        );
      }
      const from = new T.Vector3(
          x - CANADA_PLACE_ORIGIN[0],
          9.3,
          z - CANADA_PLACE_ORIGIN[1],
        ),
        to = from.clone().setY(7.5),
        before = ray(original, from, to),
        after = ray(root, from, to);
      assert.ok(before && after);
      assert.ok(Math.abs(before.point.y - after.point.y) < 1e-7);
    }
  }
});
