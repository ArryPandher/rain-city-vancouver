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

test("southern lower return has one opaque skin above deck, with foundation below", () => {
  const { meshes } = fixture();
  const opaque = meshes.filter((mesh) => !Array.isArray(mesh.material));
  for (const [height, material] of [
    [8.31, "canada-canopy-lining"],
    [7.73, "canada-canopy-stone"],
  ] as const) {
    const from = at(L + 0.4, height, 1.27);
    const to = at(L - 0.2, height, 1.27);
    const intersections = new T.Raycaster(
      from,
      to.clone().sub(from).normalize(),
      0,
      from.distanceTo(to),
    ).intersectObjects(opaque);
    assert.equal(
      intersections.length,
      1,
      "no coplanar old-plinth and new-return overlap",
    );
    assert.equal(intersections[0].object.name, material);
  }
});

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
    4,
    "one curved surface, two end surfaces and one separate projecting roof",
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

test("secondary upright planes have physical multi-depth connections, with empty glazing space between", () => {
  const { meshes } = fixture(),
    frame = meshes.find((m) => m.name === "canada-canopy-frame")!;
  const count = Math.ceil(L / 1.35);
  // Secondary stations sampled at opposite ends and middle. These rays hit
  // actual opaque framing well behind the outer glass, not unused vertices.
  for (const j of [2, 18, 34]) {
    const u = (L * j) / count;
    for (const out of [0.28, 1.25]) {
      const h = hits(frame, at(u - 0.2, 11.1, out), at(u + 0.2, 11.1, out));
      assert.ok(h.length, `upright absent at station${j},depth${out}`);
    }
    for (const y of [10.6, 12.4, 14.2]) {
      const h = hits(frame, at(u, y + 0.2, 0.75), at(u, y - 0.2, 0.75));
      assert.ok(h.length, "crossmember joins the two upright planes");
    }
    const foot = hits(frame, at(u, 8.4, 1.25), at(u, 8.8, 1.25));
    assert.ok(
      foot.length && Math.abs(foot[0].point.y - 8.65) < 0.002,
      "upright bears on retained inboard floor",
    );
    const open = hits(frame, at(u - 0.2, 11.5, 1.8), at(u + 0.2, 11.5, 1.8));
    assert.equal(
      open.length,
      0,
      "no fabricated opaque infill or extra outside aisle column",
    );
  }
  // At mid-spacing, rails continue between stations at distinct elevations.
  for (const y of [10.6, 12.4, 14.2]) {
    const h = hits(
      frame,
      at((L * 17) / count, y + 0.2, 1.25),
      at((L * 17) / count, y - 0.2, 1.25),
    );
    assert.ok(
      h.length,
      "secondary plane tied longitudinally into primary frames",
    );
  }
  assert.ok(
    meshes.reduce((n, m) => n + m.geometry.index!.count / 3, 0) < 14000,
  );
});
