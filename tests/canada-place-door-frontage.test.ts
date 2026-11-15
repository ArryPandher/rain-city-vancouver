import { Batcher } from "../src/world/geometry";
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  addCanadaPlaceDoorFrontage,
  canadaPlaceDoorBays,
} from "../src/world/canada-place-door-frontage";
import {
  CANADA_PLACE_CONCOURSE_STATIONS as stations,
  CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS,
  canadaPlaceConcoursePoint,
} from "../src/world/canada-place-facade";
import { CANADA_PLACE_ORIGIN } from "../src/world/canada-place-deck";
import { pointInPoly, segmentPoint } from "../src/world/data";
function scaleAt(s: number) {
  let i = 1;
  while (i < stations.length - 1 && stations[i].s < s) i++;
  const a = stations[i - 1],
    b = stations[i];
  return a.scale + ((b.scale - a.scale) * (s - a.s)) / (b.s - a.s);
}
const point = (s: number, y: number, o: number) =>
  canadaPlaceConcoursePoint(s, 12.4 * scaleAt(s) + o, y);
function fixture() {
  const root = new T.Group(),
    glass = new T.MeshStandardMaterial({
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
    frame = new T.MeshStandardMaterial();
  const hook = () => {};
  glass.onBeforeCompile = hook;
  glass.customProgramCacheKey = () => "door-test";
  const meshes = addCanadaPlaceDoorFrontage(
    root,
    { glass, frame },
    point,
    stations.map((s) => s.s),
  );
  root.updateMatrixWorld(true);
  return { root, glass, hook, meshes };
}
function ray(mesh: T.Object3D, a: T.Vector3, b: T.Vector3) {
  return new T.Raycaster(
    a,
    b.clone().sub(a).normalize(),
    0,
    a.distanceTo(b) + 0.001,
  ).intersectObject(mesh, true)[0];
}
test("door frontage has bounded three batches, separate calibrated glass and normalized pane UVs", () => {
  const { meshes, glass, hook } = fixture();
  assert.equal(meshes.length, 3);
  const pane = meshes.find((m) => m.name === "canada-west-door-glass")!;
  const material = pane.material as T.MeshStandardMaterial;
  assert.notEqual(material, glass);
  assert.equal(material.onBeforeCompile, hook);
  assert.equal(material.customProgramCacheKey(), "door-test");
  assert.equal(material.transparent, true);
  assert.equal(pane.castShadow, false);
  assert.equal(pane.receiveShadow, true);
  assert.equal(pane.renderOrder, 0);
  const uv = pane.geometry.getAttribute("uv");
  assert.equal(uv.count, pane.geometry.getAttribute("position").count);
  for (const v of uv.array) assert.ok(v >= 0 && v <= 1);
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
      const polygon = CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS[0];
      const x = p.getX(i) + CANADA_PLACE_ORIGIN[0],
        z = p.getZ(i) + CANADA_PLACE_ORIGIN[1];
      let edge = Infinity;
      for (let j = 0; j < polygon.length; j += 2) {
        const k = (j + 2) % polygon.length;
        edge = Math.min(
          edge,
          segmentPoint(
            x,
            z,
            polygon[j],
            polygon[j + 1],
            polygon[k],
            polygon[k + 1],
          ).d,
        );
      }
      assert.ok(
        edge < 0.002 ||
          pointInPoly(
            p.getX(i) + CANADA_PLACE_ORIGIN[0],
            p.getZ(i) + CANADA_PLACE_ORIGIN[1],
            CANADA_PLACE_CONCOURSE_GROUND_FOOTPRINTS[0],
          ),
        "all frontage stays inside existing ground collision envelope",
      );
    }
  }
});
test("every bay has outward-facing recessed glass and closed shallow backing wells", () => {
  const { meshes } = fixture(),
    pane = meshes.find((m) => m.name === "canada-west-door-glass")!,
    well = meshes.find((m) => m.name === "canada-west-door-gasket")!;
  for (const bay of canadaPlaceDoorBays(stations.at(-1)!.s)) {
    const s = bay.l + (bay.r - bay.l) * 0.1;
    for (const y of [9.2, 10.4]) {
      const hit = ray(pane, point(s, y, 0.2), point(s, y, -0.15));
      assert.ok(hit, "pane faces public promenade");
      assert.ok(hit.point.distanceTo(point(s, y, -0.1)) < 0.003);
      const back = ray(well, point(s, y, -0.15), point(s, y, -0.55));
      assert.ok(back, "no see-through unmodeled interior");
      assert.ok(back.point.distanceTo(point(s, y, -0.5)) < 0.003);
    }
    const bottom = ray(well, point(s, 8.2, -0.3), point(s, 7.99, -0.3));
    assert.ok(bottom);
    assert.ok(bottom.face!.normal.y > 0.99);
    const top = ray(well, point(s, 10, -0.3), point(s, 10.1, -0.3));
    assert.ok(top);
    assert.ok(top.face!.normal.y < -0.99);
  }
});

test("static batching preserves calibrated pane material and shadow opt-out", () => {
  const { meshes, hook } = fixture();
  const original = meshes.find((m) => m.name === "canada-west-door-glass")!;
  const material = original.material as T.MeshStandardMaterial;
  const root = new T.Group(),
    batch = new Batcher(root, 400);
  batch.add(original.geometry.clone(), material, 0, 0);
  const [merged] = batch.finish();
  assert.equal(merged.material, material);
  assert.equal(merged.castShadow, false);
  assert.equal(
    merged.userData.allowShadow,
    false,
    "reflection/shadow updates must preserve opt-out",
  );
  assert.equal(merged.receiveShadow, true);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.4);
  assert.equal(material.depthWrite, false);
  assert.equal(material.onBeforeCompile, hook);
  assert.equal(material.customProgramCacheKey(), "door-test");
});
