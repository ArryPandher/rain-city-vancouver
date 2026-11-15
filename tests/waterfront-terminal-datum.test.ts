import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import {
  buildWaterfrontCentre,
  type WaterfrontCentreMaterials,
} from "../src/world/waterfront-centre";
import {
  buildTerminalCity,
  type TerminalCityMaterials,
} from "../src/world/terminal-city";
import {
  buildTerminalCityClub,
  TERMINAL_CITY_CLUB_ID,
  TERMINAL_CITY_CLUB_RING,
} from "../src/world/terminal-city-club";
import {
  WATERFRONT_CENTRE_ID,
  WATERFRONT_CENTRE_RING,
} from "../src/world/waterfront-centre-site";
import {
  TERMINAL_CITY_ID,
  TERMINAL_CITY_RING,
} from "../src/world/terminal-city-site";

const materials = Object.fromEntries(
  [
    "glass",
    "stone",
    "spandrel",
    "metal",
    "dark",
    "roof",
    "soil",
    "foliage",
  ].map((name) => [name, new T.MeshStandardMaterial({ name })]),
) as unknown as WaterfrontCentreMaterials & TerminalCityMaterials;
const builders: [string, (batch: Batcher) => boolean][] = [
  [
    "Waterfront Centre",
    (batch) =>
      buildWaterfrontCentre(
        batch,
        { id: WATERFRONT_CENTRE_ID, pts: WATERFRONT_CENTRE_RING.flat() },
        materials,
      ),
  ],
  [
    "Terminal City tower",
    (batch) =>
      buildTerminalCity(
        batch,
        { id: TERMINAL_CITY_ID, pts: TERMINAL_CITY_RING.flat() },
        materials,
      ),
  ],
  [
    "Terminal City club",
    (batch) =>
      buildTerminalCityClub(
        batch,
        { id: TERMINAL_CITY_CLUB_ID, pts: TERMINAL_CITY_CLUB_RING.flat() },
        materials,
      ),
  ],
];

for (const [name, build] of builders)
  test(`${name} applies the building datum exactly once to every component`, () => {
    const assemble = (datum: number) => {
      const group = new T.Group(),
        batch = new Batcher(group);
      batch.offsetY = datum;
      assert.equal(build(batch), true);
      assert.equal(
        batch.offsetY,
        datum,
        "builder does not alter the next parcel datum",
      );
      return batch.finish();
    };
    const flat = assemble(0),
      raised = assemble(7.73);
    assert.equal(raised.length, flat.length);
    for (let j = 0; j < flat.length; j++) {
      const a = flat[j].geometry,
        b = raised[j].geometry,
        ap = a.getAttribute("position"),
        bp = b.getAttribute("position");
      assert.equal(flat[j].material, raised[j].material);
      assert.deepEqual(a.index!.array, b.index!.array);
      assert.equal(ap.count, bp.count);
      for (let i = 0; i < ap.count; i++) {
        assert.equal(ap.getX(i), bp.getX(i));
        assert.equal(ap.getZ(i), bp.getZ(i));
        assert.ok(
          Math.abs(bp.getY(i) - ap.getY(i) - 7.73) < 0.00002,
          `${name} vertex ${i} must be translated, not flattened or doubled`,
        );
      }
      // Three's translate/applyMatrix4 renormalizes float normals even for
      // translation; permit rounding while rejecting any changed orientation.
      const an = a.getAttribute("normal"),
        bn = b.getAttribute("normal");
      for (let i = 0; i < an.count; i++)
        assert.ok(
          Math.hypot(
            an.getX(i) - bn.getX(i),
            an.getY(i) - bn.getY(i),
            an.getZ(i) - bn.getZ(i),
          ) < 1e-6,
        );
      assert.deepEqual(a.getAttribute("uv").array, b.getAttribute("uv").array);
    }
  });
