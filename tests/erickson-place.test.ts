import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { ericksonPlace, ERICKSON_PLACE_ID } from "../src/world/erickson-place";
import { Batcher } from "../src/world/geometry";
import {
  ORIGIN,
  KX,
  pointInPoly,
  segmentPoint,
  type Building,
} from "../src/world/data";
import type { Materials } from "../src/world/materials";

test("Erickson Place stays inside its mapped collision footprint", () => {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const b: Building = data.buildings.find(
    (b: Building) => b.id === ERICKSON_PLACE_ID,
  );
  assert.ok(b, "the authored landmark still has a mapped site");
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX;
  const oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  b.pts = b.pts.map((value, i) => value / 2 - (i % 2 ? oz : ox));
  const batch = new Batcher(new T.Group());
  const materials = {
    texture: () => new T.Texture(),
    roof: new T.MeshStandardMaterial(),
  } as unknown as Materials;
  assert.equal(ericksonPlace(b, batch, materials), true);
  const meshes = batch.finish();
  assert.ok(meshes.length > 0);
  let highest = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position");
    const normal = mesh.geometry.getAttribute("normal");
    assert.equal(p.count, normal.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok(
        [x, y, z, normal.getX(i), normal.getY(i), normal.getZ(i)].every(
          Number.isFinite,
        ),
      );
      highest = Math.max(highest, y);
      if (pointInPoly(x, z, b.pts)) continue;
      let edgeDistance = Infinity;
      for (let j = 0; j < b.pts.length; j += 2) {
        const k = (j + 2) % b.pts.length;
        edgeDistance = Math.min(
          edgeDistance,
          segmentPoint(x, z, b.pts[j], b.pts[j + 1], b.pts[k], b.pts[k + 1]).d,
        );
      }
      assert.ok(
        edgeDistance < 0.05,
        `visible geometry extends ${edgeDistance.toFixed(2)} m beyond collision at ${x}, ${z}`,
      );
    }
  }
  assert.ok(
    highest > 100 && highest < 105,
    "roof remains at the researched skyline scale",
  );
});
