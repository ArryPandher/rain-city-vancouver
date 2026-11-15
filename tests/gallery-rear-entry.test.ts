import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import data from "../src/world/gallery-rear-entry-data.json";
import { repairGalleryRearEntry } from "../src/world/gallery-rear-entry";
import { geo, ORIGIN, KX, type CityData } from "../src/world/data";
import { CollisionWorld } from "../src/world/collision";
import {
  galleryRearStepHeight,
  GALLERY_REAR_STEPS,
} from "../src/world/gallery-rear-entry";

test("actual quantized gallery repair moves only reviewed rear-entry vertices, preserving fronts, roofs, dome and materials", async () => {
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(data.source))
      .digest("hex"),
    data.sha256,
  );
  await MeshoptDecoder.ready;
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(data.source);
  const meshes: T.Mesh[] = [],
    beforeMeshes: T.Mesh[] = [];
  let moved = 0,
    triangles = 0;
  const origin = geo(49.28287, -123.12046);
  for (const node of doc.getRoot().listNodes())
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const name = primitive.getMaterial()!.getName(),
        a = primitive.getAttribute("POSITION")!,
        raw = new T.BufferAttribute(a.getArray()!, 3, a.getNormalized());
      const p = new Float32Array(raw.count * 3);
      for (let i = 0; i < raw.count; i++)
        p.set([raw.getX(i), raw.getY(i), raw.getZ(i)], i * 3);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setIndex(new T.BufferAttribute(primitive.getIndices()!.getArray()!, 1));
      g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));
      const before = new Float32Array(g.getAttribute("position").array),
        old = g.clone();
      const part = data.materials[name as keyof typeof data.materials];
      const selected = new Set<number>();
      for (const [a, b] of part?.ranges ?? [])
        for (let i = a; i <= b; i++) selected.add(i);
      const originalIndex = [...g.getIndex()!.array];
      moved += repairGalleryRearEntry(g, name);
      triangles += g.getIndex()!.count / 3;
      assert.deepEqual(
        [...g.getIndex()!.array],
        originalIndex,
        "topology and triangle count unchanged",
      );
      const after = g.getAttribute("position");
      if (name === "stone")
        for (const start of [
          12864, 12872, 12888, 12896, 12912, 12920, 12936, 12944, 12960, 12968,
          12984, 12992,
        ])
          for (let id = start; id < start + 4; id++) {
            assert.equal(
              selected.has(id),
              false,
              "core window sill/meeting rail must not travel with entrance",
            );
            assert.equal(after.getX(id), before[id * 3]);
            assert.equal(after.getZ(id), before[id * 3 + 2]);
          }

      for (let i = 0; i < after.count; i++) {
        assert.equal(
          after.getY(i),
          before[i * 3 + 1],
          "all elevations unchanged",
        );
        if (selected.has(i)) {
          assert.ok(
            Math.abs(
              after.getX(i) -
                before[i * 3] +
                Math.sin(data.angle) * data.translationV,
            ) < 1e-5,
          );
          assert.ok(
            Math.abs(
              after.getZ(i) -
                before[i * 3 + 2] -
                Math.cos(data.angle) * data.translationV,
            ) < 1e-5,
          );
        } else
          assert.deepEqual(
            [after.getX(i), after.getY(i), after.getZ(i)],
            [before[i * 3], before[i * 3 + 1], before[i * 3 + 2]],
            "unrelated source vertex unchanged",
          );
      }
      for (const [geometry, list] of [
        [g, meshes],
        [old, beforeMeshes],
      ] as const) {
        geometry.translate(origin[0], 0.08, origin[1]);
        const mesh = new T.Mesh(
          geometry,
          new T.MeshBasicMaterial({ side: T.DoubleSide }),
        );
        mesh.name = name;
        mesh.userData.selected = selected;
        mesh.updateMatrixWorld(true);
        list.push(mesh);
      }
    }
  assert.equal(moved, 882);
  assert.equal(triangles, 25193);
  const point = (x: number, y: number, z: number) =>
    new T.Vector3(
      origin[0] + Math.cos(data.angle) * x - Math.sin(data.angle) * z,
      y + 0.08,
      origin[1] + Math.sin(data.angle) * x + Math.cos(data.angle) * z,
    );
  for (const x of [2.77656, 5.59157]) {
    const a = point(x, 16, 25),
      b = point(x, 16, 22.8);
    assert.equal(
      new T.Raycaster(
        a,
        b.clone().sub(a).normalize(),
        0,
        a.distanceTo(b),
      ).intersectObjects(meshes).length,
      0,
      "native sky-bar region is empty after restoring core rails",
    );
    const c = point(x, 16, 12.1),
      d = point(x, 16, 11.5),
      hit = new T.Raycaster(
        c,
        d.clone().sub(c).normalize(),
        0,
        c.distanceTo(d),
      ).intersectObjects(meshes)[0];
    assert.ok(hit);
    assert.equal(
      hit.object.name,
      "stone",
      "restored rail remains at its source core window",
    );
  }
  const camera = new T.Vector3(-146.56, 3.8, 127.88);
  const target = point(-8.8, 8, 12.7 + data.translationV),
    direction = target.clone().sub(camera).normalize();
  const repaired = new T.Raycaster(camera, direction).intersectObjects(
    meshes,
  )[0];
  assert.equal(
    repaired.object.name,
    "trim",
    "engaged column is visible before its own stone wall",
  );
  assert.ok(repaired.object.userData.selected.has(repaired.face!.a));
  const pedimentTarget = point(-1.9, 15, 12.6 + data.translationV);
  const pedimentHit = new T.Raycaster(
    camera,
    pedimentTarget.clone().sub(camera).normalize(),
  ).intersectObjects(meshes)[0];
  assert.equal(pedimentHit.object.name, "stone");
  assert.ok(
    pedimentHit.object.userData.selected.has(pedimentHit.face!.a),
    "rear pediment presents its own visible face ahead of the main wall",
  );
  const oldTarget = point(-8.8, 8, 12.7),
    oldHit = new T.Raycaster(
      camera,
      oldTarget.clone().sub(camera).normalize(),
    ).intersectObjects(beforeMeshes)[0];
  assert.equal(
    oldHit.object.name,
    "stone",
    "regression: original column was buried behind the wall",
  );
  for (const x of [-8.8, 4.95]) {
    const from = point(x, 3.25, 12.17 + data.translationV);
    const support = new T.Raycaster(
      from,
      new T.Vector3(0, -1, 0),
    ).intersectObjects(meshes.filter((mesh) => mesh.name === "foundation"))[0];
    assert.ok(
      support,
      "column base overlaps the historic foundation footprint",
    );
    assert.ok(
      Math.abs(support.point.y - 3.28) < 0.005,
      "column base is supported at the original3.2m plinth datum",
    );
  }
  const city = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - city.meta.bbox[1]) * KX,
    oz = (city.meta.bbox[2] - ORIGIN.lat) * 110540;
  city.buildings = city.buildings
    .filter((b) => b.id === "w69701736")
    .map((b) => ({
      ...b,
      pts: b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox)),
    }));
  city.roads = [];
  city.areas = [];
  city.ocean = [];
  const collision = new CollisionWorld(city),
    steps = GALLERY_REAR_STEPS;
  for (let i = 0; i < steps.count; i++)
    for (const u of [-6, -1.9, 2]) {
      const p = point(u, 10, steps.startV + (i + 0.5) * steps.tread);
      const hit = new T.Raycaster(p, new T.Vector3(0, -1, 0)).intersectObjects(
        meshes.filter((m) => m.name === "foundation"),
      )[0];
      assert.ok(hit, "each exposed tread has a rendered top");
      assert.ok(
        Math.abs(hit.point.y - collision.groundHeight(p.x, p.z)) < 0.005,
        "actual quantized tread matches collision within5mm",
      );
      assert.equal(
        collision.groundHeight(p.x, p.z),
        galleryRearStepHeight(p.x, p.z),
      );
      if (i >= 2)
        assert.equal(
          collision.blocked(p.x, p.z, 0.2),
          false,
          "outside-facade treads remain open",
        );
    }
  const closed = point(-1.9, 3.28, steps.startV - 0.5);
  assert.equal(
    collision.blocked(closed.x, closed.z, 0.2),
    true,
    "historic facade remains closed",
  );
  const beyond = point(
    -1.9,
    0,
    steps.startV + steps.count * steps.tread + 0.05,
  );
  assert.equal(
    galleryRearStepHeight(beyond.x, beyond.z),
    undefined,
    "support is bounded to actual stair",
  );
  for (const mesh of [...meshes, ...beforeMeshes]) mesh.geometry.dispose();
});
