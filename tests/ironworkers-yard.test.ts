import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import {
  IRONWORKERS_YARD as d,
  createIronworkersYardGeometry,
  createIronworkersYardAssembly,
  preflightIronworkersYard,
  ironworkersYardPoint,
} from "../src/world/ironworkers-yard";
import { Batcher } from "../src/world/geometry";
import { segmentPoint, roadWidth, type Building } from "../src/world/data";
const bytes = fs.readFileSync(d.source),
  source = JSON.parse(bytes.toString()),
  buildings: Building[] = source.buildings,
  b = buildings.find((b) => b.id === d.id)!;
const g = createIronworkersYardGeometry();
const count = () =>
  Object.values(g).reduce(
    (n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3,
    0,
  );
test("exact real workshop source ring gates one replacement, preserves source and nearby generic buildings", () => {
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    d.sha256,
  );
  assert.ok(preflightIronworkersYard(buildings));
  const original = JSON.stringify(source);
  const batch = new Batcher(new T.Group(), 270);
  batch.offsetY = 3;
  const dispatch = createIronworkersYardAssembly(buildings);
  assert.equal(buildings.filter((b) => dispatch(b, batch)).length, 1);
  assert.equal(dispatch(b, batch), true);
  assert.equal(batch.offsetY, 3);
  const chunks = batch.finish();
  assert.equal(chunks.length, 4);
  assert.equal(
    chunks.reduce((n, m) => n + m.geometry.index!.count / 3, 0),
    count(),
  );
  for (const m of chunks) {
    const c = m.userData.center;
    assert.ok(Math.hypot(c[0] - 6884.6, c[1] + 1946.375) < 200);
    m.geometry.computeBoundingBox();
    assert.ok(m.geometry.boundingBox!.min.y >= 3 - 1e-5);
  }
  assert.equal(JSON.stringify(source), original);
  for (const change of ["missing", "duplicate", "ring", "height", "kind"]) {
    const bs = structuredClone([b]);
    if (change === "missing") bs.pop();
    if (change === "duplicate") bs.push(bs[0]);
    if (change === "ring") bs[0].pts[0] += 0.01;
    if (change === "height") bs[0].height = 12;
    if (change === "kind") bs[0].kind = "warehouse";
    assert.equal(preflightIronworkersYard(bs), false);
    const empty = new Batcher(new T.Group());
    assert.equal(createIronworkersYardAssembly(bs)(b, empty), false);
    assert.equal(empty.groups.size, 0);
  }
});
test("closed source shell and gable face outward; ridge and roof contact have no open edges", () => {
  const edges = new Map<string, number>();
  for (const geo of [g.walls, g.roof]) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const ps = Array.from({ length: 3 }, (_, j) =>
        new T.Vector3().fromBufferAttribute(p, i + j),
      );
      for (let j = 0; j < 3; j++) {
        const key = [ps[j], ps[(j + 1) % 3]]
          .map((p) => p.toArray().join(","))
          .sort()
          .join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  }
  assert.ok([...edges.values()].every((n) => n === 2));
  const meshes = [g.walls, g.roof].map((g) => {
    const m = new T.Mesh(g, new T.MeshBasicMaterial());
    m.updateMatrixWorld(true);
    return m;
  });
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9])
    for (const t of [0.1, 0.5, 0.9]) {
      const [x, , z] = ironworkersYardPoint(u, t, 0),
        ray = new T.Raycaster(new T.Vector3(x, 25, z), new T.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(meshes);
      assert.ok(hits.length);
      assert.ok(
        Math.abs(
          hits[0].point.y -
            (d.eave + (1 - Math.abs(u - 0.5) * 2) * (d.ridge - d.eave)),
        ) < 0.01,
      );
    }
  const [x, , z] = ironworkersYardPoint(0.5, 0.5, 0);
  assert.ok(
    new T.Raycaster(
      new T.Vector3(x, -2, z),
      new T.Vector3(0, 1, 0),
    ).intersectObjects(meshes).length,
  );
  assert.ok(count() < 2400, `bounded cost ${count()}`);
});
test("every authored vertex stays beside actual source road corridor and inside bounded yard envelope", () => {
  const roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const road = roads.find((r: any) => r.id === "w1265138308");
  assert.ok(road);
  let minimum = Infinity;
  for (const geo of Object.values(g)) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      assert.ok(x >= 6865.4 && x <= 6903.8 && z >= -1971.2 && z <= -1921.3);
      assert.ok(y >= -1e-6 && y < 9.8);
      for (let j = 2; j < road.pts.length; j += 2)
        minimum = Math.min(
          minimum,
          segmentPoint(
            x,
            z,
            road.pts[j - 2],
            road.pts[j - 1],
            road.pts[j],
            road.pts[j + 1],
          ).d,
        );
    }
  }
  assert.ok(
    minimum > roadWidth(road) / 2 + 1,
    `service road centre clearance ${minimum}`,
  );
  assert.equal(
    source.buildings.find((x: Building) => x.id === "w23776220").pts.length,
    12,
  );
});
