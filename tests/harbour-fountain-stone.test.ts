import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ArchitecturalMesh } from "../src/world/architectural-mesh";
import { Batcher } from "../src/world/geometry";
import {
  buildFountainStonePier,
  fountainStoneMaterials,
} from "../src/world/harbour-fountain-stone";
import {
  fountainWorld,
  HARBOUR_POOL_LEVEL,
} from "../src/world/harbour-green-site";
import type { Materials } from "../src/world/materials";
const root = new T.Group(),
  batch = new Batcher(root, 64),
  mesh = new ArchitecturalMesh(batch, 0, 0);
const u = -0.85,
  v = 7.2,
  [x, z] = fountainWorld(u, v),
  angle = -Math.atan2(6.61, 12.06);
buildFountainStonePier(
  mesh,
  u,
  v,
  fountainStoneMaterials({
    texture: () => new T.Texture(),
  } as unknown as Materials),
);
mesh.finish();
const chunks = batch.finish();
root.updateMatrixWorld(true);
test("detailed stone preserves the old pier envelope and peak with finite outward geometry", () => {
  let max = -Infinity,
    min = Infinity;
  for (const chunk of chunks) {
    for (const key of ["position", "normal", "uv"])
      assert.ok(
        Array.from(chunk.geometry.getAttribute(key).array).every(
          Number.isFinite,
        ),
      );
    const p = chunk.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - x,
        dz = p.getZ(i) - z;
      const a = dx * Math.cos(angle) - dz * Math.sin(angle),
        b = dx * Math.sin(angle) + dz * Math.cos(angle);
      assert.ok(
        Math.abs(a) <= 0.93 / Math.sqrt(2) + 0.00002 &&
          Math.abs(b) <= 0.93 / Math.sqrt(2) + 0.00002,
      );
      max = Math.max(max, p.getY(i));
      min = Math.min(min, p.getY(i));
    }
  }
  assert.ok(Math.abs(max - HARBOUR_POOL_LEVEL - 1.9) < 0.00001);
  assert.ok(Math.abs(min - HARBOUR_POOL_LEVEL) < 0.00001);
});
test("stone surrounds stand ahead of the recessed panel and remain visible from outside", () => {
  const rayAt = (along: number, height: number) => {
    const origin = new T.Vector3(
      x + along * Math.cos(angle) + 2 * Math.sin(angle),
      HARBOUR_POOL_LEVEL + height,
      z - along * Math.sin(angle) + 2 * Math.cos(angle),
    );
    return new T.Raycaster(
      origin,
      new T.Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
      0,
      3,
    ).intersectObjects(chunks)[0];
  };
  const jamb = rayAt(0.465, 0.72),
    panel = rayAt(0.23, 0.72);
  assert.ok(jamb && panel);
  assert.ok(
    panel.distance - jamb.distance > 0.05,
    "Panel is physically recessed, not a decal",
  );
  assert.match(
    (jamb.object as T.Mesh).material instanceof Array
      ? ""
      : ((jamb.object as T.Mesh).material as T.Material).name,
    /dressed stone/,
  );
});
