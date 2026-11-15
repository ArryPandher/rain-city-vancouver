import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createCanadaPlaceFixtureParts,
  addCanadaPlacePromenadeFixtures,
  CANADA_PLACE_FIXTURE_DIMENSIONS as d,
} from "../src/world/canada-place-promenade-fixtures";

test("fixture geometry preserves ground clearance and injected shared artwork", () => {
  const texture = new T.Texture();
  const parts = createCanadaPlaceFixtureParts(() => texture);
  let triangles = 0;
  for (const { geometry, material } of parts) {
    triangles += geometry.index!.count / 3;
    for (const v of geometry.getAttribute("position").array)
      assert.ok(Number.isFinite(v));
    assert.ok(geometry.boundingBox!.min.y >= -1e-6);
    assert.ok(geometry.boundingBox!.max.y <= d.height + 0.002);
    assert.equal((material as T.MeshStandardMaterial).emissive.getHex(), 0);
  }
  const pole = parts[0].geometry.getAttribute("position");
  for (let i = 0; i < pole.count; i++)
    if (pole.getY(i) < 2)
      assert.ok(
        Math.hypot(pole.getX(i), pole.getZ(i)) <= d.lowCollisionRadius + 0.001,
      );
  assert.ok(parts[3].geometry.boundingBox!.min.y >= d.bannerBottom - 1e-5);
  assert.equal((parts[3].material as T.MeshStandardMaterial).map, texture);
  assert.ok(triangles < 6000);
  assert.equal(parts[2].material.userData.castShadow, false);
  parts.forEach((p) => {
    p.geometry.dispose();
    p.material.dispose();
  });
  texture.dispose();
});
test("row shares five instance batches and honours finished deck heights", () => {
  const group = addCanadaPlacePromenadeFixtures(new T.Group(), [
    { x: 10, z: 20, yaw: 0.5, groundY: 7.8 },
    { x: 20, z: 30, yaw: 0.5, groundY: 7.9 },
  ]);
  assert.equal(group.children.length, 5);
  for (const child of group.children) {
    const mesh = child as T.InstancedMesh,
      matrix = new T.Matrix4();
    assert.equal(mesh.count, 2);
    mesh.getMatrixAt(1, matrix);
    assert.ok(
      new T.Vector3()
        .setFromMatrixPosition(matrix)
        .distanceTo(new T.Vector3(20, 7.9, 30)) < 1e-5,
    );
    if (mesh.name === "Canada Place clear globe")
      assert.equal(mesh.castShadow, false);
  }
});

test("seaward banner has readable opposite print faces and joined jogged-pole brackets", () => {
  const parts = createCanadaPlaceFixtureParts(() => new T.Texture());
  const cloth = new T.Mesh(parts[3].geometry, parts[3].material);
  cloth.updateMatrixWorld(true);
  const cast = (mesh: T.Mesh, from: T.Vector3, to: T.Vector3) =>
    new T.Raycaster(
      from,
      to.clone().sub(from).normalize(),
      0,
      from.distanceTo(to),
    ).intersectObject(mesh)[0];
  const front = cast(
    cloth,
    new T.Vector3(0.5, 2.8, -0.3),
    new T.Vector3(-0.3, 2.8, -0.3),
  );
  const back = cast(
    cloth,
    new T.Vector3(-0.3, 2.8, -0.3),
    new T.Vector3(0.5, 2.8, -0.3),
  );
  assert.ok(front && back);
  assert.ok(front.face!.normal.x > 0.9 && back.face!.normal.x < -0.9);
  assert.ok(
    Math.abs(front.uv!.x + back.uv!.x - 1) < 0.001,
    "opposite printed sides reverse texture coordinates",
  );
  assert.ok(front.point.x > back.point.x, "faces are not coplanar");
  const bounds = parts[3].geometry.boundingBox!;
  assert.ok(bounds.max.z < -0.099 && bounds.min.z > -0.951);
  assert.ok(bounds.min.x > 0.08 && bounds.max.x < 0.12);
  const frame = new T.Mesh(parts[0].geometry, parts[0].material);
  frame.updateMatrixWorld(true);
  assert.ok(
    cast(frame, new T.Vector3(0.15, 3.9, 0), new T.Vector3(0.15, 3.7, 0)),
    "upper bracket joins x.20 jogged stem to banner spine",
  );
  assert.ok(
    cast(frame, new T.Vector3(0.05, 2.25, 0), new T.Vector3(0.05, 2.05, 0)),
    "lower bracket joins straight stem",
  );
  assert.ok(
    cast(frame, new T.Vector3(0.1, 3.9, -0.5), new T.Vector3(0.1, 3.7, -0.5)),
    "top bar follows seaward banner edge",
  );
  parts.forEach((p) => {
    p.geometry.dispose();
    p.material.dispose();
  });
});
