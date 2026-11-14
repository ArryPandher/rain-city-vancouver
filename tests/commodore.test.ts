import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import {
  commodore,
  commodoreFrame,
  COMMODORE_ID,
  COMMODORE_WINDOWS,
} from "../src/world/commodore";
import { Batcher } from "../src/world/geometry";
import {
  ORIGIN,
  KX,
  pointInPoly,
  segmentPoint,
  type Building,
} from "../src/world/data";
import type { Materials } from "../src/world/materials";
const ctx = { fillRect() {}, fillText() {}, strokeText() {} };
Object.defineProperty(globalThis, "document", {
  value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  },
  configurable: true,
});
function scene() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const source = data.buildings.find((b: Building) => b.id === COMMODORE_ID);
  assert.ok(source);
  const b = {
    ...source,
    pts: source.pts.map((v: number, i: number) => v / 2 - (i % 2 ? oz : ox)),
  } as Building;
  const root = new T.Group(),
    batch = new Batcher(root);
  const m = {
    texture: () => new T.Texture(),
    roof: new T.MeshStandardMaterial(),
    chrome: new T.MeshStandardMaterial(),
    neonMaterials: [],
    practicalLights: [],
  } as unknown as Materials;
  assert.equal(commodore(b, batch, m), true);
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { b, m, meshes, f: commodoreFrame(b) };
}
test("Commodore retains its mapped frontage and keeps ground-level decoration off the sidewalk", () => {
  const { b, meshes, f } = scene();
  assert.ok(f.width > 46 && f.width < 48);
  let highest = 0;
  for (const mesh of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      n = mesh.geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      highest = Math.max(highest, y);
      assert.ok(
        [x, y, z, n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite),
      );
      if (y > 3 || pointInPoly(x, z, b.pts)) continue;
      let distance = Infinity;
      for (let j = 0; j < b.pts.length; j += 2) {
        const k = (j + 2) % b.pts.length;
        distance = Math.min(
          distance,
          segmentPoint(x, z, b.pts[j], b.pts[j + 1], b.pts[k], b.pts[k + 1]).d,
        );
      }
      assert.ok(
        distance < 0.6,
        `ground detail extends ${distance.toFixed(2)} m outside the building`,
      );
    }
  }
  assert.ok(highest > 14 && highest < 17);
});
test("all eighteen Commodore arches expose recessed glass instead of a wall covering the opening", () => {
  const { meshes, f } = scene();
  for (const [px, pw, pt] of COMMODORE_WINDOWS) {
    const width = (pw / 1230) * f.width,
      bottom = f.y(277),
      spring = f.y(pt) - width / 2;
    const origin = new T.Vector3(
      ...f.point(f.x(px) + width * 0.23, bottom + (spring - bottom) * 0.22, -3),
    );
    const ray = new T.Raycaster(origin, new T.Vector3(-f.ox, 0, -f.oz), 0, 4.5);
    const first = ray.intersectObjects(meshes, false)[0];
    assert.ok(first, `no surface at window ${px}`);
    assert.equal((first.object as T.Mesh).material instanceof T.Material, true);
    assert.equal(
      ((first.object as T.Mesh).material as T.Material).name,
      "Commodore — recessed arched glazing",
      `window ${px} is occluded`,
    );
    assert.ok(
      first.distance > 3.15 && first.distance < 3.25,
      `window ${px} has no reveal depth`,
    );
  }
});

test("Commodore shop floor joins the ballroom wall without a visible horizontal gap", () => {
  const { meshes, f } = scene();
  for (const px of [405, 500, 600, 730, 870, 1000, 1100]) {
    const origin = new T.Vector3(...f.point(f.x(px), 4.8, -3));
    const ray = new T.Raycaster(origin, new T.Vector3(-f.ox, 0, -f.oz), 0, 3.5);
    assert.ok(
      ray.intersectObjects(meshes, false).length > 0,
      `open wall above storefront ${px}`,
    );
  }
});
