import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  addCanadaPlaceCanopy,
  canadaPlaceCanopyPoint as at,
  CANADA_PLACE_CANOPY_LENGTH as L,
} from "../src/world/canada-place-canopy";

function fixture() {
  const root = new T.Group();
  const meshes = addCanadaPlaceCanopy(root, new Map());
  root.updateMatrixWorld(true);
  return { root, meshes };
}
function hits(root: T.Object3D, from: T.Vector3, to: T.Vector3) {
  return new T.Raycaster(
    from,
    to.clone().sub(from).normalize(),
    0,
    from.distanceTo(to),
  ).intersectObject(root, true);
}

test("conservatory has closed backing across its full length behind transparent panes", () => {
  const { root } = fixture();
  // Independent interior stations avoid frame stations and sample both ends,
  // rather than deriving samples from the model's rib loop.
  for (const u of [0.37, 6.11, 19.17, 34.31, L - 0.41]) {
    for (const y of [9.2, 11.2, 13.2]) {
      const inward = hits(root, at(u, y, 0.8), at(u, y, -0.4));
      assert.ok(inward.length, `back wall gap at ${u}, ${y}`);
      assert.equal(inward[0].object.name, "canada-canopy-lining");
    }
    const floor = hits(root, at(u, 9, 1.1), at(u, 8.5, 1.1));
    assert.ok(floor.length, `floor gap at ${u}`);
    assert.ok(Math.abs(floor[0].point.y - 8.65) < 1e-5);
  }
});

test("rendered frame includes separated interior structure without a second opaque glazing skin", () => {
  const { meshes } = fixture();
  const frame = meshes.find((m) => m.name === "canada-canopy-frame")!;
  assert.ok(frame);
  const innerStations: number[] = [];
  // Shoot outward from the cavity at mid-door height: the old face strips are
  // beyond this ray's end. A hit proves actual deep web faces, not unused verts.
  for (let u = 0.025; u < L; u += 0.05) {
    if (hits(frame, at(u, 9.7, 2.4), at(u, 9.7, 2.9)).length)
      innerStations.push(u);
  }
  assert.ok(
    innerStations.length > 20,
    "substantial inward frame geometry exists",
  );
  assert.ok(
    Math.min(...innerStations) < 1 && Math.max(...innerStations) > L - 1,
    "structural depth reaches both ends, not one calibration bay",
  );
  const glass = meshes.filter((m) => m.name === "canada-canopy-glass");
  assert.equal(
    glass.length,
    3,
    "one curved surface and two closed end surfaces",
  );
  for (const mesh of glass) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    assert.ok(
      materials.every((m) => m.transparent),
      "no opaque duplicate glazing",
    );
    assert.ok(
      materials.every((m) => !m.depthWrite),
      "paired optics do not occlude their backing",
    );
  }
});
