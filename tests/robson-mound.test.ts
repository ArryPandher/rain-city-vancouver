import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import {
  KX,
  ORIGIN,
  pointInPoly,
  roadWidth,
  type CityData,
} from "../src/world/data";
import { ribbon, subdividePath } from "../src/world/geometry";
import { gridXZ } from "../src/world/robson-site";
import {
  fitRobsonMoundPath,
  robsonMoundGeometry,
  robsonMoundShrubs,
  robsonMoundShrubGeometry,
} from "../src/world/robson-mound";
import { broadleafVolumeGeometry } from "../src/world/broadleaf-volume";
import {
  ROBSON_MOUND_OUTLINE,
  ROBSON_MOUND_CREST,
  robsonMoundHeight,
  robsonMoundIntersects,
  robsonMoundPathClear,
} from "../src/world/robson-mound-site";

function map() {
  const d: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX;
  const oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  for (const items of [d.buildings, d.roads, d.areas])
    for (const item of items) item.pts = convert(item.pts);
  d.ocean = [];
  return d;
}

test("Robson mound retains the actual mapped woodland ring and source-bounded crest", () => {
  const d = map();
  const source = d.areas.find(
    (a) =>
      a.kind === "forest" &&
      Math.abs(a.pts[0] - ROBSON_MOUND_OUTLINE[0]) < 0.01 &&
      Math.abs(a.pts[1] - ROBSON_MOUND_OUTLINE[1]) < 0.01,
  )!;
  assert.ok(source);
  assert.equal(source.pts.length, ROBSON_MOUND_OUTLINE.length);
  for (let i = 0; i < source.pts.length; i++)
    assert.ok(Math.abs(source.pts[i] - ROBSON_MOUND_OUTLINE[i]) < 0.00001);
  let peak = 0;
  for (let x = -143; x <= -109; x += 0.5)
    for (let z = 54; z <= 102; z += 0.5) {
      const y = robsonMoundHeight(x, z);
      if (y !== undefined) {
        assert.ok(y >= 0 && y <= ROBSON_MOUND_CREST + 1e-10);
        peak = Math.max(peak, y);
      }
    }
  assert.equal(peak, ROBSON_MOUND_CREST, "smoothing retains the stated crest");
  for (let i = 0; i < source.pts.length; i += 2) {
    const j = (i + 2) % source.pts.length;
    for (let t = 0; t <= 1; t += 0.1) {
      const x = source.pts[i] * (1 - t) + source.pts[j] * t;
      const z = source.pts[i + 1] * (1 - t) + source.pts[j + 1] * t;
      assert.ok(
        (robsonMoundHeight(x, z) ?? 0) < 1e-8,
        "perimeter stays at grade",
      );
    }
  }
});

test("mound terrain and walking height agree across the lawn and planted slopes", () => {
  const geometry = robsonMoundGeometry();
  const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial());
  const collision = new CollisionWorld(map());
  mesh.updateMatrixWorld(true);
  let checked = 0,
    error = 0;
  for (let x = -142.25; x < -109; x += 1.7)
    for (let z = 54.25; z < 102; z += 1.7) {
      const h = robsonMoundHeight(x, z);
      if (h === undefined) continue;
      const hits = new T.Raycaster(
        new T.Vector3(x, 20, z),
        new T.Vector3(0, -1, 0),
      ).intersectObject(mesh);
      assert.ok(hits.length, `no terrain at ${x},${z}`);
      assert.equal(collision.groundHeight(x, z), h);
      error = Math.max(error, Math.abs(hits[0].point.y - h));
      checked++;
    }
  assert.ok(checked > 200);
  assert.ok(error < 0.045, `terrain/collision error ${error}`);
  assert.ok(
    geometry.getAttribute("position").count / 3 < 18000,
    "bounded terrain cost",
  );
  geometry.dispose();
});

test("mapped mound footways follow the same grade without changing the retained lower route", () => {
  const d = map(),
    collision = new CollisionWorld(d);
  let samples = 0,
    error = 0;
  for (const road of d.roads.filter(
    (r) =>
      robsonMoundIntersects(r.pts) &&
      ["footway", "steps", "path"].includes(r.kind),
  )) {
    const rough = ribbon(
      subdividePath(road.pts),
      roadWidth(road),
      0.07,
      (x, z) => collision.roadHeight(road, x, z),
      5,
      true,
    );
    const g = fitRobsonMoundPath(
      rough,
      (x, z) => collision.roadHeight(road, x, z),
      0.07,
    );
    const p = g.getAttribute("position"),
      ix = g.getIndex();
    for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
      const ids = ix
        ? [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)]
        : [i, i + 1, i + 2];
      const x = ids.reduce((s, j) => s + p.getX(j), 0) / 3;
      const z = ids.reduce((s, j) => s + p.getZ(j), 0) / 3;
      if (robsonMoundHeight(x, z) === undefined) continue;
      const y = ids.reduce((s, j) => s + p.getY(j), 0) / 3;
      error = Math.max(
        error,
        Math.abs(y - collision.groundHeight(x, z) - 0.07),
      );
      samples++;
    }
    g.dispose();
  }
  assert.ok(samples > 50);
  assert.ok(error < 0.02, `path interpolation error ${error}`);
  for (let u = -194; u <= -174; u += 0.2) {
    const [x, z] = gridXZ(u, -22);
    assert.equal(robsonMoundHeight(x, z), undefined);
    assert.equal(collision.blocked(x, z, 0.35), false);
  }
  for (const [u, v] of [
    [-120, -22],
    [-120, 0],
    [-140, 21],
    [-225, -52],
  ])
    assert.equal(robsonMoundHeight(...gridXZ(u, v)), undefined);
});

test("mound planting is rooted to the shared terrain and leaves mapped routes open", () => {
  const d = map(),
    shrubs = robsonMoundShrubs(d.roads);
  assert.ok(
    shrubs.length > 50 && shrubs.length < 250,
    `shrub count ${shrubs.length}`,
  );
  for (const s of shrubs) {
    assert.ok(pointInPoly(s.x, s.z, ROBSON_MOUND_OUTLINE));
    assert.equal(s.y, robsonMoundHeight(s.x, s.z));
    assert.equal(robsonMoundPathClear(s.x, s.z, d.roads, 1.45), true);
  }
});

test("mound shrubs form broad low leaf volumes with top coverage and grounded edges", () => {
  const d = map(),
    shrubs = robsonMoundShrubs(d.roads);
  const source = broadleafVolumeGeometry(true);
  let triangles = 0;
  for (const shrub of shrubs) {
    assert.ok(shrub.width > shrub.height * 1.9, "low spreading shrub envelope");
    const g = robsonMoundShrubGeometry(shrub, source);
    const p = g.getAttribute("position"),
      uv = g.getAttribute("uv");
    triangles += (g.getIndex()?.count ?? p.count) / 3;
    let top = 0,
      bottom = Infinity,
      horizontalLeaves = false;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        y = robsonMoundHeight(x, z);
      assert.notEqual(
        y,
        undefined,
        "every leaf volume stays on the mapped mound",
      );
      const rise = p.getY(i) - y!;
      top = Math.max(top, rise);
      bottom = Math.min(bottom, rise);
      assert.ok(
        Math.hypot(x - shrub.x, z - shrub.z) < 1.351,
        "volume stays within path buffer",
      );
      if (uv.getY(i) < 1 / 3) horizontalLeaves = true;
    }
    assert.ok(bottom >= 0.014 && bottom < 0.016);
    assert.ok(top > shrub.height && top < shrub.height + 0.016);
    assert.ok(
      horizontalLeaves,
      "elevated cameras see foliage across the clump top",
    );
    g.dispose();
  }
  assert.ok(triangles < 7000, `bounded leaf geometry ${triangles}`);
  source.dispose();
});
