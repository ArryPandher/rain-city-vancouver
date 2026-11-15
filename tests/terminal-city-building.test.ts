import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createTerminalCityAssembly } from "../src/world/terminal-city-building";
import {
  TERMINAL_CITY_ID,
  TERMINAL_CITY_RING,
} from "../src/world/terminal-city-site";
import {
  TERMINAL_CITY_CLUB_ID,
  TERMINAL_CITY_CLUB_RING,
} from "../src/world/terminal-city-club";
import { pointInPoly, type Building } from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

for (const clubFirst of [false, true]) {
  test(`Terminal assembly shares materials and capture with ${clubFirst ? "club" : "tower"} first`, () => {
    const root = new T.Group(),
      batch = new Batcher(root);
    let loads = 0;
    const library = {
      texture: () => {
        loads++;
        return new T.Texture();
      },
    } as unknown as Materials;
    const reflections: ReflectionProbeSpec[] = [];
    const build = createTerminalCityAssembly(library, reflections);
    const buildings: Building[] = [
      { id: TERMINAL_CITY_ID, pts: TERMINAL_CITY_RING.flat(), levels: 28 },
      {
        id: TERMINAL_CITY_CLUB_ID,
        pts: TERMINAL_CITY_CLUB_RING.flat(),
        levels: 4,
      },
    ];
    if (clubFirst) buildings.reverse();
    assert.equal(build({ ...buildings[0], id: "w360437747" }, batch), false);
    assert.equal(loads, 0);
    assert.equal(reflections.length, 0);
    const original = structuredClone(buildings);
    for (const building of buildings) {
      batch.offsetY = 7.73;
      assert.equal(build(building, batch), true);
      assert.equal(batch.offsetY, 7.73);
    }
    assert.deepEqual(
      buildings,
      original,
      "source collision records are preserved",
    );
    assert.equal(
      loads,
      3,
      "one color/normal/roughness sampler set for both parcels",
    );
    assert.equal(reflections.length, 1);
    const [x, y, z] = reflections[0].position;
    assert.ok(y > 21.95 && y < 99);
    for (const building of buildings)
      assert.equal(pointInPoly(x, z, building.pts), false);
    const meshes = batch.finish();
    const materials = new Set(meshes.flatMap((mesh) => [mesh.material].flat()));
    assert.equal(materials.size, 6);
    assert.ok(
      [...materials].every((material) =>
        material.name.startsWith("Terminal City —"),
      ),
    );
    assert.ok(
      reflections[0].materials.every((material) => materials.has(material)),
    );
  });
}
