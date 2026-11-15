import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { buildDetailedCarTemplate } from "../src/world/detailed-car";

// Read actual committed asset geometry/transforms without browser image loading.
async function assetScene(file: string) {
  const doc = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .read(`public/models/${file}.glb`);
  const nodes = doc.getRoot().listNodes(),
    objects = new Map(nodes.map((n) => [n, new T.Group()]));
  for (const n of nodes) {
    const o = objects.get(n)!;
    o.name = n.getName();
    o.matrix.fromArray(n.getMatrix());
    o.matrix.decompose(o.position, o.quaternion, o.scale);
    for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const g = new T.BufferGeometry();
      for (const [semantic, name, size] of [
        ["POSITION", "position", 3],
        ["NORMAL", "normal", 3],
        ["TEXCOORD_0", "uv", 2],
      ] as const) {
        const a = p.getAttribute(semantic);
        if (a) g.setAttribute(name, new T.BufferAttribute(a.getArray()!, size));
      }
      const ix = p.getIndices();
      if (ix) g.setIndex(new T.BufferAttribute(ix.getArray()!, 1));
      const m = new T.MeshStandardMaterial({
        name: p.getMaterial()?.getName(),
      });
      const mesh = new T.Mesh(g, m);
      mesh.name = n.getName();
      o.add(mesh);
    }
    for (const child of n.listChildren()) o.add(objects.get(child)!);
  }
  const root = new T.Group();
  for (const n of doc.getRoot().listScenes()[0].listChildren())
    root.add(objects.get(n)!);
  return root;
}
for (const file of ["car-concept", "car-traffic"])
  test(`${file}: actual tyre axes, ground contact, calipers and rolling radius remain physical`, async () => {
    const raw = await assetScene(file);
    raw.updateMatrixWorld(true);
    const approximate = new T.Box3().setFromObject(raw),
      precise = new T.Box3().setFromObject(raw, true);
    assert.ok(
      precise.min.y - approximate.min.y > 0.15,
      "fixture reproduces inflated rotated AABB",
    );
    const sourceAxle = new T.Vector3(1, 0, 0).transformDirection(
      raw.getObjectByName("WheelFrontL")!.matrixWorld,
    );
    assert.ok(
      Math.abs(sourceAxle.z) > 0.49,
      "fixture has showroom steering baked in",
    );
    const car = buildDetailedCarTemplate(raw, () => new T.Texture());
    car.updateMatrixWorld(true);
    assert.ok(Math.abs(new T.Box3().setFromObject(car, true).min.y) < 0.003);
    assert.equal(car.userData.roadClearance, 0.04);
    const radii: number[] = [],
      widths: number[] = [];
    for (const name of [
      "WheelFrontL",
      "WheelFrontR",
      "WheelRearL",
      "WheelRearR",
    ]) {
      const steer = car.getObjectByName(name)!;
      const spin = car.getObjectByName(name + "Spin")!;
      assert.ok(
        spin.userData.rollingRadius > 0.42 &&
          spin.userData.rollingRadius < 0.44,
      );
      radii.push(spin.userData.rollingRadius);
      const caliper = steer.children.find((o) => /BrakePad/.test(o.name))!;
      assert.ok(caliper, "caliper belongs to steer-only carrier");
      assert.ok(!spin.children.some((o) => /BrakePad/.test(o.name)));
      const tyre = spin.children.find(
        (o) =>
          o instanceof T.Mesh &&
          /Tiretread/.test((o.material as T.Material).name),
      ) as T.Mesh;
      assert.ok(tyre);
      tyre.geometry.computeBoundingBox();
      const local = tyre.geometry.boundingBox!;
      widths.push(local.max.x - local.min.x);
      assert.ok(
        local.max.x - local.min.x < 0.31,
        "neutral tyre lies across the X axle",
      );
      const center = new T.Vector3().setFromMatrixPosition(steer.matrixWorld);
      const caliperMatrix = caliper.matrixWorld.clone();
      for (const angle of [Math.PI / 2, Math.PI, Math.PI * 2]) {
        spin.rotation.x = angle;
        car.updateMatrixWorld(true);
        assert.ok(
          caliper.matrixWorld.equals(caliperMatrix),
          "caliper must not orbit with tyre",
        );
        const p = tyre.geometry.getAttribute("position");
        let bottom = Infinity;
        for (let i = 0; i < p.count; i++) {
          const v = new T.Vector3()
            .fromBufferAttribute(p, i)
            .applyMatrix4(tyre.matrixWorld);
          bottom = Math.min(bottom, v.y);
          assert.ok(
            Math.hypot(v.y - center.y, v.z - center.z) <=
              spin.userData.rollingRadius + 1e-5,
          );
        }
        assert.ok(Math.abs(bottom) < 0.004, "rotating tyre remains grounded");
      }
      steer.rotation.y = 0.35;
      car.updateMatrixWorld(true);
      assert.ok(
        !caliper.matrixWorld.equals(caliperMatrix),
        "caliper follows steering",
      );
    }
    assert.ok(Math.max(...radii) - Math.min(...radii) < 0.0001);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 0.0001);
  });
