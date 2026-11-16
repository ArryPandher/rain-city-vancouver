import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { World } from "../src/world/world";
import { CollisionWorld, BRIDGES, bridgePoint } from "../src/world/collision";
import { Materials } from "../src/world/materials";
import { type CityData, type Road, roadWidth } from "../src/world/data";
import { ribbon } from "../src/world/geometry";
import {
  createIronworkersPathBoundary,
  IRONWORKERS_PATH,
} from "../src/world/ironworkers-path-boundary";
import {
  createIronworkersApproachClipper,
  IRONWORKERS_APPROACH_IDS,
} from "../src/world/ironworkers-approach-finish";
import { ironworkersPedestrianRoad } from "../src/game/ironworkers-pedestrians";
import { pointOnRoad, advanceRoadCursor } from "../src/game/road-placement";
import {
  ironworkersPoint,
  IRONWORKERS_ALIGNMENT as A,
} from "../src/world/ironworkers-alignment";
const sourceRoads = JSON.parse(fs.readFileSync(A.source, "utf8"))
  .roads as Road[];
function fixture(
  roads = sourceRoads.filter((r) =>
    r.pts.some(
      (x, i) =>
        i % 2 === 0 &&
        x > 6720 &&
        x < 6870 &&
        r.pts[i + 1] < -900 &&
        r.pts[i + 1] > -2350,
    ),
  ),
) {
  const data = {
      ...JSON.parse(fs.readFileSync("public/data/vancouver.json", "utf8")),
      roads,
      buildings: [],
      areas: [],
      ocean: [],
    } as CityData,
    collision = new CollisionWorld(data),
    bridge = BRIDGES.find((b) => b.id === "ironworkers")!,
    boundary = createIronworkersPathBoundary(
      (t) => collision.bridgeHeight(bridge, t),
      (x, z) => collision.groundHeight(x, z) + 0.07,
    ),
    materials = Object.create(Materials.prototype) as Materials;
  materials.texture = () => new T.Texture();
  for (const key of ["concrete", "stone", "asphalt", "yellow"] as const)
    materials[key] = new T.MeshStandardMaterial({ name: key });
  const world = () =>
    Object.assign(Object.create(World.prototype), {
      data,
      collision,
      materials,
      root: new T.Group(),
      chunks: [],
      stats: { roads: 0 },
      weather: "day",
    }) as World;
  return { data, collision, boundary, world };
}
const f = fixture(),
  before = JSON.stringify(f.data.roads);
f.collision.ironworkersPaths = f.boundary;
function down(objects: T.Object3D[], x: number, z: number, y = 100) {
  objects.forEach((o) => o.updateMatrixWorld(true));
  return new T.Raycaster(
    new T.Vector3(x, y, z),
    new T.Vector3(0, -1, 0),
  ).intersectObjects(objects, true);
}

test("actual World.roads leaves all carriageway vertices/attributes unchanged and substitutes only bridge cycleway finishes", () => {
  const f = fixture(sourceRoads.filter((r) => A.roadIds.includes(r.id!))),
    a = f.world();
  a.roads();
  f.collision.ironworkersPaths = f.boundary;
  const b = f.world();
  b.roads();
  const arrays = (w: World) =>
    w.chunks.map((m) =>
      Object.fromEntries(
        Object.entries(m.geometry.attributes).map(([k, v]) => [
          k,
          Array.from(v.array),
        ]),
      ),
    );
  assert.deepEqual(arrays(a), arrays(b));
  const oldRoutes = sourceRoads.filter((r) =>
      IRONWORKERS_PATH.replacedCycleways.some((id) => id === r.id),
    ),
    p = fixture(oldRoutes),
    old = p.world();
  old.roads();
  assert.ok(old.chunks.length);
  p.collision.ironworkersPaths = p.boundary;
  const current = p.world();
  current.roads();
  assert.equal(current.chunks.length, 0);
  assert.deepEqual(p.data.roads, oldRoutes);
});

test("actual World.roads approach cuts meet rendered candidate finishes without duplicate coplanar tops", () => {
  const roads = sourceRoads.filter((r) => IRONWORKERS_APPROACH_IDS.has(r.id!)),
    p = fixture(roads),
    old = p.world();
  old.roads();
  p.collision.ironworkersPaths = p.boundary;
  const current = p.world();
  current.roads();
  const candidate = p.boundary.createRenderGroup(
      new T.MeshBasicMaterial({ side: T.DoubleSide }),
      new T.MeshBasicMaterial(),
    ),
    path = candidate.group.children[0];
  let overlaps = 0,
    seams = 0;
  for (const tie of p.boundary.ties) {
    for (let i = 1; i < tie.sections.length - 1; i++) {
      const a = tie.sections[i][0],
        b = tie.sections[i][1],
        x = (a[0] + b[0]) / 2,
        z = (a[2] + b[2]) / 2;
      const hits = down(current.chunks, x, z);
      assert.equal(
        hits.length,
        0,
        `old finish overlaps ${tie.source} ${x},${z}`,
      );
      const hit = down([path], x, z)[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - p.collision.height(x, z)) < 1e-5);
      overlaps++;
    }
    // The mapped endpoint is shared with the retained approach. Sample on both sides of it.
    const q = tie.point,
      end = tie.centres.at(-2)!,
      dx = q[0] - end[0],
      dz = q[1] - end[1],
      length = Math.hypot(dx, dz);
    for (const sign of [-1, 1]) {
      const x = q[0] + ((sign * dx) / length) * 0.03,
        z = q[1] + ((sign * dz) / length) * 0.03,
        hits = down([...current.chunks, path], x, z);
      assert.ok(hits.length, `seam hole ${tie.source}/${sign}`);
      assert.ok(Math.abs(hits[0].point.y - 0.07) < 1e-5);
      seams++;
    }
  }
  assert.ok(overlaps > 50 && seams === 8);
  // Outside the cut, actual old and new rendered heights agree.
  for (const r of roads)
    for (let i = 0; i < r.pts.length; i += 2) {
      const x = r.pts[i],
        z = r.pts[i + 1];
      if (p.boundary.supportAt(x, z) !== undefined) continue;
      const a = down(old.chunks, x, z)[0],
        b = down(current.chunks, x, z)[0];
      if (a && b) assert.ok(Math.abs(a.point.y - b.point.y) < 0.001);
    }
});

test("live collision stops finite fence/curb crossings, supports visible path, and preserves other bridges", () => {
  for (const sign of [-1, 1])
    for (const t of [0.1, 0.5, 0.9]) {
      const [x, z] = ironworkersPoint(t, sign * 16.55),
        y = f.collision.height(x, z);
      assert.equal(y, f.boundary.supportAt(x, z));
      assert.equal(f.collision.blocked(x, z, 0.4, y), false);
      assert.equal(f.collision.water(x, z, y), false);
      const frame = ironworkersPoint(t, sign * 20),
        move = f.collision.move(x, z, frame[0] - x, frame[1] - z, 0.36, y);
      assert.equal(move.hit, true);
      assert.ok(Math.hypot(move.x - frame[0], move.z - frame[1]) > 1);
      const curb = ironworkersPoint(t, sign * 14),
        toCurb = f.collision.move(x, z, curb[0] - x, curb[1] - z, 0.36, y);
      assert.equal(toCurb.hit, true);
      const fence = ironworkersPoint(t, sign * 17.85);
      assert.equal(f.collision.cameraBlocked(...fence, 0.18, y + 1.8), true);
      assert.equal(f.collision.cameraBlocked(...fence, 0.18, y + 3.3), false);
      assert.equal(f.collision.cameraBlocked(...fence, 0.18, y - 0.4), false);
    }
  const base = new CollisionWorld(f.data);
  for (const bridge of BRIDGES.filter((b) => b.id !== "ironworkers"))
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const [x, z] = bridgePoint(bridge, t);
      assert.equal(f.collision.height(x, z), base.height(x, z));
      assert.equal(f.collision.blocked(x, z, 0.5), base.blocked(x, z, 0.5));
    }
  assert.equal(JSON.stringify(f.data.roads), before);
});

test("only two pedestrian routes remap; full walking cursor stays supported and clear through path/tie transitions", () => {
  let samples = 0;
  for (const source of sourceRoads) {
    const mapped = ironworkersPedestrianRoad(source, f.boundary);
    if (!IRONWORKERS_PATH.replacedCycleways.some((id) => id === source.id)) {
      assert.equal(mapped, source);
      continue;
    }
    assert.notEqual(mapped, source);
    assert.equal(ironworkersPedestrianRoad(source, f.boundary), mapped);
    assert.equal(mapped.width, 2.5);
    const snapshot = JSON.stringify(source);
    let cursor = { segment: 0, t: 0, direction: 1 };
    for (let distance = 0; distance < 1400; distance += 0.7) {
      for (const side of [-0.45, 0.45]) {
        const p = pointOnRoad(mapped, cursor.segment, cursor.t, side),
          y = f.collision.height(p.x, p.z);
        assert.ok(
          f.boundary.supportAt(p.x, p.z) !== undefined,
          `missing ${source.id}/${distance}`,
        );
        assert.equal(
          f.collision.blocked(p.x, p.z, 0.3),
          false,
          `blocked ${source.id}/${distance}`,
        );
        assert.ok(Math.abs(y - f.boundary.supportAt(p.x, p.z)!) < 1e-8);
        samples++;
      }
      cursor = advanceRoadCursor(mapped, cursor, 0.7);
    }
    assert.equal(JSON.stringify(source), snapshot);
  }
  assert.ok(samples > 7000);
});
