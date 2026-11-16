import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { clipRobsonGardenPaths } from "../src/world/robson-garden-paths";
import { Batcher, ribbon } from "../src/world/geometry";
import { robsonSquare } from "../src/world/robson-square";
import {
  gridXZ,
  ROBSON_GARDEN_ID,
  ROBSON_LOWER_STAIR,
  robsonHeight,
} from "../src/world/robson-site";
import {
  KX,
  ORIGIN,
  roadWidth,
  pointInPoly,
  segmentPoint,
  type Building,
  type CityData,
  type Road,
} from "../src/world/data";

function garden() {
  const d: CityData = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  );
  const b = d.buildings.find((b) => b.id === ROBSON_GARDEN_ID)!;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  b.pts = b.pts.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  return b;
}
const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
const mesh = (g: T.BufferGeometry) => {
  const m = new T.Mesh(g, mat);
  m.updateMatrixWorld(true);
  return m;
};

test("actual Robson footway overlays disappear while the same native camera rays hit custom support", () => {
  const b = garden(),
    h = (x: number, z: number) => robsonHeight(x, z, b.pts) ?? 0;
  const roads: Road[] = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  const selected = roads.filter((r) =>
    ["w600962365", "w991569421", "w297295138"].includes(r.id ?? ""),
  );
  assert.equal(selected.length, 3);
  const before: T.Mesh[] = [],
    after: T.Mesh[] = [];
  for (const r of selected) {
    const g = ribbon(r.pts, roadWidth(r), 0.07, h);
    before.push(mesh(g.clone()));
    const clipped = clipRobsonGardenPaths(g, b, h, 0.07, r);
    assert.notEqual(clipped, g);
    after.push(mesh(clipped));
  }
  const root = new T.Group(),
    batch = new Batcher(root);
  robsonSquare(b, batch, {
    concrete: mat,
    texture: () => new T.Texture(),
  } as any);
  const custom = batch.finish();
  root.updateMatrixWorld(true);
  const geometryBefore = custom.map((m) =>
    Array.from(m.geometry.getAttribute("position").array),
  );
  const camera = new T.PerspectiveCamera(62, 821 / 839, 0.1, 24000);
  camera.position.set(-145.8943919801504, 3.37, 127.92436055962261);
  camera.lookAt(
    camera.position
      .clone()
      .add(
        new T.Vector3(
          Math.sin(2.3554594283507932) * 20,
          -Math.sin(0.19) * 20,
          Math.cos(2.3554594283507932) * 20,
        ),
      ),
  );
  camera.updateMatrixWorld(true);
  for (const [x, y] of [
    [410, 780],
    [600, 780],
    [280, 460],
    [420, 420],
  ]) {
    const r = new T.Raycaster();
    r.setFromCamera(
      new T.Vector2((x / 821) * 2 - 1, 1 - (y / 839) * 2),
      camera,
    );
    const old = r.intersectObjects([...before, ...custom])[0];
    assert.ok(
      before.includes(old.object as T.Mesh),
      `old path really hides support at ${x},${y}`,
    );
    const hit = r.intersectObjects([...after, ...custom])[0];
    assert.ok(
      custom.includes(hit.object as T.Mesh),
      `custom support remains visible at ${x},${y}`,
    );
  }
  const s = ROBSON_LOWER_STAIR;
  for (let i = 0; i < s.steps; i++)
    for (const v of [s.minV + 0.15, (s.minV + s.maxV) / 2, s.maxV - 0.15]) {
      const u = s.startU + ((i + 0.5) * (s.endU - s.startU)) / s.steps,
        [x, z] = gridXZ(u, v);
      const r = new T.Raycaster(
        new T.Vector3(x, 20, z),
        new T.Vector3(0, -1, 0),
      );
      assert.equal(
        r.intersectObjects(after).length,
        0,
        "all actual custom treads remain free of generic overlays",
      );
      const hit = r.intersectObjects(custom)[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - h(x, z)) < 0.002);
    }
  custom.forEach((m, i) =>
    assert.deepEqual(
      Array.from(m.geometry.getAttribute("position").array),
      geometryBefore[i],
    ),
  );
  let exteriorSamples = 0,
    seamSamples = 0;
  for (const road of selected)
    for (let j = 2; j < road.pts.length; j += 2) {
      const ax = road.pts[j - 2],
        az = road.pts[j - 1],
        bx = road.pts[j],
        bz = road.pts[j + 1];
      const count = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
      for (let k = 0; k <= count; k++) {
        const x = ax + ((bx - ax) * k) / count,
          z = az + ((bz - az) * k) / count;
        if (pointInPoly(x, z, b.pts)) continue;
        let edge = Infinity;
        for (let v = 0; v < b.pts.length; v += 2) {
          const w = (v + 2) % b.pts.length;
          edge = Math.min(
            edge,
            segmentPoint(x, z, b.pts[v], b.pts[v + 1], b.pts[w], b.pts[w + 1])
              .d,
          );
        }
        if (edge < 0.02) continue;
        const r = new T.Raycaster(
          new T.Vector3(x, 20, z),
          new T.Vector3(0, -1, 0),
        );
        const old = r.intersectObjects(before)[0],
          next = r.intersectObjects(after)[0];
        if (!old) continue;
        assert.ok(
          next,
          "the actual mapped route continues outside the owned garden",
        );
        assert.ok(
          Math.abs(next.point.y - old.point.y) < 0.09,
          "outside route retains height across the cut",
        );
        exteriorSamples++;
        if (edge < 0.5) seamSamples++;
      }
    }
  assert.ok(exteriorSamples > 20);
  assert.ok(seamSamples > 0, "sample the actual path/garden cut boundary");
});

test("polygon boundary keeps both exterior routes, interpolated UVs and supported new endpoints", () => {
  // Deliberately concave ownership exercises more than the separate stair rectangle.
  const b: Building = {
    id: ROBSON_GARDEN_ID,
    pts: [0, 0, 6, 0, 6, 2, 3, 2, 3, 6, 0, 6],
  };
  const h = (x: number) => (x < 0 || x > 6 ? 0 : 1);
  const g = ribbon([-3, 1, 2, 1, 9, 1], 1, 0.07, h);
  const before = Array.from(g.getAttribute("position").array);
  const clipped = clipRobsonGardenPaths(g, b, h, 0.07, { kind: "footway" }),
    m = mesh(clipped);
  const ray = (x: number, z: number) =>
    new T.Raycaster(
      new T.Vector3(x, 10, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(m);
  assert.equal(ray(2, 1).length, 0);
  assert.ok(ray(-2, 1).length);
  assert.ok(ray(8, 1).length);
  const pocket = mesh(
    clipRobsonGardenPaths(ribbon([-2, 4, 8, 4], 1, 0.07), b, () => 0, 0.07, {
      kind: "footway",
    }),
  );
  assert.ok(
    new T.Raycaster(
      new T.Vector3(5, 10, 4),
      new T.Vector3(0, -1, 0),
    ).intersectObject(pocket).length,
    "concave exterior pocket is not clipped as a bounding box",
  );
  const p = clipped.getAttribute("position"),
    uv = clipped.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)));
    if (Math.abs(p.getX(i)) < 1e-6 || Math.abs(p.getX(i) - 6) < 1e-6)
      assert.ok(Math.abs(p.getY(i) - (h(p.getX(i)) + 0.07)) < 1e-6);
  }
  assert.deepEqual(
    Array.from(g.getAttribute("position").array),
    before,
    "input vertices never rewritten",
  );
  for (const road of [
    { kind: "primary" },
    { kind: "footway", walkway: true },
  ]) {
    const original = ribbon([-3, 1, 9, 1], 1, 0.07, h);
    assert.equal(clipRobsonGardenPaths(original, b, h, 0.07, road), original);
  }
  const far = ribbon([500, 500, 510, 500], 2, 0.07);
  assert.equal(clipRobsonGardenPaths(far, b, h, 0.07, { kind: "steps" }), far);
  assert.equal(
    clipRobsonGardenPaths(far, undefined, h, 0.07, { kind: "steps" }),
    far,
  );
});
