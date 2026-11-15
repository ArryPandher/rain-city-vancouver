import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { clipCanadaPlacePaths } from "../src/world/canada-place-paths";
import { CANADA_PLACE_PIER } from "../src/world/canada-place-deck";
import { pointInPoly } from "../src/world/data";
import { flatPolygon } from "../src/world/geometry";
test("source pier boundary splits a crossing ribbon and preserves outside UVs and grade", () => {
  const input = flatPolygon([424, -525, 436, -525, 436, -545, 424, -545]);
  const p = input.getAttribute("position");
  const uv: number[] = [];
  for (let i = 0; i < p.count; i++)
    uv.push((p.getX(i) - 424) / 12, (p.getZ(i) + 525) / 20);
  input.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  const output = clipCanadaPlacePaths(
      input,
      (x, z) => x * 0.01 + z * 0.002,
      0.15,
    ),
    q = output.getAttribute("position"),
    t = output.getAttribute("uv");
  assert.ok(q.count > 0);
  let outsideArea = 0;
  for (let i = 0; i < q.count; i += 3) {
    const x = (q.getX(i) + q.getX(i + 1) + q.getX(i + 2)) / 3,
      z = (q.getZ(i) + q.getZ(i + 1) + q.getZ(i + 2)) / 3;
    assert.equal(pointInPoly(x, z, CANADA_PLACE_PIER), false);
    outsideArea +=
      Math.abs(
        (q.getX(i + 1) - q.getX(i)) * (q.getZ(i + 2) - q.getZ(i)) -
          (q.getZ(i + 1) - q.getZ(i)) * (q.getX(i + 2) - q.getX(i)),
      ) / 2;
  }
  assert.ok(
    outsideArea > 12 && outsideArea < 220,
    `partial ribbon retained: ${outsideArea}`,
  );
  for (let i = 0; i < q.count; i++) {
    assert.ok(
      Math.abs(q.getY(i) - (q.getX(i) * 0.01 + q.getZ(i) * 0.002 + 0.15)) <
        1e-5,
    );
    assert.ok(Math.abs(t.getX(i) - (q.getX(i) - 424) / 12) < 1e-5);
    assert.ok(Math.abs(t.getY(i) - (q.getZ(i) + 525) / 20) < 1e-5);
  }
  const mesh = new T.Mesh(
    output,
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  const ray = (z: number) =>
    new T.Raycaster(
      new T.Vector3(430, 20, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(mesh);
  assert.ok(ray(-526).length > 0);
  assert.equal(ray(-541.04).length, 0);
});
test("unrelated path geometry is returned unchanged", () => {
  const g = flatPolygon([0, 0, 1, 0, 1, 1, 0, 1]);
  assert.equal(
    clipCanadaPlacePaths(g, () => 99, 0.2),
    g,
  );
});
