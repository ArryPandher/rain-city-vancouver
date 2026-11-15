import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  buildHarbourFrontage,
  frontagePoint,
  frontageBayClear,
  HARBOUR_FRONTAGE_BAYS,
} from "../src/world/harbour-frontage";
import {
  HARBOUR_BOUNDARY,
  HARBOUR_FLIGHTS,
  harbourPaths,
} from "../src/world/harbour-green-site";
import { CollisionWorld } from "../src/world/collision";
import type { CityData } from "../src/world/data";
import type { Materials } from "../src/world/materials";
const data = {
  buildings: [],
  trees: [],
  roads: [],
  ocean: [],
  areas: [{ kind: "park", name: "Harbour Green Park", pts: HARBOUR_BOUNDARY }],
} as unknown as CityData;
const collision = new CollisionWorld(data),
  root = new T.Group();
const meshes = buildHarbourFrontage(
  root,
  data,
  { texture: () => new T.Texture() } as unknown as Materials,
  collision,
);
root.updateMatrixWorld(true);
test("candidate bounds retain enclosing buildings and nearby trunks outside the facade footprint", () => {
  const bay = HARBOUR_FRONTAGE_BAYS[0],
    p = frontagePoint(bay.u, 5);
  const enclosing = {
    id: "enclosing",
    pts: [
      p[0] - 30,
      p[1] - 30,
      p[0] + 30,
      p[1] - 30,
      p[0] + 30,
      p[1] + 30,
      p[0] - 30,
      p[1] + 30,
    ],
  };
  assert.equal(
    frontageBayClear(bay, { ...data, buildings: [enclosing] }),
    false,
  );
  const outside = frontagePoint(bay.u - bay.width / 2 - 0.9, 5);
  assert.equal(
    frontageBayClear(bay, { ...data, trees: outside }),
    false,
    "Trunk clearance extends outside the building footprint",
  );
  assert.equal(
    frontageBayClear(bay, {
      ...data,
      buildings: [{ ...enclosing, pts: enclosing.pts.map((v) => v + 1000) }],
      trees: [1000, 1000],
    }),
    true,
  );
});
test("frontage leaves every central stair tread and all mapped path centres clear", () => {
  for (const f of HARBOUR_FLIGHTS.filter((f) => f.id.startsWith("w48271068")))
    for (let i = 0; i < f.steps; i++) {
      const t = (i + 0.5) / f.steps,
        x = f.a[0] + (f.b[0] - f.a[0]) * t,
        z = f.a[1] + (f.b[1] - f.a[1]) * t;
      assert.equal(
        collision.blocked(x, z, 0.4, collision.groundHeight(x, z)),
        false,
        `${f.id}:${i}`,
      );
      const ray = new T.Raycaster(
        new T.Vector3(x, 20, z),
        new T.Vector3(0, -1, 0),
      );
      assert.equal(
        ray.intersectObjects(meshes).length,
        0,
        "No roof or slat bridges the stair",
      );
    }
  for (const path of harbourPaths)
    for (let i = 0; i < path.pts.length - 1; i++) {
      const a = path.pts[i],
        b = path.pts[i + 1],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d <= length; d += 0.4) {
        const x = a[0] + ((b[0] - a[0]) * d) / length,
          z = a[1] + ((b[1] - a[1]) * d) / length;
        assert.equal(
          collision.blocked(x, z, 0.4, collision.groundHeight(x, z)),
          false,
          path.id,
        );
      }
    }
});
test("frontage stays bounded and foundations intersect the actual terrain", () => {
  assert.ok(meshes.length > 0 && meshes.length <= 8);
  for (const mesh of meshes) {
    for (const key of ["position", "normal", "uv"])
      assert.ok(
        Array.from(mesh.geometry.getAttribute(key).array).every(
          Number.isFinite,
        ),
      );
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    assert.ok(
      b.min.x > -130 && b.max.x < -85 && b.min.z > -770 && b.max.z < -737,
    );
    assert.ok(b.min.y > 0 && b.max.y < 10);
  }
  for (const bay of HARBOUR_FRONTAGE_BAYS) {
    const [x, z] = frontagePoint(bay.u, bay.front + 0.01),
      ground = collision.groundHeight(x, z);
    // Horizontal ray at the terrain surface must meet the buried wall.
    const a = frontagePoint(bay.u, bay.front - 1),
      b = frontagePoint(bay.u, bay.front + 1);
    const ray = new T.Raycaster(
      new T.Vector3(a[0], ground, a[1]),
      new T.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(),
      0,
      3,
    );
    assert.ok(ray.intersectObjects(meshes).length > 0, `Grounded bay ${bay.u}`);
  }
});
test("frontage rejects future building or inventory-tree conflicts instead of overlapping them", () => {
  const bay = HARBOUR_FRONTAGE_BAYS[0],
    p = frontagePoint(bay.u, 5);
  assert.equal(frontageBayClear(bay, data), true);
  assert.equal(
    frontageBayClear(bay, {
      ...data,
      publicTrees: {
        species: [],
        plantingSites: [],
        trees: [[123, p[0], p[1], 8, 20, 0]],
      },
    }),
    false,
  );
  assert.equal(
    frontageBayClear(bay, {
      ...data,
      buildings: [
        {
          id: "obstruction",
          pts: [
            p[0] - 1,
            p[1] - 1,
            p[0] + 1,
            p[1] - 1,
            p[0] + 1,
            p[1] + 1,
            p[0] - 1,
            p[1] + 1,
          ],
        },
      ],
    }),
    false,
  );
});
