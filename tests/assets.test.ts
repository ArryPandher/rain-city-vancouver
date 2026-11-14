import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { bakeGeometry } from "../src/world/geometry";
test("quantized landmark vertices retain their metre-scale size and translation", () => {
  const source = new T.BufferGeometry();
  source.setAttribute(
    "position",
    new T.BufferAttribute(
      new Int16Array([32767, 0, -32767, 0, 32767, 0]),
      3,
      true,
    ),
  );
  source.setAttribute(
    "normal",
    new T.BufferAttribute(new Int8Array([0, 127, 0, 0, 127, 0]), 3, true),
  );
  const matrix = new T.Matrix4().compose(
    new T.Vector3(35, 4, -12),
    new T.Quaternion(),
    new T.Vector3(150, 80, 250),
  );
  const result = bakeGeometry(source, matrix).getAttribute("position");
  assert.deepEqual(
    [result.getX(0), result.getY(0), result.getZ(0)],
    [185, 4, -262],
  );
  assert.equal(result.getY(1), 84);
  assert.equal(source.getAttribute("position").getX(0), 1);
});
