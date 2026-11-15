import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import {
  CANADA_MASTS,
  addCanadaPlaceRigging,
  removeCanadaPlaceThinMasts,
} from "../src/world/canada-place-rigging";
test("Canada Place replaces exactly the ten original GLB mast boxes, preserving other steel", async () => {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read("public/models/vancouver/canada-place.glb");
  let removed = 0,
    retained = 0;
  for (const n of doc.getRoot().listNodes())
    for (const primitive of n.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMaterial()?.getName() !== "steel") continue;
      const g = new T.BufferGeometry();
      const accessor = primitive.getAttribute("POSITION")!;
      const raw = new T.BufferAttribute(
        accessor.getArray()!,
        3,
        accessor.getNormalized(),
      );
      const decoded = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        decoded.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      g.setAttribute("position", new T.BufferAttribute(decoded, 3));
      g.setIndex(new T.BufferAttribute(primitive.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(n.getWorldMatrix()));
      removed += removeCanadaPlaceThinMasts(g);
      retained += g.index!.count / 3;
    }
  assert.equal(
    removed,
    120,
    "Ten closed twelve-triangle boxes, no extra pole layer",
  );
  assert.ok(retained > 120, "Promenade rails and other original steel remain");
});
test("replacement rigging is bounded above public routes and connected at all stay endpoints", () => {
  assert.equal(CANADA_MASTS.length, 10);
  const root = new T.Group(),
    meshes = addCanadaPlaceRigging(root);
  root.updateMatrixWorld(true);
  assert.equal(meshes.length, 2);
  let triangles = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (const a of [p, mesh.geometry.getAttribute("normal")])
      assert.ok(Array.from(a.array).every(Number.isFinite));
    for (let i = 0; i < p.count; i++)
      assert.ok(p.getY(i) >= 17.59 && p.getY(i) <= 46.36);
    triangles += mesh.geometry.index!.count / 3;
  }
  assert.ok(triangles < 4000);
  for (const m of CANADA_MASTS) {
    const ray = new T.Raycaster(
      new T.Vector3(m.anchor[0], 20, m.anchor[2]),
      new T.Vector3(0, -1, 0),
      0,
      3,
    );
    const socket = meshes.filter(
      (mesh) =>
        (mesh.material as T.Material).name ===
        "Canada Place painted mast shafts",
    );
    const hit = ray.intersectObjects(socket)[0];
    assert.ok(hit, "Stay has a physical roof socket");
    assert.ok(Math.abs(hit.point.y - m.anchor[1]) < 0.15);
  }
});
