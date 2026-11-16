import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import clipping from "polygon-clipping";
import { CollisionWorld } from "../src/world/collision";
import { ribbon, subdividePath } from "../src/world/geometry";
import { clipRobsonStreetPaths } from "../src/world/robson-street-edge-paths";
import { roadWidth } from "../src/world/data";
import { KX, ORIGIN, pointInPoly, type CityData } from "../src/world/data";
import {
  ROBSON_STREET_EDGE as D,
  robsonStreetWorld as world,
} from "../src/world/robson-street-edge-data";
import {
  createRobsonStreetEdgeSite,
  createRobsonStreetEdgeGeometry,
} from "../src/world/robson-street-edge";
const data: CityData = JSON.parse(
  fs.readFileSync("public/data/vancouver.json", "utf8"),
);
const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
  oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
for (const b of data.buildings)
  b.pts = b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
for (const a of data.areas) {
  a.pts = a.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  a.holes = a.holes?.map((r) => r.map((v, i) => v / 2 - (i % 2 ? oz : ox)));
}
data.ocean = data.ocean.map((r) => r.map((v, i) => v / 2 - (i % 2 ? oz : ox)));
data.trees = data.trees.map((v, i) => v / 2 - (i % 2 ? oz : ox));
data.roads = JSON.parse(
  fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
).roads;
data.publicTrees = JSON.parse(
  fs.readFileSync("public/data/vancouver-public-trees.json", "utf8"),
);
const baseline = (x: number, z: number) => 0.4 + 0.0012 * x - 0.0008 * z;
const before = JSON.stringify(data),
  site = createRobsonStreetEdgeSite(data, baseline)!;
const geometry = createRobsonStreetEdgeGeometry(site),
  group = new T.Group();
for (const g of Object.values(geometry))
  group.add(new T.Mesh(g, new T.MeshBasicMaterial({ side: T.FrontSide })));
group.updateMatrixWorld(true);
const near = (a: number, b: number, e = 0.0001) =>
  assert.ok(Math.abs(a - b) < e, `${a} versus ${b}`);
const area = (multi: number[][][][]) =>
  multi.reduce(
    (sum, p) =>
      sum +
      p.reduce(
        (sum, r, i) =>
          sum +
          ((i ? -1 : 1) *
            Math.abs(
              r.reduce(
                (a, v, j) =>
                  a +
                  v[0] * r[(j + 1) % r.length][1] -
                  v[1] * r[(j + 1) % r.length][0],
                0,
              ),
            )) /
            2,
        0,
      ),
    0,
  );
test("exact local source gate; roads, buildings and retained City trees are not mutated", () => {
  assert.ok(site);
  assert.equal(JSON.stringify(data), before);
  assert.equal(
    createRobsonStreetEdgeSite(
      { ...data, roads: data.roads.filter((r) => r.id !== D.roadIds[0]) },
      baseline,
    ),
    undefined,
  );
  assert.ok(
    site.triangles.length > 1000 && site.triangles.length < 60000,
    `${site.triangles.length}`,
  );
  assert.ok(site.trees.length >= 4, `${site.trees.length}`);
  for (const mask of Object.values(site.masks)) {
    near(area(clipping.intersection(mask, site.roadPlan)), 0, 0.0001);
    near(area(clipping.intersection(mask, site.protectedPlan)), 0, 0.0001);
    near(area(clipping.intersection(mask, site.protectedGarden)), 0, 0.0001);
    near(area(clipping.difference(mask, site.boundary)), 0, 0.0001);
  }
});
test("FrontSide downward rays hit the same Float32 upward triangles used for walking support", () => {
  let tested = 0;
  for (let i = 0; i < site.triangles.length; i += 17) {
    const t = site.triangles[i],
      c = t.points
        .reduce((a, p) => a.add(new T.Vector3(...p)), new T.Vector3())
        .multiplyScalar(1 / 3);
    const normal = new T.Vector3(...t.points[1])
      .sub(new T.Vector3(...t.points[0]))
      .cross(new T.Vector3(...t.points[2]).sub(new T.Vector3(...t.points[0])))
      .normalize();
    assert.ok(normal.y > 0.94, `${i}: ${normal.toArray()}`);
    const hit = new T.Raycaster(
      new T.Vector3(c.x, 3, c.z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(group, true)[0];
    assert.ok(hit, `invisible upward triangle ${i}`);
    near(hit.point.y, c.y);
    near(site.height(c.x, c.z)!, hit.point.y);
    tested++;
  }
  assert.ok(tested > 100);
});
test("recessed tree openings are closed below the retained stem with outward reveals, not painted dark squares", () => {
  for (const tree of site.trees) {
    assert.ok(
      data.publicTrees!.trees.some(
        (t) =>
          t[0] === tree.id && t[1] === tree.point[0] && t[2] === tree.point[1],
      ),
    );
    assert.ok(
      !site.masks.sidewalk.some(
        (p) =>
          pointInPoly(...tree.point, p[0].flat()) &&
          !p.slice(1).some((h) => pointInPoly(...tree.point, h.flat())),
      ),
    );
    const floor = site.height(...tree.point)!;
    near(floor, baseline(...tree.point) + D.roadFinish);
    const hit = new T.Raycaster(
      new T.Vector3(tree.point[0], 3, tree.point[1]),
      new T.Vector3(0, -1, 0),
    ).intersectObject(group, true)[0];
    assert.ok(hit);
    near(hit.point.y, floor);
  }
  let tested = 0;
  for (let i = 0; i < site.sides.length; i += 7) {
    const f = site.sides[i],
      c = f
        .reduce((a, p) => a.add(new T.Vector3(...p)), new T.Vector3())
        .multiplyScalar(0.25);
    if (Math.abs(f[0][1] - f[3][1]) < 0.04) continue;
    const n = new T.Vector3(...f[1])
      .sub(new T.Vector3(...f[0]))
      .cross(new T.Vector3(...f[2]).sub(new T.Vector3(...f[0])))
      .normalize();
    const hit = new T.Raycaster(
      c.clone().addScaledVector(n, 0.08),
      n.clone().negate(),
      0,
      0.09,
    ).intersectObject(group, true)[0];
    assert.ok(hit, `culled side ${i}`);
    tested++;
  }
  assert.ok(tested > 15);
});
test("plaza, bikeway, service exit and garden/well support remain outside this provider", () => {
  for (const id of D.protectedIds) {
    const r = data.roads.find((r) => r.id === id)!;
    for (let i = 0; i < r.pts.length - 2; i += 2)
      for (let j = 0; j <= 10; j++) {
        const x = r.pts[i] + ((r.pts[i + 2] - r.pts[i]) * j) / 10,
          z = r.pts[i + 1] + ((r.pts[i + 3] - r.pts[i + 1]) * j) / 10;
        assert.equal(site.height(x, z), undefined, `${id}: ${x},${z}`);
      }
  }
  for (const [u, v] of [
    [0, 20],
    [-50, 0],
    [45, 0],
    [0, -45],
  ])
    assert.equal(site.height(...world(u, v)), undefined);
  for (const tri of site.triangles)
    for (const p of tri.points) assert.ok(p.every(Number.isFinite));
});

test("integrated real-datum support matches visible finish; protected road buffers and all well/mound contact remain unchanged", () => {
  const collision = new CollisionWorld(data),
    actual = collision.robsonStreetEdge!;
  assert.ok(actual);
  const parts = createRobsonStreetEdgeGeometry(actual),
    root = new T.Group();
  for (const g of Object.values(parts))
    root.add(new T.Mesh(g, new T.MeshBasicMaterial({ side: T.FrontSide })));
  root.updateMatrixWorld(true);
  for (let i = 0; i < actual.triangles.length; i += 41) {
    const tri = actual.triangles[i],
      x = tri.points.reduce((s, p) => s + p[0], 0) / 3,
      z = tri.points.reduce((s, p) => s + p[2], 0) / 3;
    const hit = new T.Raycaster(
      new T.Vector3(x, 30, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(root, true)[0];
    assert.ok(hit);
    near(collision.walkingHeight(x, z), hit.point.y);
    near(collision.height(x, z), hit.point.y);
  }
  for (const id of [...D.protectedIds, ...D.roadIds]) {
    const r = data.roads.find((r) => r.id === id)!;
    const g = ribbon(subdividePath(r.pts), roadWidth(r), 0.092, (x, z) =>
      collision.roadHeight(r, x, z),
    );
    assert.equal(
      clipRobsonStreetPaths(g, actual, r),
      g,
      `${id} original geometry identity`,
    );
    g.dispose();
  }
  let cut = 0;
  for (const r of data.roads.filter(
    (r) => r.kind === "footway" && !r.crossing,
  )) {
    if (
      !r.pts.some(
        (x, i) => i % 2 === 0 && actual.height(x, r.pts[i + 1]) !== undefined,
      )
    )
      continue;
    const g = ribbon(subdividePath(r.pts), roadWidth(r), 0.07, (x, z) =>
      collision.roadHeight(r, x, z),
    );
    const result = clipRobsonStreetPaths(g, actual, r);
    if (result !== g) cut++;
    const p = result.getAttribute("position"),
      ix = result.index;
    for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map((k) => (ix ? ix.getX(i + k) : i + k)),
        x = ids.reduce((s, id) => s + p.getX(id), 0) / 3,
        z = ids.reduce((s, id) => s + p.getZ(id), 0) / 3;
      assert.equal(
        actual.height(x, z),
        undefined,
        "old path must not cover new finish",
      );
    }
    result.dispose();
  }
  assert.ok(cut >= 2);
});
