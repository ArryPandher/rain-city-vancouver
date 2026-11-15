import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import data from "../src/world/canada-place-concourse-data.json";
import {
  addCanadaPlaceHallStructure,
  canadaPlaceHallFramePoint,
  CANADA_PLACE_HALL_FRAME_STATIONS,
  CANADA_PLACE_HALL_PREVIEW_STATION,
  CANADA_PLACE_HALL_RIB_PITCH,
  CANADA_PLACE_HALL_WEB,
} from "../src/world/canada-place-hall-structure";
import { canadaPlaceUpperFasciaAt } from "../src/world/canada-place-concourse-layout";
test("one registered frame has real inward web depth behind existing rebate and outward faces", () => {
  const root = new T.Group(),
    s = CANADA_PLACE_HALL_PREVIEW_STATION,
    mesh = addCanadaPlaceHallStructure(root, {
      frameStations: [s],
      ties: false,
    });
  root.updateMatrixWorld(true);
  const st = data.stations.find((p) => Math.abs(p.s - s) < 1e-8)!;
  assert.ok(st, "preview aligns with an existing regular exterior rib");
  const along = new T.Vector3(-st.nz, 0, st.nx).normalize();
  for (let tier = 0; tier < 2; tier++)
    for (const i of [2, 4, 6]) {
      const point = canadaPlaceHallFramePoint(s, tier, i, 0.2),
        hits = new T.Raycaster(
          point.clone().addScaledVector(along, 0.3),
          along.clone().negate(),
          0,
          0.6,
        ).intersectObject(mesh);
      assert.ok(hits.length);
      assert.ok(
        Math.abs(hits[0].distance - (0.3 - CANADA_PLACE_HALL_WEB.width / 2)) <
          0.01,
        "web exposes75mm side section at200mm inward, not another flat pane card",
      );
      assert.ok(
        canadaPlaceHallFramePoint(s, tier, i, 0).distanceTo(point) > 0.199,
      );
    }
  assert.ok(mesh.geometry.index!.count / 3 < 500);
  assert.equal(root.children.length, 1);
});
test("central repetition follows selected exterior rib rhythm and avoids material-boundary stations", () => {
  assert.equal(CANADA_PLACE_HALL_FRAME_STATIONS.length, 10);
  for (const s of CANADA_PLACE_HALL_FRAME_STATIONS) {
    assert.ok(s > 33 && s < 70);
    assert.ok(
      Math.abs(
        s / (2 * CANADA_PLACE_HALL_RIB_PITCH) -
          Math.round(s / (2 * CANADA_PLACE_HALL_RIB_PITCH)),
      ) < 1e-8,
    );
    assert.ok(data.stations.some((p) => Math.abs(p.s - s) < 1e-8));
  }
  for (const inserted of [33, 43, 65, 70])
    assert.ok(!CANADA_PLACE_HALL_FRAME_STATIONS.includes(inserted));
  const mesh = addCanadaPlaceHallStructure(new T.Group()),
    p = mesh.geometry.getAttribute("position"),
    n = mesh.geometry.getAttribute("normal");
  assert.ok(mesh.geometry.index!.count / 3 < 5000);
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
    assert.ok(Number.isFinite(n.getX(i) + n.getY(i) + n.getZ(i)));
    assert.ok(p.getY(i) >= 10.45 && p.getY(i) <= 17.65);
  }
  assert.ok(mesh.castShadow && mesh.receiveShadow);
  assert.equal((mesh.material as T.MeshStandardMaterial).emissive.getHex(), 0);
});
test("tier-transition longitudinal ties meet frame webs without adding a third tier behind opaque fascia", () => {
  const root = new T.Group(),
    mesh = addCanadaPlaceHallStructure(root);
  root.updateMatrixWorld(true);
  for (const s of CANADA_PLACE_HALL_FRAME_STATIONS) {
    const p = canadaPlaceHallFramePoint(s, 0, 8, 0.26),
      ray = new T.Raycaster(
        p.clone().add(new T.Vector3(0, 0.15, 0)),
        new T.Vector3(0, -1, 0),
        0,
        0.3,
      );
    assert.ok(
      ray.intersectObject(mesh).length,
      "tie touches its transverse web",
    );
    if (canadaPlaceUpperFasciaAt(s)) {
      const p = canadaPlaceHallFramePoint(s, 2, 4, 0.2),
        n = new T.Vector3(0, 1, 0);
      assert.equal(
        new T.Raycaster(
          p.clone().addScaledVector(n, 0.1),
          n.negate(),
          0,
          0.2,
        ).intersectObject(mesh).length,
        0,
        "no blind third curved frame through solid upper fascia",
      );
    }
  }
});
