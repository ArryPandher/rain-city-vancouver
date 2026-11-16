import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
import {
  KX,
  ORIGIN,
  pointInPoly,
  segmentPoint,
  type Building,
} from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

for (const clubFirst of [false, true]) {
  test(`Terminal assembly isolates club capture with ${clubFirst ? "club" : "tower"} first`, () => {
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
      const datum = building.id === TERMINAL_CITY_ID ? 7.73 : 6.2;
      batch.offsetY = datum;
      assert.equal(build(building, batch), true);
      assert.equal(batch.offsetY, datum);
      assert.equal(
        reflections.length,
        buildings.indexOf(building) + 1,
        "only a built parcel allocates its probe",
      );
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
    assert.equal(reflections.length, 2);
    const towerProbe = reflections.find(
      (p) => p.name === "Terminal City Hornby exterior",
    )!;
    const clubProbe = reflections.find(
      (p) => p.name === "Terminal City Cordova club exterior",
    )!;
    const [x, y, z] = towerProbe.position;
    assert.equal(
      y,
      7.73 + 45,
      "tower capture keeps its original datum in either parcel order",
    );
    assert.deepEqual([x, z], [309, -399]);
    assert.equal(towerProbe.resolution ?? 128, 128);
    assert.equal(clubProbe.resolution, 256);
    assert.equal(clubProbe.position[1], 6.2 + 9);
    for (const building of buildings)
      assert.equal(pointInPoly(x, z, building.pts), false);
    const meshes = batch.finish();
    root.updateMatrixWorld(true);
    const clubRoof = new T.Raycaster(
      new T.Vector3(393, 50, -414),
      new T.Vector3(0, -1, 0),
      0,
      50,
    ).intersectObject(root, true)[0];
    assert.ok(
      Math.abs(clubRoof.point.y - (6.2 + 21.95)) < 0.001,
      "club keeps its own datum in the shared batch",
    );
    const bounds = new T.Box3().setFromObject(root);
    assert.ok(
      Math.abs(bounds.max.y - (7.73 + 99)) < 0.001,
      "tower datum is applied once regardless of club order",
    );
    const materials = new Set(meshes.flatMap((mesh) => [mesh.material].flat()));
    assert.equal(
      materials.size,
      8,
      "only glass/spandrel split; four finishes stay shared",
    );
    assert.ok(
      [...materials].every((material) =>
        material.name.startsWith("Terminal City —"),
      ),
    );
    assert.ok(
      reflections.every((probe) =>
        probe.materials.every((material) => materials.has(material)),
      ),
    );
    assert.equal(
      new Set(reflections.flatMap((probe) => probe.materials)).size,
      4,
    );
    const towerCapture = new T.CubeTexture(),
      clubCapture = new T.CubeTexture();
    for (const material of towerProbe.materials) material.envMap = towerCapture;
    for (const material of clubProbe.materials) material.envMap = clubCapture;
    assert.ok(
      towerProbe.materials.every(
        (material) => material.envMap === towerCapture,
      ),
    );
    assert.ok(
      clubProbe.materials.every((material) => material.envMap === clubCapture),
    );
    for (const material of clubProbe.materials) material.envMap = null;
    assert.ok(
      towerProbe.materials.every(
        (material) => material.envMap === towerCapture,
      ),
      "invalidating club capture cannot overwrite tower binding",
    );

    const [cx, , cz] = clubProbe.position;
    const a = TERMINAL_CITY_CLUB_RING[1],
      b = TERMINAL_CITY_CLUB_RING[2];
    const foot = segmentPoint(cx, cz, ...a, ...b);
    assert.ok(Math.abs(foot.t - 0.5) < 1e-8);
    assert.ok(
      Math.abs(foot.d - 4.5) < 1e-8,
      "capture is 4.5m in front of registered street face",
    );
    const map = JSON.parse(
      fs.readFileSync("public/data/vancouver.json", "utf8"),
    );
    const ox = (ORIGIN.lon - map.meta.bbox[1]) * KX,
      oz = (map.meta.bbox[2] - ORIGIN.lat) * 110540;
    for (const building of map.buildings as Building[]) {
      const pts = building.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
      assert.equal(
        pointInPoly(cx, cz, pts),
        false,
        `club capture must not sit inside mapped building ${building.id}`,
      );
    }
  });
}
