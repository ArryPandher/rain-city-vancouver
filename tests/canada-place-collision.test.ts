import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { summonedVehicleSpot } from "../src/game/vehicle-placement";
import {
  CANADA_PLACE_GROUND_STAYS,
  GROUND_STAY_ORIGIN,
} from "../src/world/canada-place-ground-stays-data";
import concourse from "../src/world/canada-place-concourse-data.json";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  centroid,
  segmentPoint,
  type CityData,
  type Point,
} from "../src/world/data";
import {
  CANADA_PLACE_DECK_ROUTE,
  CANADA_PLACE_DECK_Y,
  CANADA_PLACE_SOLID_MASSES,
  canadaPlaceGroundStayAt,
  supportedDeck,
  solidAt,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_HOWE_IDS,
  CANADA_PLACE_WATERFRONT_IDS,
  CANADA_PLACE_SERVICE_IDS,
} from "../src/world/canada-place-site";
function loadCity() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return data;
}
const data = loadCity(),
  collision = new CollisionWorld(data);
collision.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, true));
test("summoning beside the north anchor clears the whole car, not only its centre", () => {
  const origin = { x: 637.89, z: -673.94, heading: -1.076, y: 7.88 };
  assert.equal(collision.blocked(origin.x, origin.z, 1.3, origin.y), false);
  assert.ok(
    [-1, 1].some((sign) =>
      collision.blocked(
        origin.x + Math.sin(origin.heading) * 1.35 * sign,
        origin.z + Math.cos(origin.heading) * 1.35 * sign,
        0.9,
        origin.y,
      ),
    ),
    "reproduce native gameplay: a clear centre with a trapped nose or tail",
  );
  const spot = summonedVehicleSpot(collision, origin, "car", []);
  assert.ok(spot);
  let position = { x: spot[0], z: spot[1] };
  for (let step = 0; step < 30; step++) {
    const next = collision.move(
      position.x,
      position.z,
      Math.sin(origin.heading) * 0.1,
      Math.cos(origin.heading) * 0.1,
      1.16,
      origin.y,
    );
    assert.equal(
      next.hit,
      false,
      "the summoned car can depart under ordinary throttle",
    );
    for (const sign of [-1, 1])
      assert.equal(
        collision.blocked(
          next.x + Math.sin(origin.heading) * 1.35 * sign,
          next.z + Math.cos(origin.heading) * 1.35 * sign,
          0.9,
          origin.y,
        ),
        false,
      );
    position = next;
  }
  for (const [along, radius] of [
    [0, 1.16],
    [-1.35, 0.9],
    [1.35, 0.9],
  ]) {
    const x: number = spot[0] + Math.sin(origin.heading) * along;
    const z: number = spot[1] + Math.cos(origin.heading) * along;
    assert.equal(collision.blocked(x, z, radius, origin.y), false);
    assert.equal(collision.water(x, z, origin.y), false);
    assert.ok(Math.abs(collision.height(x, z, origin.y) - origin.y) < 0.6);
  }
});
test("unresolved service ribbons retain their prior datum without false steep ramps", () => {
  for (const id of CANADA_PLACE_SERVICE_IDS) {
    const road = data.roads.find((r) => r.id === id)!;
    assert.ok(road, id);
    for (const [x, z] of samples(flatPoints(road.pts)))
      assert.equal(
        collision.roadHeight(road, x, z),
        collision.existingGroundHeight(x, z),
      );
  }
});
const flatPoints = (p: number[]): Point[] =>
  Array.from({ length: p.length / 2 }, (_, i) => [p[2 * i], p[2 * i + 1]]);
function samples(path: Point[], spacing = 0.25) {
  return path.flatMap((a, i) => {
    if (!i) return [a];
    const b = path[i - 1],
      n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / spacing);
    return Array.from(
      { length: n },
      (_, j): Point => [
        b[0] + ((a[0] - b[0]) * (j + 1)) / n,
        b[1] + ((a[1] - b[1]) * (j + 1)) / n,
      ],
    );
  });
}
const location = (x: number, z: number, h: number) =>
  `(${x.toFixed(3)},${h.toFixed(3)},${z.toFixed(3)})`;
test("ordinary Howe arrival reaches the Canadian Trail with continuous supported foot clearance", () => {
  const route: Point[] = [];
  for (const id of [...CANADA_PLACE_HOWE_IDS, CANADA_PLACE_WATERFRONT_IDS[0]]) {
    const p = flatPoints(data.roads.find((r) => r.id === id)!.pts);
    route.push(...(route.length ? p.slice(1) : p));
  }
  route.push([430, -531], [430, -541.04], ...CANADA_PLACE_DECK_ROUTE);
  let previousHeight = 0,
    previous: Point | undefined;
  for (const [x, z] of samples(route)) {
    const h = collision.groundHeight(x, z),
      label = location(x, z, h);
    assert.ok(Number.isFinite(h), `nonfinite ground at ${label}`);
    assert.equal(
      collision.blocked(x, z, 0.36, h + 0.15),
      false,
      `blocked public route at ${label}`,
    );
    assert.equal(
      collision.water(x, z, h + 0.15),
      false,
      `water on supported route at ${label}`,
    );
    if (previous) {
      const distance = Math.hypot(x - previous[0], z - previous[1]);
      // Existing finish offsets allow a small curb/deck change, not a vertical lift.
      assert.ok(
        Math.abs(h - previousHeight) <= distance * 0.12 + 0.16,
        `unsupported height step at ${label}: previous ${previousHeight}`,
      );
    }
    previous = [x, z];
    previousHeight = h;
  }
  assert.ok(Math.abs(previousHeight - CANADA_PLACE_DECK_Y) < 1e-6);
});
test("deck clearance does not open the solid lower pier or enclosed landmark masses", () => {
  const [x, z] = CANADA_PLACE_DECK_ROUTE[3];
  assert.equal(
    collision.blocked(x, z, 0.36, 0),
    true,
    "same public-deck point remains solid below the pier",
  );
  assert.equal(collision.blocked(x, z, 0.36, CANADA_PLACE_DECK_Y), false);
  for (const p of CANADA_PLACE_SOLID_MASSES) {
    const q = centroid(p);
    assert.equal(
      collision.blocked(...q, 0.36, CANADA_PLACE_DECK_Y),
      true,
      `enclosed mass opened at ${q}`,
    );
  }
  assert.equal(
    collision.water(1000, -1000, 0),
    true,
    "open harbour remains water",
  );
});
test("site integration leaves neighboring building bases and empty worlds unchanged", () => {
  for (const id of ["w363651936", "w138256216", "w208599553", "w143683980"]) {
    const b = data.buildings.find((b) => b.id === id)!;
    assert.equal(
      collision.groundHeight(...centroid(b.pts)),
      0,
      `unrelated building base lifted: ${id}`,
    );
  }
  const empty = new CollisionWorld({
    ...data,
    buildings: [],
    roads: [],
    areas: [],
    ocean: [],
  });
  for (const q of [
    [0, 0],
    [430, -541],
    [486.65, -453.35],
  ] as Point[]) {
    assert.equal(empty.groundHeight(...q), 0);
    assert.equal(empty.blocked(...q, 0.36, 0), false);
    assert.equal(empty.water(...q, 0), false);
  }
});
test("western integration matches existing ground across its entire road end", () => {
  const oldData = loadCity();
  oldData.buildings = oldData.buildings.filter((b) => b.id !== "w223635729");
  const old = new CollisionWorld(oldData);
  const end: Point = [325.5, -568.2],
    dx = -11,
    dz = -4.8,
    l = Math.hypot(dx, dz);
  for (let side = -8; side <= 8; side += 0.25) {
    const x = end[0] + (dz / l) * side,
      z = end[1] - (dx / l) * side;
    assert.ok(
      Math.abs(collision.groundHeight(x, z) - old.groundHeight(x, z)) < 1e-6,
      `western end mismatch ${x},${z}`,
    );
    const xx = x - (dx / l) * 0.05,
      zz = z - (dz / l) * 0.05;
    assert.ok(
      Math.abs(collision.groundHeight(xx, zz) - old.groundHeight(xx, zz)) <
        0.001,
      `western near-edge mismatch ${xx},${zz}`,
    );
  }
});
test("retaining side entry cannot lift a ground-level actor onto the raised street", () => {
  const from: Point = [484.2239858005012, -488.118207470961],
    to: Point = [484.6066692328663, -489.0420870034724];
  assert.equal(collision.groundHeight(...from), 0);
  assert.ok(collision.groundHeight(...to) > 7);
  const moved = collision.move(
    ...from,
    to[0] - from[0],
    to[1] - from[1],
    0.36,
    0,
  );
  assert.equal(moved.hit, true);
  assert.ok(collision.groundHeight(moved.x, moved.z) < 0.5);
  for (const radius of [0.36, 1.16]) {
    const road = data.roads.find((r) => r.id === CANADA_PLACE_HOWE_IDS[0])!;
    const path = samples(flatPoints(road.pts), 0.2);
    let q = path[0];
    for (const p of path.slice(1)) {
      const result = collision.move(
        ...q,
        p[0] - q[0],
        p[1] - q[1],
        radius,
        collision.groundHeight(...q),
      );
      assert.equal(
        result.hit,
        false,
        `ordinary uphill motion rejected radius${radius} at${p}`,
      );
      assert.ok(Math.hypot(result.x - p[0], result.z - p[1]) < 1e-8);
      q = p;
    }
  }
});
test("vehicle exit chooses supported height instead of the seven-metre roadside drop", () => {
  const x = 477.852,
    z = -493.061,
    heading = 4.182,
    y = 7.73;
  const preferred: Point = [
    x + Math.cos(heading) * 2.3,
    z - Math.sin(heading) * 2.3,
  ];
  assert.ok(collision.groundHeight(...preferred) < 1);
  const exit = collision.vehicleExit(x, z, heading, y);
  assert.ok(exit, "opposite door should have a supported landing");
  assert.ok(Math.abs(collision.groundHeight(...exit) - y) < 0.6);
  assert.ok(Math.hypot(exit[0] - preferred[0], exit[1] - preferred[1]) > 1);
  assert.equal(collision.blocked(...exit, 0.4, y), false);
  const flat = new CollisionWorld({
    ...data,
    buildings: [],
    roads: [],
    areas: [],
    ocean: [],
  });
  assert.deepEqual(flat.vehicleExit(0, 0, 0, 0), [2.3, 0]);
  const room = new CollisionWorld({
    ...data,
    roads: [],
    areas: [],
    ocean: [],
    buildings: [
      { id: "closed-test-room", pts: [-10, -10, 10, -10, 10, 10, -10, 10] },
    ],
  });
  assert.equal(room.vehicleExit(0, 0, 0, 0), undefined);
});

test("exact plinth bodies block contact but do not create phantom overhead walls", () => {
  for (const a of CANADA_PLACE_GROUND_STAYS) {
    const x = a.center[0] + GROUND_STAY_ORIGIN[0],
      z = a.center[1] + GROUND_STAY_ORIGIN[1];
    assert.equal(collision.groundHeight(x, z), CANADA_PLACE_DECK_Y);
    assert.equal(collision.blocked(x, z, 0.36, a.worldMinY), true);
    assert.equal(
      canadaPlaceGroundStayAt(x, z, 0.36, a.worldMaxY + 0.001),
      false,
    );
    assert.equal(
      collision.blocked(x, z, 0.36, a.worldMaxY + 0.001),
      false,
      "camera above concrete is not blocked by its ground footprint",
    );
    assert.equal(canadaPlaceGroundStayAt(x, z, 0.36, a.worldMinY - 1), false);
    const half = Math.max(...a.perimeter.map((p) => p[1]));
    for (const radius of [0.36, 0.45, 1.16]) {
      const near = half + radius - 0.005,
        far = half + radius + 0.005;
      assert.equal(
        canadaPlaceGroundStayAt(
          x + a.normal[0] * near,
          z + a.normal[1] * near,
          radius,
          a.worldMinY,
        ),
        true,
      );
      assert.equal(
        canadaPlaceGroundStayAt(
          x + a.normal[0] * far,
          z + a.normal[1] * far,
          radius,
          a.worldMinY,
        ),
        false,
        "no hidden facade .55m allowance around plinth",
      );
    }
  }
});
test("continuous outside-anchor route admits actual player bike and car collision widths", (t) => {
  let minimumPlinthMargin = Infinity;
  const measure = (x: number, z: number, r: number) => {
    for (const a of CANADA_PLACE_GROUND_STAYS) {
      const p = a.worldFootprint;
      for (let i = 0; i < p.length; i += 2)
        minimumPlinthMargin = Math.min(
          minimumPlinthMargin,
          segmentPoint(
            x,
            z,
            p[i],
            p[i + 1],
            p[(i + 2) % p.length],
            p[(i + 3) % p.length],
          ).d - r,
        );
    }
  };
  const route: Point[] = [
    [430, -531],
    [430, -541.04],
    ...CANADA_PLACE_DECK_ROUTE,
  ];
  for (const radius of [0.36, 0.45, 1.16])
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-6) continue;
      const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length,
        n = Math.ceil(length / 0.1);
      let previous = a;
      for (let j = 1; j <= n; j++) {
        const x = a[0] + ((b[0] - a[0]) * j) / n,
          z = a[1] + ((b[1] - a[1]) * j) / n,
          y = collision.groundHeight(x, z);
        const moved = collision.move(
          previous[0],
          previous[1],
          x - previous[0],
          z - previous[1],
          radius,
          y,
        );
        assert.equal(
          moved.hit,
          false,
          `radius ${radius} route blocked at${x},${z}`,
        );
        assert.ok(Math.hypot(moved.x - x, moved.z - z) < 1e-7);
        assert.equal(collision.water(x, z, y), false);
        if (radius === 1.16) measure(x, z, 1.16);
        if (radius === 1.16)
          for (const sign of [-1, 1]) {
            const xx = x + dx * 1.35 * sign,
              zz = z + dz * 1.35 * sign;
            measure(xx, zz, 0.9);
            assert.equal(
              collision.blocked(xx, zz, 0.9, y),
              false,
              "actual car nose/tail capsule clears",
            );
            assert.equal(collision.water(xx, zz, y), false);
          }
        previous = [x, z];
      }
    }
  assert.ok(
    minimumPlinthMargin > 0.2,
    `car clearance beyond physical collision capsules:${minimumPlinthMargin}`,
  );
  t.diagnostic(
    `minimum car capsule clearance from plinth: ${minimumPlinthMargin.toFixed(3)}m`,
  );
});
test("under-concourse ground recess stays open but its overhead envelope remains closed", () => {
  const p = concourse.stations[Math.floor(concourse.stations.length / 2)],
    x = p.x + p.nx * 13.6 + GROUND_STAY_ORIGIN[0],
    z = p.z + p.nz * 13.6 + GROUND_STAY_ORIGIN[1];
  assert.equal(solidAt(x, z, 0.36, CANADA_PLACE_DECK_Y), false);
  assert.equal(supportedDeck(x, z, 0.36), true);
  assert.equal(collision.groundHeight(x, z), CANADA_PLACE_DECK_Y);
  assert.equal(collision.blocked(x, z, 0.36, CANADA_PLACE_DECK_Y), false);
  assert.equal(
    collision.blocked(x, z, 0.25, concourse.groundGlassHeadY + 0.081),
    true,
    "overhead soffit remains solid",
  );
  const gx = p.x + p.nx * 12.3 + GROUND_STAY_ORIGIN[0],
    gz = p.z + p.nz * 12.3 + GROUND_STAY_ORIGIN[1];
  assert.equal(
    collision.blocked(gx, gz, 0.36, CANADA_PLACE_DECK_Y),
    true,
    "recessed ground wall stays closed",
  );
});

test("loaded geometry capabilities gate refinements per collision instance and fail conservatively", () => {
  const a = new CollisionWorld(data),
    b = new CollisionWorld(data);
  const anchor = CANADA_PLACE_GROUND_STAYS[2];
  const x = anchor.center[0] + GROUND_STAY_ORIGIN[0];
  const z = anchor.center[1] + GROUND_STAY_ORIGIN[1];
  // Catalog/load failure: no invisible elevated walking surface is authorized.
  assert.equal(a.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y), true);
  // Loaded old source, rejected facade guard: no rendered plinth or extension.
  const sourceOnly = canadaPlaceCapabilities(true, false, false);
  a.setCanadaPlaceCapabilities(sourceOnly);
  assert.equal(a.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y), false);
  assert.equal(
    a.blocked(x, z, 0.1),
    false,
    "placement queries also omit absent plinths",
  );
  assert.equal(
    b.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y),
    true,
    "availability never leaks to another world",
  );
  sourceOnly.concourse = true;
  sourceOnly.groundStays = true;
  assert.equal(
    a.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y),
    false,
    "caller mutation cannot enable geometry",
  );
  a.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, true));
  assert.equal(
    a.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y),
    true,
    "rendered plinth blocks its actual footprint",
  );
  a.setCanadaPlaceCapabilities(canadaPlaceCapabilities(false, true, true));
  assert.equal(
    a.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y),
    true,
    "failed load reverts to conservative source-pier collision",
  );
});

test("rejected concourse refinement does not create an invisible canopy volume", () => {
  const st = concourse.stations[Math.floor(concourse.stations.length / 2)];
  const x = st.x + st.nx * 13.6 + GROUND_STAY_ORIGIN[0];
  const z = st.z + st.nz * 13.6 + GROUND_STAY_ORIGIN[1];
  const c = new CollisionWorld(data);
  c.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, false, false));
  assert.equal(c.blocked(x, z, 0.1, 10.84), false);
  c.setCanadaPlaceCapabilities(canadaPlaceCapabilities(true, true, false));
  assert.equal(c.blocked(x, z, 0.1, 10.84), true);
  assert.equal(
    c.blocked(x, z, 0.1, CANADA_PLACE_DECK_Y),
    false,
    "successful geometry retains its ground recess",
  );
});
