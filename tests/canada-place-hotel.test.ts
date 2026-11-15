import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createCanadaPlaceHotelJunction,
  CANADA_PLACE_HOTEL_JUNCTION as q,
  canadaPlaceHotelPoint as at,
} from "../src/world/canada-place-hotel";
import {
  addCanadaPlaceCanopy,
  CANADA_PLACE_CANOPY_LENGTH,
} from "../src/world/canada-place-canopy";
const root = createCanadaPlaceHotelJunction(new Map());
root.updateMatrixWorld(true);
const out = at(0, 0, 1)
    .sub(at(0, 0, 0))
    .normalize(),
  along = at(1, 0, 0)
    .sub(at(0, 0, 0))
    .normalize();
const cast = (from: T.Vector3, d: T.Vector3, max = 5) =>
  new T.Raycaster(from, d.normalize(), 0, max).intersectObject(root, true);
test("all source-band windows have real recess and closed reveals in normal and oblique views", () => {
  const pitch = (q.end - q.start) / q.paneCount;
  for (const i of [0, 7, 17, 26, 33])
    for (const y of [16.2, 18.2]) {
      const s = q.start + (i + 0.5) * pitch,
        target = at(s, y, q.wallOut + q.glassOffset);
      const hits = cast(
        target.clone().addScaledVector(out, 1),
        out.clone().negate(),
      );
      assert.ok(hits.length);
      assert.equal(hits[0].object.name, "canada-hotel-glass");
      assert.ok(Math.abs(hits[0].distance - 1) < 1e-4);
      for (const sign of [-1, 1]) {
        const from = target
          .clone()
          .addScaledVector(out, 1)
          .addScaledVector(along, sign * 0.3);
        const h = cast(from, target.clone().sub(from))[0];
        assert.ok(h);
        assert.equal(h.object.name, "canada-hotel-glass");
      }
      // A sideways ray inside the recess must hit the actual jamb, not escape.
      const cavity = at(s, y, q.wallOut + 0.02);
      const h = cast(cavity, along.clone(), pitch)[0];
      assert.ok(h);
      assert.equal(h.object.name, "canada-hotel-frame");
    }
});
test("both complete face ends are closed and upper soffit is attached with actual relief", () => {
  for (const [s, sign] of [
    [q.start, -1],
    [q.end, 1],
  ])
    for (const y of [14.9, 16.2, 18.2, 19.4]) {
      const target = at(s, y, q.wallOut + 0.03),
        from = target.clone().addScaledVector(along, sign * 0.5);
      const h = cast(from, along.clone().multiplyScalar(-sign), 1)[0];
      assert.ok(h);
      assert.equal(h.object.name, "canada-hotel-stone");
      assert.ok(Math.abs(h.distance - 0.5) < 1e-4);
    }
  const mid = (q.start + q.end) / 2;
  const blade = cast(
    at(mid, 19.7, q.wallOut + 0.18),
    new T.Vector3(0, 1, 0),
    1,
  )[0];
  const gap = cast(
    at(mid, 19.7, q.wallOut + 0.24),
    new T.Vector3(0, 1, 0),
    1,
  )[0];
  assert.ok(blade && gap);
  assert.equal(blade.object.name, "canada-hotel-stone");
  assert.equal(gap.object.name, "canada-hotel-soffit-recess");
  assert.ok(
    gap.distance - blade.distance > 0.03,
    "soffit lines are shallow structural relief, not painted stripes",
  );
});
test("junction stays wholly inboard of accepted canopy and flashing meets existing crown", () => {
  let triangles = 0;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const p = o.geometry.getAttribute("position"),
      n = o.geometry.getAttribute("normal");
    triangles += o.geometry.index!.count / 3;
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(p, i),
        relative = v.clone().sub(at(0, 0, 0));
      assert.ok(Number.isFinite(v.x + v.y + v.z));
      assert.ok(
        relative.dot(out) <= 1e-5,
        "never penetrate convexglassout0..3",
      );
      assert.ok(
        relative.dot(along) >= -1e-4 &&
          relative.dot(along) <= CANADA_PLACE_CANOPY_LENGTH + 1e-4,
      );
      assert.ok(v.y >= q.base - 1e-5 && v.y <= q.top + 1e-5);
      assert.ok(new T.Vector3().fromBufferAttribute(n, i).length() > 0.99);
    }
  });
  assert.ok(triangles < 1800);
  assert.equal(root.children.length, 5);
  const canopyRoot = new T.Group();
  addCanadaPlaceCanopy(canopyRoot, new Map());
  canopyRoot.updateMatrixWorld(true);
  for (const s of [0.1, 10, 26, 40, CANADA_PLACE_CANOPY_LENGTH - 0.1]) {
    const p = at(s, 14.9, -0.07);
    const existing = new T.Raycaster(
      p,
      new T.Vector3(0, -1, 0),
      0,
      0.03,
    ).intersectObject(canopyRoot, true)[0];
    assert.ok(existing, "originalcrownbeam contactsnewinboardflashing");
    assert.ok(existing.distance < 0.015);
  }
});

test("paired hotel panes reveal one continuous closed volume without partitions or a transom floor", () => {
  const mesh = root.children.find(
    (o) => o.name === "canada-hotel-glass",
  ) as T.Mesh;
  assert.ok(Array.isArray(mesh.material));
  assert.equal(mesh.material.length, 2);
  for (const m of mesh.material) {
    assert.equal(m.transparent, true);
    assert.equal(m.depthWrite, false);
  }
  assert.equal(mesh.castShadow, false);
  assert.deepEqual(
    mesh.geometry.groups.map((g) => [g.start, g.count, g.materialIndex]),
    [
      [0, mesh.geometry.index!.count, 0],
      [0, mesh.geometry.index!.count, 1],
    ],
  );
  const pitch = (q.end - q.start) / q.paneCount;
  for (const i of [0, 8, 17, 25, 33])
    for (const y of [16.2, 18.2]) {
      const s = q.start + (i + 0.5) * pitch,
        p = at(s, y, q.wallOut + q.glassOffset);
      for (const direction of [
        out.clone().negate(),
        along.clone(),
        along.clone().negate(),
        new T.Vector3(0, 1, 0),
        new T.Vector3(0, -1, 0),
      ]) {
        const from = p.clone().addScaledVector(out, -0.015);
        const hits = cast(from, direction, 60).filter((h) => h.object !== mesh);
        assert.ok(hits.length);
        assert.equal(hits[0].object.name, "canada-hotel-window-lining");
        if (direction.dot(out) < -0.99)
          assert.ok(
            Math.abs(hits[0].distance - (q.cavityDepth - 0.015)) < 1e-4,
          );
        const horizontal = direction.dot(along);
        const expected =
          horizontal > 0.99
            ? q.end - s
            : horizontal < -0.99
              ? s - q.start
              : direction.y > 0.99
                ? q.glassTop - y
                : direction.y < -0.99
                  ? y - q.glassBottom
                  : q.cavityDepth - 0.015;
        assert.ok(
          Math.abs(hits[0].distance - expected) < 1e-4,
          "only continuous outer ends/floor/ceiling/back close the volume, never a pane partition or mid-transom floor",
        );
      }
    }
});
