import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  CanadaPlaceGlazingDepth,
  type GlazingPoint,
} from "../src/world/canada-place-glazing-depth";
test("only front100mm is pale, deeper return remains covered and adjoining bays deduplicate", () => {
  const depth = new CanadaPlaceGlazingDepth(),
    normal: Array<GlazingPoint> = [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ];
  for (const x of [0, 1])
    depth.addPane(
      [
        [x, 0, 0],
        [x + 1, 0, 0],
        [x + 1, 1, 0],
        [x, 1, 0],
      ],
      normal,
      true,
      true,
    );
  const mesh = depth.finish(new T.Group());
  mesh.updateMatrixWorld(true);
  assert.equal(
    mesh.geometry.index!.count / 3,
    32,
    "two backs and seven shared perimeter walls, each split at the rebate",
  );
  const colors = mesh.geometry.getAttribute("color"),
    positions = mesh.geometry.getAttribute("position"),
    pale = new T.Color(0xa3afa0),
    dark = new T.Color(0x56615c);
  for (const z of [-0.001, -0.05, -0.099, -0.101, -0.25, -0.399]) {
    const hits = new T.Raycaster(
      new T.Vector3(0.5, 0.5, z),
      new T.Vector3(1, 0, 0),
      0,
      1,
    ).intersectObject(mesh);
    assert.ok(hits.length);
    assert.ok(Math.abs(hits[0].point.x - 1) < 1e-7);
    const c = new T.Color().fromBufferAttribute(colors, hits[0].face!.a),
      expected = z > -0.1 ? pale : dark;
    assert.ok(
      Math.abs(c.r - expected.r) +
        Math.abs(c.g - expected.g) +
        Math.abs(c.b - expected.b) <
        1e-6,
    );
  }
  for (let i = 0; i < positions.count; i++) {
    assert.ok(positions.getZ(i) >= -0.400001 && positions.getZ(i) <= 0);
    if (Math.abs(colors.getX(i) - pale.r) < 1e-6)
      assert.ok(
        positions.getZ(i) >= -0.100001,
        "pale vertices cannot extend along the whole cavity",
      );
  }
});
