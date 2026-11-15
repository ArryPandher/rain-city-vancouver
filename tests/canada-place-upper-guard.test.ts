import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  addCanadaPlaceUpperGuard,
  canadaPlaceUpperGuardPath,
} from "../src/world/canada-place-upper-guard";
import { addCanadaPlaceWestFacade } from "../src/world/canada-place-facade";
import data from "../src/world/canada-place-concourse-data.json";
test("guard follows actual roof steps and returns to both source wall ends", () => {
  const path = canadaPlaceUpperGuardPath(),
    a = data.stations[0],
    b = data.stations.at(-1)!;
  assert.deepEqual(path[0], [a.x, a.z]);
  assert.deepEqual(path.at(-1), [b.x, b.z]);
  for (const s of data.upperGlazing) {
    const station = data.stations.find((p) => p.s === s)!;
    for (const k of [17, 25])
      assert.ok(
        path.some(
          (p) =>
            Math.hypot(
              p[0] -
                station.x -
                station.nx * data.profile[k][0] * station.scale,
              p[1] -
                station.z -
                station.nz * data.profile[k][0] * station.scale,
            ) < 1e-8,
        ),
        "transverse step closes raised fascia/curve change",
      );
  }
});
test("coping continuously meets existing roof and closed end cap geometry", () => {
  const root = new T.Group();
  addCanadaPlaceWestFacade(
    root,
    new Map(
      ["concrete", "glass", "trim"].map((name) => [
        name,
        new T.MeshStandardMaterial({ name, side: T.DoubleSide }),
      ]),
    ),
  );
  root.traverse((o) => {
    if (o instanceof T.Mesh) (o.material as T.Material).side = T.DoubleSide;
  });
  root.updateMatrixWorld(true);
  const path = canadaPlaceUpperGuardPath();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const hits = new T.Raycaster(
      new T.Vector3((a[0] + b[0]) / 2, 17.8, (a[1] + b[1]) / 2),
      new T.Vector3(0, -1, 0),
      0,
      0.2,
    ).intersectObject(root, true);
    assert.ok(hits.length, `unsupported upper edge${i}`);
    assert.ok(hits[0].point.y >= 17.649);
  }
});
test("one bounded mesh keeps ground untouched, outward rail geometry and closed coping", () => {
  const root = new T.Group(),
    m = addCanadaPlaceUpperGuard(root),
    p = m.geometry.getAttribute("position"),
    n = m.geometry.getAttribute("normal");
  m.geometry.computeBoundingBox();
  assert.equal(root.children.length, 1);
  assert.ok(m.geometry.getIndex()!.count / 3 < 6000);
  assert.ok(m.geometry.boundingBox!.min.y >= 17.6499);
  assert.ok(Math.abs(m.geometry.boundingBox!.max.y - 18.73) < 1e-5);
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
    assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5);
  }
  assert.ok(m.castShadow && m.receiveShadow);
});
