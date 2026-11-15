import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  hastingsBuilding,
  HASTINGS_BUILDING_ID,
  HASTINGS_PART_IDS,
  HASTINGS_PARENT,
  HASTINGS_TOWER,
  HASTINGS_HEIGHT,
  HASTINGS_LOBBY,
} from "../src/world/hastings-building";
import { Batcher } from "../src/world/geometry";
import { facadeFrame } from "../src/world/architectural-mesh";
import { pointInPoly, segmentPoint, type Building } from "../src/world/data";
import type { Materials } from "../src/world/materials";
import type { CollisionWorld } from "../src/world/collision";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";
const b = {
  id: HASTINGS_BUILDING_ID,
  pts: HASTINGS_PARENT.slice(0, -1).flat(),
} as Building;
const m = { texture: () => new T.Texture() } as unknown as Materials;
const collision = { groundHeight: () => 2.5 } as unknown as CollisionWorld;
const root = new T.Group(),
  batch = new Batcher(root),
  refs: ReflectionProbeSpec[] = [];
batch.offsetY = 19;
assert.equal(hastingsBuilding(b, batch, m, collision, refs), true);
const chunks = batch.finish();
root.updateMatrixWorld(true);
test("Hastings named geometry restores batch state and suppresses imported upper-part duplicates", () => {
  assert.equal(batch.offsetY, 19);
  const empty = new Batcher(new T.Group());
  for (const id of HASTINGS_PART_IDS)
    assert.equal(hastingsBuilding({ ...b, id }, empty, m, collision), true);
  assert.equal(empty.finish().length, 0);
  assert.equal(
    hastingsBuilding({ ...b, id: "other" }, empty, m, collision),
    false,
  );
  assert.equal(refs.length, 1);
});
test("Hastings preserves the mapped upper silhouette with finite geometry and a bounded material budget", () => {
  assert.ok(chunks.length <= 7 && chunks.length >= 5);
  let max = -Infinity,
    triangles = 0;
  for (const chunk of chunks) {
    for (const name of ["position", "normal", "uv"])
      assert.ok(
        Array.from(chunk.geometry.getAttribute(name).array).every(
          Number.isFinite,
        ),
      );
    const a = chunk.geometry.getAttribute("position");
    triangles += (chunk.geometry.index?.count ?? a.count) / 3;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i),
        z = a.getZ(i);
      max = Math.max(max, a.getY(i));
      const ring =
        a.getY(i) > 2.5 + HASTINGS_LOBBY ? HASTINGS_TOWER : HASTINGS_PARENT;
      if (pointInPoly(x, z, ring.slice(0, -1).flat())) continue;
      const distance = Math.min(
        ...ring
          .slice(0, -1)
          .map((p, j) => segmentPoint(x, z, ...p, ...ring[j + 1]).d),
      );
      assert.ok(
        distance < 0.23,
        `outside mapped silhouette: ${x},${z},${distance}`,
      );
    }
  }
  assert.ok(Math.abs(max - (2.5 + HASTINGS_HEIGHT + 1.05)) < 0.00001);
  assert.ok(triangles < 12000, `triangles: ${triangles}`);
});
test("Hastings facade has outward-visible glazing behind continuous floor bands", () => {
  const f = facadeFrame(HASTINGS_TOWER[0], HASTINGS_TOWER[1]);
  const along = f.length * 0.371;
  const ray = (h: number) => {
    const start = f.p(along, 2.5 + h, -2);
    return new T.Raycaster(
      new T.Vector3(...start),
      new T.Vector3(-f.outward[0], 0, -f.outward[1]),
      0,
      4,
    ).intersectObjects(chunks)[0];
  };
  const band = ray(HASTINGS_LOBBY + 0.2),
    glass = ray(HASTINGS_LOBBY + 1.5);
  assert.ok(band && glass);
  assert.match(
    ((glass.object as T.Mesh).material as T.Material).name,
    /reflective blue-grey glazing/,
  );
  assert.ok(
    glass.distance - band.distance > 0.1 &&
      glass.distance - band.distance < 0.16,
  );
  const under = f.p(along, 2.5 + 1, 0.2);
  assert.ok(
    new T.Raycaster(
      new T.Vector3(...under),
      new T.Vector3(0, 1, 0),
      0,
      8,
    ).intersectObjects(chunks).length > 0,
    "Raised tower has a visible underside",
  );
});
