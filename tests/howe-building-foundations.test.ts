import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { pointInPoly, type Point } from "../src/world/data";
import { buildHoweBuildingFoundation } from "../src/world/howe-building-foundations";

const ring: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
function assemble(
  footprint = ring,
  ground = (x: number, _z: number) => 1 + x / 4,
  offset = 0,
) {
  const group = new T.Group(),
    batch = new Batcher(group),
    material = new T.MeshStandardMaterial();
  batch.offsetY = offset;
  const result = buildHoweBuildingFoundation(
      batch,
      footprint,
      4,
      ground,
      material,
    ),
    meshes = batch.finish();
  group.updateMatrixWorld(true);
  const ray = (
    origin: [number, number, number],
    direction: [number, number, number],
  ) =>
    new T.Raycaster(
      new T.Vector3(...origin),
      new T.Vector3(...direction),
      0,
      20,
    ).intersectObject(group, true);
  return { result, meshes, ray };
}

test("closed foundation contacts sampled sloping ground, stays inside the footprint and has a bounded cost", () => {
  const { result, meshes, ray } = assemble();
  assert.equal(result.segments, 20);
  assert.equal(result.triangles, 240);
  assert.equal(result.vertices, 480);
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].geometry.index!.count / 3, result.triangles);
  const positions = meshes[0].geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    assert.ok(pointInPoly(positions.getX(i), positions.getZ(i), ring.flat()));
    assert.ok(
      positions.getY(i) >= 0.92 - 1e-6 && positions.getY(i) <= 4.03 + 1e-6,
    );
  }
  for (const t of [0.13, 0.37, 0.79]) {
    const x = 0.025 + 9.95 * t,
      ground = 1 + (10 * t) / 4,
      side = ray([x, ground + 0.03, -1], [0, 0, 1]),
      top = ray([x, 5, 0.065], [0, -1, 0]),
      bottom = ray([x, 0, 0.065], [0, 1, 0]);
    assert.ok(Math.abs(side[0].point.z - 0.025) < 1e-6);
    assert.ok(Math.abs(top[0].point.y - 4.03) < 1e-6);
    // The thin inner/outer miter changes u by <1cm at this cross-section.
    assert.ok(Math.abs(bottom[0].point.y - (ground - 0.08)) < 0.015);
    assert.equal(ray([x, ground - 0.1, -1], [0, 0, 1]).length, 0);
  }
  // FrontSide rays prove inward/outward walls and top/bottom have real faces.
  assert.ok(Math.abs(ray([5, 2.5, 1], [0, 0, -1])[0].point.z - 0.125) < 1e-6);
});

test("world elevations survive nonzero Batcher offsets and clockwise closed rings", () => {
  const a = assemble(),
    b = assemble([...ring].reverse().concat([ring[3]]), undefined, 7.25);
  assert.equal(b.result.segments, a.result.segments);
  const bounds = (mesh: T.Mesh) => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!;
  };
  const ab = bounds(a.meshes[0]),
    bb = bounds(b.meshes[0]);
  assert.ok(ab.min.distanceTo(bb.min) < 1e-6);
  assert.ok(ab.max.distanceTo(bb.max) < 1e-6);
  assert.ok(Math.abs(b.ray([5, 3, -1], [0, 0, 1])[0].point.z - 0.025) < 1e-6);
});

test("re-entrant footprint corners remain within the building and meet without an open corner", () => {
  const lShape: Point[] = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ],
    { meshes, ray } = assemble(lShape, () => 1);
  const p = meshes[0].geometry.attributes.position;
  for (let i = 0; i < p.count; i++)
    assert.ok(pointInPoly(p.getX(i), p.getZ(i), lShape.flat()));
  assert.ok(
    Math.abs(
      ray([4.5, 2, 4.5], [-Math.SQRT1_2, 0, -Math.SQRT1_2])[0].point.x - 3.975,
    ) < 1e-5,
  );
});

test("already supported high edges produce no thin lip; bad input fails before producing NaN geometry", () => {
  const high = assemble(ring, () => 4.2);
  assert.equal(high.result.segments, 0);
  assert.equal(high.result.skippedSegments, 20);
  assert.equal(high.meshes.length, 0);
  const partial = assemble(ring, (x) => 5 - x * 0.4);
  assert.ok(partial.result.segments > 0 && partial.result.skippedSegments > 0);
  assert.equal(
    partial.meshes[0].geometry.index!.count,
    partial.result.segments * 36,
  );
  assert.throws(() => assemble(ring, () => NaN), /finite/);
  assert.throws(
    () =>
      assemble([
        [0, 0],
        [0, 0],
        [1, 1],
      ]),
    /footprint/,
  );
});
