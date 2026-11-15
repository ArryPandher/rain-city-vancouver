import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  centroid,
  pointInPoly,
  type CityData,
  type Point,
} from "../src/world/data";
import controls from "../src/world/howe-ground-controls.json";
import { HOWE_FINISH_OFFSET } from "../src/world/howe-scene-terrain";
import { HOWE_FORECOURT, HOWE_STATION } from "../src/world/howe-station-site";
import { terrainMeshes } from "../src/world/terrain-mesh";
import type { Terrain } from "../src/world/terrain";
import {
  CANADA_PLACE_DECK_Y,
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_ENTRY_CONNECTOR,
  CANADA_PLACE_PIER,
  supportedDeck,
} from "../src/world/canada-place-deck";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { createCanadaPlaceSite } from "../src/world/canada-place-site";

function activeMap(): CityData {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const b of data.buildings) b.pts = convert(b.pts);
  for (const a of data.areas) {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  }
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return data;
}

const data = activeMap(),
  collision = new CollisionWorld(data);
collision.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, true));
assert.ok(
  collision.howeTerrain,
  "actual Canada Place map enables shared terrain",
);
assert.ok(collision.canada);
const terrain = collision.howeTerrain,
  canada = collision.canada;
const ring = (flat: number[]): Point[] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[i * 2],
    flat[i * 2 + 1],
  ]);
// The outer field joins the world that already had Canada Place support. That
// existing raised road must not be mistaken for zero-height legacy terrain.
const prefieldCanada = createCanadaPlaceSite({
  roads: data.roads,
  buildings: data.buildings,
  westernHeight: collision.legacyGroundHeight.bind(collision),
  connectors: [ring(CANADA_PLACE_ENTRY_CONNECTOR)],
  existingDeck: ring(CANADA_PLACE_PIER),
});
const prefieldHeight = (x: number, z: number) =>
  supportedDeck(x, z, 0, canadaPlaceCapabilities(true, true, true))
    ? CANADA_PLACE_DECK_Y
    : (prefieldCanada.baselineHeight(x, z) ??
      collision.legacyGroundHeight(x, z));

function near(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
) {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} vs ${expected}, tolerance ${tolerance}`,
  );
}
function samples(a: Point, b: Point, spacing = 0.5): Point[] {
  const n = Math.max(
    1,
    Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing),
  );
  return Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
}

// Independent source values from Figure 18 and the documented contour/road
// intersections. These are not read from the implementation's finished-y table.
const sourceControls: [string, number, number, number][] = [
  ["canada-howe-framework", 496.277, -492.21, 15.4],
  ["granville-cordova-framework", 518.7, -328, 12.3],
  ["howe-south-of-cordova", 439.926, -395.694, 16],
  ["howe-north-near-pwc", 481.41, -447.094, 16],
  ["cordova-west-42m", 416.043, -431.408, 16],
  ["cordova-west-127m", 346.309, -479.703, 17],
  ["cordova-west-159m", 318.841, -496.252, 15],
  ["cordova-west-175m", 305.039, -504.269, 14],
  ["cordova-east-60m", 480.131, -357.633, 15],
  ["cordova-east-83m", 496.629, -341.21, 14],
  ["cordova-east-160m", 558.673, -288.871, 14],
  ["howe-south-46m", 411.298, -366.225, 17],
  ["howe-south-57m", 403.322, -358.187, 18],
  ["howe-south-75m", 390.667, -345.437, 19],
];

test("published elevation controls use one finished conversion, then one baseline subtraction", () => {
  assert.equal(controls.finishedDatumOffset, -7.52);
  assert.equal(HOWE_FINISH_OFFSET, 0.15);
  for (const [id, x, z, h] of sourceControls) {
    const stored = controls.controls.find((c) => c.id === id);
    assert.ok(stored, id);
    near(stored.point[0], x, 0.000001, `${id} registered x`);
    near(stored.point[1], z, 0.000001, `${id} registered z`);
    near(stored.point[2], h - 7.52, 1e-10, `${id} finished conversion`);
    // The 2002 contours allow a half-metre source/fit tolerance. Requiring exact
    // equality to every jagged contour would misrepresent the documented source.
    near(terrain.height(x, z) + 0.15, h - 7.52, 0.5, `${id} sampled finish`);
  }
  near(
    collision.baselineGroundHeight(443.72382, -400.02215),
    8.33,
    0.15,
    "Howe/Cordova is raised with the neighborhood instead of retaining zero",
  );
});

test("Canada's fixed deck and full western road tie survive the new field", () => {
  const junction: Point = [496.277, -492.21];
  near(terrain.height(...junction), 7.73, 0.002, "Canada/Howe baseline");
  for (const q of CANADA_PLACE_DECK_ROUTE)
    near(collision.groundHeight(...q), CANADA_PLACE_DECK_Y, 1e-9, "fixed deck");
  const end = canada.waterfrontPath.at(-1)!,
    previous = canada.waterfrontPath.at(-2)!,
    dx = end[0] - previous[0],
    dz = end[1] - previous[1],
    length = Math.hypot(dx, dz);
  for (let side = -8; side <= 8; side += 0.25) {
    const x = end[0] + (side * dz) / length,
      z = end[1] - (side * dx) / length;
    near(
      collision.baselineGroundHeight(x, z),
      collision.legacyGroundHeight(x, z),
      0.02,
      `western full-width tie ${x},${z}`,
    );
  }
});

test("bounded scene edges join legacy ground without a new vertical step", () => {
  const { minX, minZ } = terrain.meta,
    { maxX, maxZ } = terrain;
  const edges: [Point, Point, Point][] = [
    [
      [minX, minZ],
      [maxX, minZ],
      [0, -0.001],
    ],
    [
      [minX, maxZ],
      [maxX, maxZ],
      [0, 0.001],
    ],
    [
      [minX, minZ],
      [minX, maxZ],
      [-0.001, 0],
    ],
    [
      [maxX, minZ],
      [maxX, maxZ],
      [0.001, 0],
    ],
  ];
  let worst = { error: 0, x: 0, z: 0, actual: 0, expected: 0 };
  for (const [a, b, outside] of edges)
    for (const [x, z] of samples(a, b, 1)) {
      const actual = collision.baselineGroundHeight(x, z),
        expected = prefieldHeight(x, z),
        error = Math.abs(actual - expected);
      if (error > worst.error) worst = { error, x, z, actual, expected };
      near(
        collision.baselineGroundHeight(x + outside[0], z + outside[1]),
        prefieldHeight(x + outside[0], z + outside[1]),
        1e-9,
        `outside retains prefield support ${x},${z}`,
      );
      near(
        collision.baselineGroundHeight(x - outside[0], z - outside[1]) -
          collision.baselineGroundHeight(x + outside[0], z + outside[1]),
        prefieldHeight(x - outside[0], z - outside[1]) -
          prefieldHeight(x + outside[0], z + outside[1]),
        0.02,
        `no new physical step across boundary ${x},${z}; prefield=${prefieldHeight(x, z)}; ocean=${data.ocean.some((p) => pointInPoly(x, z, p))}; water=${collision.water(x, z, prefieldHeight(x, z) + 0.15)}`,
      );
    }
  near(
    worst.actual,
    worst.expected,
    0.02,
    `worst legacy boundary ${worst.x},${worst.z}`,
  );
});

function nestedDetails(
  parent: Terrain,
): { parent: Terrain; detail: Terrain }[] {
  return parent.details.flatMap((detail) => [
    { parent, detail },
    ...nestedDetails(detail),
  ]);
}

function detailEdges(detail: Terrain): [Point, Point, Point][] {
  const { minX, minZ } = detail.meta,
    { maxX, maxZ } = detail;
  return [
    [
      [minX, minZ],
      [maxX, minZ],
      [0, 1],
    ],
    [
      [minX, maxZ],
      [maxX, maxZ],
      [0, -1],
    ],
    [
      [minX, minZ],
      [minX, maxZ],
      [1, 0],
    ],
    [
      [maxX, minZ],
      [maxX, maxZ],
      [-1, 0],
    ],
  ];
}

test("station and every nested refinement join their parent grid without cracks", () => {
  const station = terrain.details.find((grid) =>
    grid.contains(...HOWE_STATION.origin),
  );
  assert.ok(station, "station landing is covered by an explicit refinement");
  assert.equal(station.meta.step, 1);
  const refinements = nestedDetails(terrain);
  assert.ok(
    refinements.some(({ parent }) => parent !== terrain),
    "exercise the actual nested corner patches, not just top-level grids",
  );
  let seamSamples = 0;
  for (const { parent, detail } of refinements) {
    const label = `${detail.meta.step}m child at ${detail.meta.minX},${detail.meta.minZ}`;
    assert.ok(
      detail.meta.step < parent.meta.step,
      `${label} actually refines its parent`,
    );
    assert.ok(
      parent.contains(detail.meta.minX, detail.meta.minZ) &&
        parent.contains(detail.maxX, detail.maxZ),
      `${label} stays in parent bounds`,
    );
    for (const sibling of parent.details) {
      if (sibling === detail) continue;
      const width =
          Math.min(detail.maxX, sibling.maxX) -
          Math.max(detail.meta.minX, sibling.meta.minX),
        depth =
          Math.min(detail.maxZ, sibling.maxZ) -
          Math.max(detail.meta.minZ, sibling.meta.minZ);
      assert.ok(
        width <= 0 || depth <= 0,
        `${label} must not overlap a sibling rendered/collision grid`,
      );
    }
    for (const [a, b, inward] of detailEdges(detail)) {
      // The west strip deliberately fits the old analytic world at the outer
      // domain. Those sides are covered by the two-sided physical boundary test;
      // they do not join another coarse cell and need not copy coarse samples.
      const outerEdge =
        (a[0] === b[0] && [terrain.meta.minX, terrain.maxX].includes(a[0])) ||
        (a[1] === b[1] && [terrain.meta.minZ, terrain.maxZ].includes(a[1]));
      if (outerEdge) continue;
      for (const [x, z] of samples(
        a,
        b,
        Math.min(0.25, detail.meta.step / 2),
      )) {
        near(
          detail.height(x, z),
          parent.baseHeight(x, z),
          0.0011,
          `${label} shared parent edge ${x},${z}`,
        );
        // Measure C0 continuity independently of possibly steep retained slopes.
        const epsilon = 1e-6;
        near(
          terrain.height(x + inward[0] * epsilon, z + inward[1] * epsilon),
          terrain.height(x - inward[0] * epsilon, z - inward[1] * epsilon),
          0.002,
          `${label} two-sided edge ${x},${z}`,
        );
        seamSamples++;
      }
    }
  }
  assert.ok(seamSamples > 1000, `${seamSamples} actual nested seam samples`);
});

test("station front landing uses its world finish and preserves the excavated cutout", () => {
  assert.equal(HOWE_STATION.landingHeight, 8.08);
  for (const v of [-1.2, 0, 1.2])
    for (const u of [-0.5, 0.5, 1.8]) {
      const [x, , z] = HOWE_STATION.p(v, 0, u);
      near(terrain.height(x, z), 7.93, 0.015, `station baseline v${v}/u${u}`);
      near(
        collision.walkingHeight(x, z, 8.08),
        8.08,
        0.025,
        `station finished walking contact v${v}/u${u}`,
      );
    }
  const [x, , z] = HOWE_STATION.p(0, 0, HOWE_STATION.stairStart + 1.3);
  assert.equal(
    canada.contains(x, z),
    false,
    "paving cannot fill the descending stairs",
  );
  assert.ok(
    collision.howeTerrainCutouts.some((ring) => pointInPoly(x, z, ring)),
    "shared terrain also excludes the stairwell",
  );
});

test("mapped forecourt is supported beside the wing instead of a zero-height trench", () => {
  let checked = 0;
  for (let x = 467; x <= 516; x += 1.7)
    for (let z = -460; z <= -413; z += 1.7) {
      if (
        !pointInPoly(x, z, HOWE_FORECOURT.flat()) ||
        pointInPoly(x, z, HOWE_STATION.footprint.flat()) ||
        data.buildings.some((b) => pointInPoly(x, z, b.pts))
      )
        continue;
      const baseline = collision.baselineGroundHeight(x, z);
      assert.ok(
        baseline > 7.1 && baseline < 8.6,
        `source-guided forecourt baseline ${x},${z}: ${baseline}`,
      );
      near(
        baseline,
        terrain.height(x, z),
        0.02,
        `forecourt support and field agree ${x},${z}`,
      );
      checked++;
    }
  assert.ok(
    checked > 80,
    `meaningful open forecourt coverage: ${checked} samples`,
  );
});

test("VCC deck and protected southern approach keep their original contact surface", () => {
  assert.ok(collision.convention);
  let approachSamples = 0;
  // Stay strictly inside for bit-level preservation; exact polygon corners can
  // round to the other side after local/world conversion. A separate seam test
  // below covers the whole boundary with a physical 2cm tolerance.
  for (let e = 150.125; e < 214; e += 2)
    for (let n = -77.875; n < -27; n += 1.5) {
      const [x, z] = collision.convention.world(e, n);
      near(
        collision.existingGroundHeight(x, z),
        collision.legacyGroundHeight(x, z),
        1e-8,
        `protected VCC approach ${e},${n}`,
      );
      near(
        collision.baselineGroundHeight(x, z),
        collision.legacyGroundHeight(x, z),
        1e-8,
        `Canada support must not override VCC ${e},${n}`,
      );
      approachSamples++;
    }
  for (const [e, n] of [
    [175, -20],
    [190, 0],
    [100, 50],
  ] as Point[]) {
    const [x, z] = collision.convention.world(e, n);
    near(
      collision.groundHeight(x, z),
      collision.legacyGroundHeight(x, z),
      1e-8,
      `protected VCC deck ${e},${n}`,
    );
  }
  assert.ok(approachSamples > 1000);
});

test("rendered shared terrain meets the protected VCC cutout without a height gap", () => {
  assert.ok(collision.convention);
  const ring: Point[] = [
    [150, -78],
    [214, -78],
    [214, -27],
    [150, -27],
  ];
  let worst = { error: 0, e: 0, n: 0, actual: 0, expected: 0 },
    checked = 0;
  for (let i = 0; i < ring.length; i++)
    for (const [e, n] of samples(ring[i], ring[(i + 1) % ring.length], 0.25)) {
      const [x, z] = collision.convention.world(e, n);
      // The platform and approach are unioned cutouts. A box edge buried inside
      // the platform is not an exposed terrain seam and has no rendered face.
      if (
        !terrain.contains(x, z) ||
        pointInPoly(x, z, collision.convention.platformWorld)
      )
        continue;
      const actual = terrain.height(x, z),
        // Independent pre-existing VCC approach equation in its local frame.
        // At n=-27 an inverse world transform can produce -26.99999999999999,
        // making the masked legacy sampler return zero despite the real ramp.
        expected =
          6.04 *
          Math.max(0, Math.min(1, (n + 78) / 49)) *
          Math.max(0, Math.min(1, (e - 150) / 13, (214 - e) / 17)),
        error = Math.abs(actual - expected);
      if (error > worst.error) worst = { error, e, n, actual, expected };
      checked++;
    }
  assert.ok(checked > 100);
  const world = collision.convention.world(worst.e, worst.n);
  near(
    worst.actual,
    worst.expected,
    0.02,
    `VCC cutout seam at ${worst.e},${worst.n} / ${world}; prefieldCanada=${prefieldCanada.baselineHeight(
      ...world,
    )}; ocean=${data.ocean.some((p) => pointInPoly(...world, p))}; water=${collision.water(...world, worst.expected + 0.15)}`,
  );
});

test("focus building bases and surrounding road baselines share the same field", () => {
  for (const id of ["w363651936", "w138256216", "w208599553"]) {
    const b = data.buildings.find((building) => building.id === id);
    assert.ok(b, id);
    const q = centroid(b.pts),
      baseline = collision.groundHeight(...q);
    assert.ok(
      baseline > 7.5 && baseline < 8.5,
      `${id} raised base ${baseline}`,
    );
    near(baseline, terrain.height(...q), 1e-8, `${id} authored building datum`);
  }
  for (const id of ["w232195213", "w1255990033", "w1153403243", "w340383391"]) {
    const road = data.roads.find((r) => r.id === id);
    assert.ok(road, id);
    for (let i = 0; i < road.pts.length - 2; i += 2)
      for (const [x, z] of samples(
        [road.pts[i], road.pts[i + 1]],
        [road.pts[i + 2], road.pts[i + 3]],
        1,
      )) {
        near(
          collision.roadHeight(road, x, z),
          terrain.height(x, z),
          1e-8,
          `${id} road baseline ${x},${z}`,
        );
        near(
          collision.baselineGroundHeight(x, z),
          terrain.height(x, z),
          1e-8,
          `${id} support baseline ${x},${z}`,
        );
      }
  }
});

test("rendered detail/coarse ground matches physics and leaves the station excavation open", () => {
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide }),
    meshes = terrainMeshes(
      terrain,
      [],
      material,
      data.ocean,
      collision.howeTerrainCutouts,
    ),
    group = new T.Group();
  group.add(...meshes);
  group.updateMatrixWorld(true);
  const ray = (x: number, z: number) =>
    new T.Raycaster(
      new T.Vector3(x, 30, z),
      new T.Vector3(0, -1, 0),
      0,
      40,
    ).intersectObject(group, true);
  for (const [x, z] of [
    [464.01, -432.31],
    [463.99, -432.31],
    [495.99, -436.23],
    [496.01, -436.23],
    [484.23, -440.01],
    [484.23, -439.99],
    [487.37, -408.01],
    [487.37, -407.99],
    [487.1, -437.3],
    [500.1, -449.3],
  ] as Point[]) {
    const hits = ray(x, z);
    assert.ok(hits.length, `rendered support at ${x},${z}`);
    near(
      hits[0].point.y + 0.012,
      terrain.height(x, z),
      0.0002,
      `same rendered triangle/physics interpolation at ${x},${z}`,
    );
  }
  const [x, , z] = HOWE_STATION.p(0, 0, HOWE_STATION.stairStart + 1.3);
  assert.equal(
    ray(x, z).length,
    0,
    "terrain has no cap across the station cutout",
  );
  for (const mesh of meshes) mesh.geometry.dispose();
  material.dispose();
});

// Native review found a coplanar approach sheet crossing the pavilion landing.
// Surface ownership must cover the whole floor, not only the stair opening.
test("station owns the landing surface without a second approach sheet", () => {
  for (const v of [-1.2, 0, 1.2])
    for (const u of [0.3, 1, 2]) {
      const [x, , z] = HOWE_STATION.p(v, 0, u);
      assert.equal(
        canada.contains(x, z),
        false,
        "approach paving must stop at the pavilion floor",
      );
      assert.ok(
        collision.howeTerrainCutouts.some((ring) => pointInPoly(x, z, ring)),
      );
      near(
        collision.walkingHeight(x, z),
        HOWE_STATION.landingHeight,
        1e-9,
        "modeled landing contact",
      );
    }
});
