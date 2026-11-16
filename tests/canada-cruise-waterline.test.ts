import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { buildLandmarks } from "../src/world/landmarks";
import { CollisionWorld } from "../src/world/collision";
import { canadaPlaceCapabilities } from "../src/world/canada-place-capabilities";
import { CANADA_PLACE_PIER } from "../src/world/canada-place-deck";
import { geo, segmentPoint } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import { loadCity } from "./helpers/full-city-data";

const originalFetch = globalThis.fetch;
let collision: CollisionWorld;
try {
  globalThis.fetch = async (input) => {
    assert.equal(typeof input, "string");
    const bytes = fs.readFileSync(`public${input}`);
    return new Response(new Uint8Array(bytes));
  };
  collision = new CollisionWorld(await loadCity());
} finally {
  globalThis.fetch = originalFetch;
}
collision.setCanadaPlaceCapabilities(
  canadaPlaceCapabilities(true, true, true, true, true),
);

function actualShip(ground: CollisionWorld) {
  const parent = new T.Group();
  const stop = new Error("Only the cruise construction is under test");
  const add = parent.add;
  let followingLandmark: T.Object3D | undefined;
  parent.add = function (...objects) {
    if (this.children.length) {
      followingLandmark = objects[0];
      throw stop;
    }
    return add.apply(this, objects);
  };
  const m = {
    white: new T.MeshStandardMaterial(),
    chrome: new T.MeshStandardMaterial(),
    dark: new T.MeshStandardMaterial(),
  } as Materials;
  assert.throws(
    () => buildLandmarks(parent, m, ground),
    (e) => e === stop,
  );
  parent.updateMatrixWorld(true);
  return {
    group: parent.children[0],
    ship: parent.children[0].children[0],
    followingLandmark,
  };
}
const built = actualShip(collision);
// Read the actual owning ocean-plane expression, so a changed water datum must
// update this placement too. No WebGL renderer or screenshot estimate is needed.
const world = fs.readFileSync("src/world/world.ts", "utf8");
const ocean = world.match(/flatPolygon\(o, \[\], ([\d.]+), 1\)/);
assert.ok(ocean, "locate the current rendered ocean datum");
const oceanY = Number(ocean[1]);

test("actual transformed cruise waterline meets rendered ocean despite its land-based parent anchor", () => {
  const anchor = geo(49.28845, -123.1118);
  assert.ok(
    collision.groundHeight(...anchor) > oceanY + 1.8,
    "actual old placement floats",
  );
  const centre = built.ship.getWorldPosition(new T.Vector3());
  assert.equal(collision.water(centre.x, centre.z), true);
  const hull = built.ship.children[0] as T.Mesh;
  const p = hull.geometry.getAttribute("position");
  let waterlineVertices = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) !== 0) continue;
    const vertex = new T.Vector3()
      .fromBufferAttribute(p, i)
      .applyMatrix4(hull.matrixWorld);
    assert.ok(Math.abs(vertex.y - oceanY) < 1e-10);
    waterlineVertices++;
  }
  assert.equal(waterlineVertices, 81, "complete original hull waterline ring");
  assert.equal(new T.Box3().setFromObject(built.ship).min.y, oceanY);
  const next = built.followingLandmark!;
  assert.equal(
    next.position.y,
    collision.groundHeight(next.position.x, next.position.z),
    "other landmark placement stays unchanged",
  );
});

test("waterline correction preserves exact berth, heading, ship dimensions and dock distance", () => {
  const centre = built.ship.getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(centre.x - 717.6731950408732) < 1e-9);
  assert.ok(Math.abs(centre.z + 579.1827398509848) < 1e-9);
  assert.equal(built.group.rotation.y, -0.39);
  assert.deepEqual(built.ship.position.toArray(), [122, 0, -25]);
  assert.deepEqual(built.group.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(built.ship.scale.toArray(), [1, 1, 1]);
  const b = new T.Box3().setFromObject(built.ship);
  assert.ok(Math.abs(b.min.x - 656.3271312085195) < 1e-9);
  assert.ok(Math.abs(b.max.x - 779.0192588732269) < 1e-9);
  assert.ok(Math.abs(b.min.z + 696.6350300909562) < 1e-9);
  assert.ok(Math.abs(b.max.z + 461.7304496110135) < 1e-9);
  assert.ok(Math.abs(b.max.y - b.min.y - 43) < 1e-9);
  let distance = Infinity;
  for (let i = 0; i < CANADA_PLACE_PIER.length; i += 2) {
    const j = (i + 2) % CANADA_PLACE_PIER.length;
    distance = Math.min(
      distance,
      segmentPoint(
        centre.x,
        centre.z,
        CANADA_PLACE_PIER[i],
        CANADA_PLACE_PIER[i + 1],
        CANADA_PLACE_PIER[j],
        CANADA_PLACE_PIER[j + 1],
      ).d,
    );
  }
  assert.ok(
    Math.abs(distance - 42.023088613492455) < 1e-9,
    "unchanged horizontal centre-to-source-pier-edge distance",
  );
  let meshes = 0,
    triangles = 0;
  built.ship.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles +=
        (o.geometry.index?.count ?? o.geometry.getAttribute("position").count) /
        3;
    }
  });
  assert.equal(meshes, 695);
  assert.equal(triangles, 30040);
});
