import * as T from "three";
import { createCanadaPlaceFixtureParts } from "../src/world/canada-place-promenade-fixtures";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { ORIGIN, KX, type CityData, segmentPoint } from "../src/world/data";
import source from "../src/world/canada-place-deck-data.json";
import {
  CANADA_PLACE_ORIGIN,
  inCanadaPlacePier,
  solidAt,
  supportedDeck,
} from "../src/world/canada-place-deck";
import {
  CANADA_PLACE_FIXTURE_COLLISION_RADIUS as radius,
  CANADA_PLACE_PROMENADE_FIXTURES as fixtures,
  CANADA_PLACE_FIXTURE_RAIL_INSET,
  canadaPlacePromenadeFixtureAt,
} from "../src/world/canada-place-promenade-fixtures-data";
function city() {
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
test("source-edge row is supported, inset from railing and remains south of sail stay corridor", () => {
  assert.equal(fixtures.length, 4);
  for (const p of fixtures) {
    assert.equal(p.groundY, 7.8);
    assert.equal(p.globe, "single");
    assert.equal(p.banner, true);
    assert.ok(inCanadaPlacePier(...p.world, radius));
    assert.equal(solidAt(...p.world, radius, 7.88), false);
    const a = source.pier[1],
      b = source.pier[2];
    const nearest = segmentPoint(p.x, p.z, a[0], a[1], b[0], b[1]);
    assert.ok(Math.abs(nearest.d - CANADA_PLACE_FIXTURE_RAIL_INSET) < 1e-7);
    assert.ok(
      p.edgeStation <= 105,
      "never extrapolate into narrow ground-stay corridor",
    );
    // +X follows northward rail, +Z points inland under Three's Y rotation.
    assert.ok(Math.cos(p.yaw) > 0.8 && -Math.sin(p.yaw) < -0.4);
  }
});
test("four actual placements preserve three-metre corridor and car centre/nose/tail probes", (t) => {
  const collision = new CollisionWorld(city());
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true, true),
  );
  const route = [
    [-190, 47],
    [-155, 28],
    [-115, 7],
  ];
  let minimum = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / length,
      uz = (b[1] - a[1]) / length;
    for (let j = 0; j <= Math.ceil(length / 0.2); j++) {
      const f = j / Math.ceil(length / 0.2),
        x = a[0] + (b[0] - a[0]) * f + CANADA_PLACE_ORIGIN[0],
        z = a[1] + (b[1] - a[1]) * f + CANADA_PLACE_ORIGIN[1];
      assert.ok(supportedDeck(x, z, 1.5), "continuous3m deck corridor");
      assert.equal(collision.blocked(x, z, 1.5, 7.88), false);
      for (const p of fixtures)
        minimum = Math.min(
          minimum,
          Math.hypot(x - p.world[0], z - p.world[1]) - radius - 1.5,
        );
      for (const [along, r] of [
        [0, 1.16],
        [-1.35, 0.9],
        [1.35, 0.9],
      ]) {
        const px = x + ux * along,
          pz = z + uz * along;
        assert.equal(collision.blocked(px, pz, r, 7.88), false);
        assert.equal(canadaPlacePromenadeFixtureAt(px, pz, r, 7.88), false);
      }
    }
  }
  assert.ok(minimum > 0.45, `fixture margin beyond3m corridor:${minimum}`);
  t.diagnostic(
    `minimum fixture margin beyond3m corridor:${minimum.toFixed(3)}m`,
  );
});
test("fixture collision uses finite world height rather than infinite trunk columns", () => {
  for (const p of fixtures) {
    assert.equal(canadaPlacePromenadeFixtureAt(...p.world, 0.36, 7.88), true);
    assert.equal(canadaPlacePromenadeFixtureAt(...p.world, 0.36, 0), false);
    assert.equal(canadaPlacePromenadeFixtureAt(...p.world, 0.36, 13), false);
    assert.equal(
      canadaPlacePromenadeFixtureAt(...p.world, 0.36, 7.4, 1.7),
      true,
    );
    assert.equal(
      canadaPlacePromenadeFixtureAt(p.world[0] + 1, p.world[1], 0.36, 7.88),
      false,
    );
  }
});

test("loaded fixture capability gates actual actor and camera collision", () => {
  const collision = new CollisionWorld(city());
  const p = fixtures[0].world;
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true),
  );
  // Pole feet sit within the existing railing safety margin. The elevated
  // camera query isolates the new fixture from that prior ground-level proxy.
  assert.equal(collision.blocked(...p, 0.1, 7.88), true);
  assert.equal(collision.cameraBlocked(...p, 0.1, 9.95), false);
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true, true),
  );
  assert.equal(collision.blocked(...p, 0.1, 7.88), true);
  assert.equal(collision.blocked(...p, 0.1), true);
  assert.equal(collision.cameraBlocked(...p, 0.1, 9.95), true);
  assert.equal(collision.cameraBlocked(...p, 0.1, 13), false);
  collision.setCanadaPlaceCapabilities(
    canadaPlaceCapabilities(true, true, true),
  );
  assert.equal(collision.cameraBlocked(...p, 0.1, 9.95), false);
});

test("seaward banners face approaching walkers and only high pieces extend beyond the pier", () => {
  const texture = new T.Texture(),
    parts = createCanadaPlaceFixtureParts(() => texture);
  const a = source.pier[1],
    b = source.pier[2];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  let overwater = 0;
  for (const placement of fixtures) {
    const transform = new T.Matrix4().makeRotationY(placement.yaw);
    transform.setPosition(placement.x, placement.groundY, placement.z);
    const clothAlong: number[] = [],
      clothInward: number[] = [];
    for (const [partIndex, part] of parts.entries()) {
      const p = part.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const q = new T.Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(transform);
        const inward = -(q.x - a[0]) * uz + (q.z - a[1]) * ux;
        if (partIndex === 3) {
          clothAlong.push((q.x - placement.x) * ux + (q.z - placement.z) * uz);
          clothInward.push(inward);
          assert.ok(
            inward < 0.4,
            "cloth projects seaward, never inland into route",
          );
        }
        if (inward < 0) {
          overwater++;
          assert.ok(
            q.y - placement.groundY >= 2.12,
            "no low unsupported pole or false footing outside pier",
          );
          const x = q.x + CANADA_PLACE_ORIGIN[0],
            z = q.z + CANADA_PLACE_ORIGIN[1];
          assert.equal(inCanadaPlacePier(x, z), false);
          assert.equal(
            supportedDeck(x, z),
            false,
            "banner projection must never become walking support",
          );
        }
        const route = [
          [-190, 47],
          [-155, 28],
          [-115, 7],
        ];
        const distance = Math.min(
          ...route
            .slice(1)
            .map(
              (r, j) =>
                segmentPoint(q.x, q.z, route[j][0], route[j][1], r[0], r[1]).d,
            ),
        );
        assert.ok(
          distance > 1.5,
          "all fixture geometry stays outside three-metre corridor at every height",
        );
      }
    }
    assert.ok(
      Math.max(...clothAlong) - Math.min(...clothAlong) < 0.09,
      "banner broad plane is perpendicular to row",
    );
    assert.ok(Math.max(...clothInward) - Math.min(...clothInward) > 0.8);
    assert.ok(
      Math.min(...clothInward) < -0.45 && Math.min(...clothInward) > -0.55,
    );
  }
  assert.ok(
    overwater > 0,
    "check actual high seaward projection rather than an unused proposed transform",
  );
  parts.forEach((p) => {
    p.geometry.dispose();
    p.material.dispose();
  });
  texture.dispose();
});
