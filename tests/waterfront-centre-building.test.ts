import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { waterfrontCentre } from "../src/world/waterfront-centre-building";
import {
  WATERFRONT_CENTRE_ID,
  WATERFRONT_CENTRE_RING,
} from "../src/world/waterfront-centre-site";
import { pointInPoly, type Building } from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import type { Materials } from "../src/world/materials";
import type { ReflectionProbeSpec } from "../src/rendering/reflection-probes";

test("Waterfront dispatch replaces only its mapped office and registers one exterior capture", () => {
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
  const other = {
    id: "w143683933",
    pts: WATERFRONT_CENTRE_RING.flat(),
  } as Building;
  assert.equal(waterfrontCentre(other, batch, library, reflections), false);
  assert.equal(loads, 0);
  assert.equal(reflections.length, 0);
  const building = { ...other, id: WATERFRONT_CENTRE_ID };
  const before = structuredClone(building);
  batch.offsetY = 7.73;
  assert.equal(waterfrontCentre(building, batch, library, reflections), true);
  assert.equal(
    batch.offsetY,
    7.73,
    "does not leak its absolute datum into the next building",
  );
  assert.deepEqual(
    building,
    before,
    "map and collision records stay unchanged",
  );
  assert.equal(reflections.length, 1);
  assert.equal(reflections[0].materials.length, 2);
  const [x, y, z] = reflections[0].position;
  assert.equal(pointInPoly(x, z, WATERFRONT_CENTRE_RING.flat()), false);
  assert.ok(y > 7.88 && y < 91.75);
  const meshes = batch.finish();
  assert.ok(meshes.length > 0);
  assert.ok(
    meshes.every((mesh) =>
      (mesh.material as T.Material).name.startsWith("Waterfront Centre —"),
    ),
  );
  assert.ok(
    reflections[0].materials.every((material) =>
      meshes.some((mesh) => mesh.material === material),
    ),
  );
});
