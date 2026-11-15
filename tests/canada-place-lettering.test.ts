import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  addCanadaPlaceLettering,
  CANADA_PLACE_LETTERING,
  canadaPlaceLetteringMount,
} from "../src/world/canada-place-lettering";
import { addCanadaPlaceWestFacade } from "../src/world/canada-place-facade";
import {
  canadaPlaceUpperFasciaAt,
  canadaPlaceSolidBayAt,
} from "../src/world/canada-place-concourse-layout";
test("separated original extruded words follow real opaque mounting planes, with guard clearance", () => {
  const root = new T.Group(),
    facade = addCanadaPlaceWestFacade(root, new Map()),
    letters = addCanadaPlaceLettering(root);
  root.updateMatrixWorld(true);
  assert.deepEqual(
    CANADA_PLACE_LETTERING.map((w) => w.text),
    ["PLACE", "CANADA"],
  );
  for (const word of CANADA_PLACE_LETTERING)
    for (
      let s = word.center - word.width / 2;
      s <= word.center + word.width / 2;
      s += 0.3
    ) {
      assert.ok(canadaPlaceUpperFasciaAt(s));
      assert.ok(!canadaPlaceSolidBayAt(s));
      const p = canadaPlaceLetteringMount(s, 16.4),
        n = canadaPlaceLetteringMount(s, 16.4, 0.1).sub(p).normalize();
      const hit = new T.Raycaster(p, n.negate(), 0, 0.2).intersectObjects(
        facade,
        true,
      )[0];
      assert.ok(hit);
      assert.equal(hit.object.name, "canada-west-wall");
      assert.ok(hit.distance > 0.04 && hit.distance < 0.085);
    }
  const p = letters.geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
    assert.ok(p.getY(i) > 15.5 && p.getY(i) < 17.4);
  }
  assert.ok(p.count / 3 < 8000);
  // Sample the first P's vertical stroke from the public side, proving that
  // north-to-south reading direction preserves outward front faces.
  const start =
    CANADA_PLACE_LETTERING[0].center + CANADA_PLACE_LETTERING[0].width / 2;
  const target = canadaPlaceLetteringMount(start - 0.12, 16.2, 0.1),
    n = canadaPlaceLetteringMount(start - 0.12, 16.2, 0.2)
      .sub(target)
      .normalize();
  assert.ok(
    new T.Raycaster(
      target.clone().addScaledVector(n, 0.2),
      n.negate(),
      0,
      0.3,
    ).intersectObject(letters).length,
  );
});
