import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import data from "../src/world/canada-place-concourse-data.json";
import {
  addCanadaPlaceWestFacade,
  canadaPlaceConcoursePoint,
} from "../src/world/canada-place-facade";
import {
  CANADA_PLACE_ORIGIN,
  supportedDeck,
  solidAt,
} from "../src/world/canada-place-deck";
import { CANADA_PLACE_ROUND_OPENING } from "../src/world/canada-place-solid-bays";
const root = new T.Group(),
  meshes = addCanadaPlaceWestFacade(root, new Map());
root.updateMatrixWorld(true);
const wall = meshes.find((m) => m.name === "canada-west-solid-bays")!;
function normal(s: number) {
  return canadaPlaceConcoursePoint(s, data.solidBayOutward + 0.1, 12)
    .sub(canadaPlaceConcoursePoint(s, data.solidBayOutward, 12))
    .normalize();
}
function ray(s: number, y: number) {
  const p = canadaPlaceConcoursePoint(s, data.solidBayOutward, y),
    n = normal(s);
  return new T.Raycaster(p.clone().add(n), n.negate(), 0, 2).intersectObject(
    root,
    true,
  );
}
test("registered opaque bays replace all glazing/doors and round openings have recessed closed infill", () => {
  for (const [a, b] of data.solidBays) {
    const mid = (a + b) / 2;
    for (const y of [8.8, 11.7, 17.2]) {
      const hits = ray(mid + 0.5, y);
      assert.ok(hits.length);
      assert.equal(hits[0].object, wall);
      assert.ok(
        Math.abs(hits[0].distance - 1) < 0.025,
        `wall ${mid} ${y}: ${hits[0].distance}`,
      );
    }
    const hits = ray(mid + 0.4, CANADA_PLACE_ROUND_OPENING.centerY + 0.4);
    assert.ok(hits.length);
    assert.equal(hits[0].object.name, "canada-west-round-infill");
    assert.ok(hits[0].distance > 1.25 && hits[0].distance < 1.32);
    for (const name of ["canada-west-glass", "canada-west-door-glass"]) {
      const mesh = meshes.find((m) => m.name === name)!;
      const p = canadaPlaceConcoursePoint(mid, 15, 10);
      assert.equal(
        new T.Raycaster(p, normal(mid).negate(), 0, 8).intersectObject(mesh)
          .length,
        0,
      );
    }
  }
});
test("visible recessed ground plane matches collision and leaves no old door-plane barrier", () => {
  for (const [a, b] of data.solidBays) {
    const s = (a + b) / 2,
      p = canadaPlaceConcoursePoint(s, 11.3, 7.88),
      x = p.x + CANADA_PLACE_ORIGIN[0],
      z = p.z + CANADA_PLACE_ORIGIN[1];
    assert.equal(solidAt(x, z, 0.36), false);
    assert.equal(supportedDeck(x, z, 0.36), true);
    const q = canadaPlaceConcoursePoint(s, 9.8, 7.88);
    assert.equal(
      solidAt(q.x + CANADA_PLACE_ORIGIN[0], q.z + CANADA_PLACE_ORIGIN[1], 0.36),
      true,
    );
  }
});
test("opaque boundary returns are closed between recessed plane and projecting adjacent frontage", () => {
  for (const [a, b] of data.solidBays)
    for (const boundary of [a, b]) {
      const inward = boundary === a ? 1 : -1;
      const frame = meshes.find(
        (m) => m.name === "canada-west-pale-upper-frame",
      )!;
      // Curved end ribs must meet rail endpoints and remain on the glass-side
      // section. Mid-segment rays avoid mistaking a horizontal rail for the rib.
      const glassSide = boundary - inward * 0.001;
      const fascia = data.upperFasciaRanges.some(
        ([l, r]) => glassSide >= l && glassSide <= r,
      );
      for (const k of fascia ? [3, 7, 11, 15] : [3, 7, 11, 15, 19, 23]) {
        const lo = data.profile[k - 1],
          hi = data.profile[k],
          out = (lo[0] + hi[0]) / 2,
          y = (lo[1] + hi[1]) / 2;
        const target = canadaPlaceConcoursePoint(boundary, out, y),
          n = normal(boundary).multiplyScalar(hi[1] - lo[1]);
        n.y = lo[0] - hi[0];
        n.normalize();
        const hit = new T.Raycaster(
          target.clone().addScaledVector(n, 0.25),
          n.negate(),
          0,
          0.4,
        ).intersectObject(frame)[0];
        assert.ok(
          hit,
          `missing curved glass-side end rib at${boundary}/segment${k}`,
        );
        assert.ok(
          hit.point.distanceTo(target) < 0.085,
          "100mm rib stays around source profile",
        );
      }
      for (const [out, y] of [
        [11.4, 9],
        [12.5, 11.5],
        [10.5, 13.8],
      ]) {
        const p = canadaPlaceConcoursePoint(boundary + inward * 0.25, out, y),
          q = canadaPlaceConcoursePoint(boundary - inward * 0.25, out, y),
          ray = new T.Raycaster(p, q.clone().sub(p).normalize(), 0, 0.7);
        const hit = ray.intersectObject(root, true)[0];
        assert.ok(hit, `return${boundary} at${out}/${y}`);
        assert.equal(hit.object.name, "canada-west-wall");
      }
    }
});
