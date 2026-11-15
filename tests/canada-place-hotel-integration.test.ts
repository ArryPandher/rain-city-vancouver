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
} from "../src/world/canada-place-hotel-source";
import { createCanadaPlaceHotelJunction } from "../src/world/canada-place-hotel";
import {
  addCanadaPlaceCanopy,
  replaceCanadaPlaceCanopyFaces,
  canadaPlaceCanopyPoint as at,
  canadaPlaceCanopySection,
} from "../src/world/canada-place-canopy";
import { extractCanadaPlacePaving } from "../src/world/canada-place-paving";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ORIGIN,
} from "../src/world/canada-place-deck";
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

async function integrated() {
  const root = await load(),
    original = root.clone();
  assert.equal(canadaPlaceHotelCompatible(root), true);
  const materials = new Map<string, T.MeshStandardMaterial>();
  for (const object of [...root.children]) {
    const mesh = object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
    mesh.geometry = mesh.geometry.clone();
    const name = mesh.material.name;
    materials.set(name, mesh.material);
    const paving = extractCanadaPlacePaving(mesh.geometry, name);
    if (paving) root.add(new T.Mesh(paving, mesh.material));
    replaceCanadaPlaceHotelFaces(mesh.geometry, name);
    replaceCanadaPlaceCanopyFaces(mesh.geometry, name);
    mesh.name = `retained-source-${name}`;
  }
  addCanadaPlaceCanopy(root, materials);
  const hotel = createCanadaPlaceHotelJunction(materials);
  root.add(hotel);
  root.updateMatrixWorld(true);
  original.updateMatrixWorld(true);
  return { root, original, hotel };
}
const fixture = integrated();
function ray(root: T.Object3D, from: T.Vector3, to: T.Vector3) {
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to) + 0.02,
  ).intersectObject(root, true)[0];
}
test("source-cut hotel windows are visible through the replaced wall at front and oblique angles", async () => {
  const { root } = await fixture;
  for (const u of [4, 12, 24, 38, 48])
    for (const y of [16.2, 18.1])
      for (const shift of [-0.15, 0, 0.15]) {
        const hit = ray(root, at(u + shift, y, -0.7), at(u, y, -2.5));
        assert.ok(hit, `missing facade ${u}/${y}`);
        assert.equal(
          hit.object.name,
          "canada-hotel-glass",
          `retained source hides window ${u}/${y}`,
        );
      }
  // A grazing view catches the closed end cheek before entering the facade.
  for (const [u, sign] of [
    [0.8297647908500366, -1],
    [49.59057488502217, 1],
  ]) {
    const hit = ray(root, at(u + sign * 0.3, 17.9, -2.23), at(u, 17.9, -2.23));
    assert.ok(hit);
    assert.equal(hit.object.name, "canada-hotel-stone");
  }
});
test("new overhang joins the retained source cap with a tangible closed underside", async () => {
  const { root } = await fixture;
  for (const u of [4.17, 21.31, 47.63]) {
    for (const outward of [-2.41, -2.33, -2.29, -2.19, -1.81]) {
      const hit = ray(root, at(u, 20.35, outward), at(u, 20.1, outward));
      assert.ok(hit, `cap gap at ${u}/${outward}`);
      assert.ok(Math.abs(hit.point.y - 20.2) < 0.001);
      assert.ok(
        ["retained-source-concrete", "canada-hotel-stone"].includes(
          hit.object.name,
        ),
      );
    }
    const underside = ray(root, at(u, 19.8, -1.9), at(u, 20.1, -1.9));
    assert.ok(underside);
    assert.ok(underside.point.y < 20.021, "soffit is tangible from below");
    assert.ok(
      ["canada-hotel-stone", "canada-hotel-soffit-recess"].includes(
        underside.object.name,
      ),
    );
  }
});
test("hotel additions leave original canopy skin and public deck support unobstructed", async () => {
  const { root, original, hotel } = await fixture;
  for (const u of [3.37, 18.17, 36.31, 50.41])
    for (const theta of [0.2, 0.6, 1.1]) {
      const s = canadaPlaceCanopySection(theta),
        target = at(u, s.y, s.outward);
      assert.equal(
        ray(hotel, at(u, s.y + 0.03, s.outward + 1), target),
        undefined,
      );
      assert.equal(
        ray(root, at(u, s.y + 0.03, s.outward + 1), target)?.object.name,
        "canada-canopy-glass",
      );
    }
  for (let i = 1; i < CANADA_PLACE_DECK_ROUTE.length; i++) {
    const a = CANADA_PLACE_DECK_ROUTE[i - 1],
      b = CANADA_PLACE_DECK_ROUTE[i],
      count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let j = 0; j <= count; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / count - CANADA_PLACE_ORIGIN[0],
        z = a[1] + ((b[1] - a[1]) * j) / count - CANADA_PLACE_ORIGIN[1];
      const from = new T.Vector3(x, 9.3, z),
        to = new T.Vector3(x, 7.5, z);
      const before = ray(original, from, to),
        after = ray(root, from, to);
      assert.ok(before && after);
      assert.ok(Math.abs(before.point.y - after.point.y) < 1e-7);
    }
  }
});
test("hotel generated batches keep added geometry and CPU buffers bounded", async (t) => {
  const { hotel } = await fixture;
  const buffers = new Set<ArrayBufferLike>();
  let triangles = 0;
  for (const child of hotel.children) {
    assert.ok(child instanceof T.Mesh);
    const g = child.geometry as T.BufferGeometry;
    triangles += (g.index?.count ?? g.getAttribute("position").count) / 3;
    for (const attr of Object.values(g.attributes))
      buffers.add(attr.array.buffer);
    if (g.index) buffers.add(g.index.array.buffer);
  }
  const bytes = [...buffers].reduce((sum, b) => sum + b.byteLength, 0);
  assert.ok(hotel.children.length <= 4);
  assert.ok(triangles < 1500);
  assert.ok(bytes < 160000);
  t.diagnostic(
    `${hotel.children.length} batches, ${triangles} triangles, ${bytes} unique CPU geometry bytes (not GPU/driver memory)`,
  );
});
