import test from "node:test";
import assert from "node:assert/strict";
import {
  harbourGroundHeight,
  harbourBaseHeight,
  harbourWays,
  HARBOUR_BOUNDARY,
} from "../src/world/harbour-green-site";
import { CollisionWorld } from "../src/world/collision";
import type { CityData, Road } from "../src/world/data";

const collision = new CollisionWorld({
  roads: [],
  buildings: [],
  trees: [],
  ocean: [],
  areas: [{ kind: "park", name: "Harbour Green Park", pts: HARBOUR_BOUNDARY }],
} as unknown as CityData);
const road: Road = {
  kind: "residential",
  name: "West Cordova Street",
  pts: [-156.9, -692.4, -126.7, -677],
};

test("Cordova frontage is a continuous shared grade across the park land-use edge", () => {
  // Regression area: the old inPark switch rose 1.62 -> 5.40m in five metres.
  // Verify at sub-metre resolution, rather than just checking path endpoints.
  let maximum = 0;
  for (let x = -155; x <= -105; x += 0.5)
    for (let z = -730; z <= -680; z += 0.5) {
      const y = harbourGroundHeight(x, z)!;
      const grade = Math.hypot(
        (harbourGroundHeight(x + 0.25, z)! -
          harbourGroundHeight(x - 0.25, z)!) /
          0.5,
        (harbourGroundHeight(x, z + 0.25)! -
          harbourGroundHeight(x, z - 0.25)!) /
          0.5,
      );
      assert.ok(Number.isFinite(y));
      maximum = Math.max(maximum, grade);
      assert.ok(
        Math.abs(y - harbourBaseHeight(x, z)) < 1e-7,
        "renderer triangles and collision share the same surface",
      );
      assert.ok(
        Math.abs(y - collision.roadHeight(road, x, z)) < 1e-7,
        "road overlays share terrain grade",
      );
    }
  assert.ok(maximum < 0.1, `frontage grade ${maximum}`);
});

test("street approach reaches the authored Bute upper landing without a cliff", () => {
  const a = [-143.43, -685.41],
    b = harbourWays.w48271069.pts[1];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.ceil(length / 0.25);
  let previous = harbourGroundHeight(...(a as [number, number]))!;
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    const y = harbourGroundHeight(x, z)!;
    assert.ok(
      Math.abs(y - previous) / (length / n) < 0.12,
      "approach stays below a 12% local grade",
    );
    previous = y;
  }
  assert.ok(
    Math.abs(previous - 6.14) < 1e-6,
    "preserves the existing upper landing datum",
  );
});
