import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CollisionWorld } from "../src/world/collision";
import { KX, ORIGIN, segmentPoint, type CityData } from "../src/world/data";
import { facadeFrame } from "../src/world/architectural-mesh";
import {
  PWC_LOBBY_SECTIONS,
  PWC_LOBBY_COLUMNS,
} from "../src/world/pwc-lobby-site";
import {
  FAIRMONT_ARCADE_FRONTAGES,
  FAIRMONT_ARCADE_PIERS,
  FAIRMONT_ARCADE_CLOSURES,
} from "../src/world/fairmont-arcade-site";
function city() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((b) => (b.pts = convert(b.pts)));
  data.ocean = [];
  data.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return new CollisionWorld(data);
}
const collision = city();
test("PwC exterior mouths are walkable but rear glass and columns remain solid", () => {
  for (const s of PWC_LOBBY_SECTIONS) {
    const u = s.edge === 0 ? 8.5 : s.frame.length / 2;
    for (let d = -0.2; d <= 1.5; d += 0.1) {
      const p = s.frame.p(u, 0, d);
      assert.equal(
        collision.blocked(p[0], p[2], 0.35, collision.groundHeight(p[0], p[2])),
        false,
        `edge${s.edge} depth${d}`,
      );
      if (d > 0.05)
        assert.ok(Number.isFinite(collision.groundHeight(p[0], p[2])));
    }
    const depth = s.entry?.depth ?? s.depth;
    const glass = s.frame.p(u, 0, depth - 0.1);
    assert.equal(
      collision.blocked(
        glass[0],
        glass[2],
        0.35,
        collision.groundHeight(glass[0], glass[2]),
      ),
      true,
    );
    const high = s.frame.p(u, 0, 1.5);
    assert.equal(collision.cameraBlocked(high[0], high[2], 0.2, 7.7), true);
    assert.equal(
      collision.cameraBlocked(
        high[0],
        high[2],
        0.2,
        collision.groundHeight(high[0], high[2]) + 1.7,
      ),
      false,
    );
  }
  for (const p of PWC_LOBBY_COLUMNS)
    assert.equal(collision.blocked(p.x, p.z, 0.35, 0.18), true);
});
test("Fairmont arcade opens continuously across old facade edges and closes at glass/columns/ceiling", () => {
  let checked = 0;
  for (const s of FAIRMONT_ARCADE_FRONTAGES) {
    const f = facadeFrame(s.a, s.b);
    for (let u = 1; u < f.length - 1; u += 0.2) {
      const inside = f.p(u, 0, 1.3);
      if (
        [-0.1, 0.1, 0.6, 1.3].some((d) => {
          const p = f.p(u, 0, d);
          return (
            FAIRMONT_ARCADE_PIERS.some(
              (q) =>
                Math.hypot(p[0] - q.point[0], p[2] - q.point[1]) <
                q.radius + 0.35,
            ) ||
            FAIRMONT_ARCADE_CLOSURES.some(
              (q) => segmentPoint(p[0], p[2], ...q.a, ...q.b).d < 0.36,
            )
          );
        })
      )
        continue;
      for (const depth of [-0.1, 0.1, 0.6, 1.3]) {
        const p = f.p(u, 0, depth),
          y = collision.groundHeight(p[0], p[2]);
        assert.equal(
          collision.blocked(p[0], p[2], 0.32, y),
          false,
          `edge${s.edge} u${u} depth${depth}`,
        );
      }
      assert.equal(
        collision.cameraBlocked(
          inside[0],
          inside[2],
          0.2,
          15,
        ),
        true,
      );
      checked++;
    }
  }
  assert.ok(checked > 30);
  for (const p of FAIRMONT_ARCADE_PIERS)
    assert.equal(
      collision.blocked(...p.point, 0.35, collision.groundHeight(...p.point)),
      true,
    );
});
test("Recess floor overrides leave the live Howe route and outer shoulder unchanged", () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100,
      x = 451 + 44 * t,
      z = -417 - 59 * t;
    assert.equal(
      collision.groundHeight(x, z),
      collision.baselineGroundHeight(x, z),
    );
  }
  for (const p of [
    [486.65, -453.35],
    [478.57, -456.25],
    [454.69, -421.5],
    [495.05, -476.1],
  ])
    assert.equal(
      collision.groundHeight(...(p as [number, number])),
      collision.baselineGroundHeight(...(p as [number, number])),
    );
});

test("ordinary walking crosses both former retaining edges into the modeled exterior recess", () => {
  const pwc = PWC_LOBBY_SECTIONS[0].frame;
  const hotel = facadeFrame(
    FAIRMONT_ARCADE_FRONTAGES[1].a,
    FAIRMONT_ARCADE_FRONTAGES[1].b,
  );
  for (const [name, f, u] of [
    ["PwC", pwc, 8.5],
    ["Fairmont", hotel, 10],
  ] as const) {
    const start = f.p(u, 0, -16);
    let x = start[0],
      z = start[2];
    for (let d = -15.88; d <= 1.5; d += 0.12) {
      const target = f.p(u, 0, d);
      const y = collision.groundHeight(x, z);
      const moved = collision.move(x, z, target[0] - x, target[2] - z, 0.32, y);
      assert.ok(
        Math.hypot(moved.x - target[0], moved.z - target[2]) < 0.001,
        `${name} approach blocked at depth ${d}`,
      );
      const nextY = collision.groundHeight(moved.x, moved.z);
      assert.ok(
        Math.abs(nextY - y) < 0.2,
        `${name} abrupt ground step at ${d}`,
      );
      x = moved.x;
      z = moved.z;
    }
  }
});
