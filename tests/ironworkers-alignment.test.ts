import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import * as T from "three";
import {
  BRIDGES,
  bridgePoint,
  bridgeSample,
  bridgeY,
  CollisionWorld,
} from "../src/world/collision";
import {
  roadWidth,
  KX,
  ORIGIN,
  type CityData,
  type Road,
} from "../src/world/data";
import { ribbon, subdividePath } from "../src/world/geometry";
import {
  IRONWORKERS_ALIGNMENT as A,
  IRONWORKERS_PLAN_LENGTH,
  IRONWORKERS_DECK_STATIONS,
  createIronworkersDeckGeometry,
  ironworkersPoint,
  ironworkersGradeT,
  ironworkersContains,
  ironworkersFrame,
  ironworkersTAtDistance,
  isIronworkersCarriageway,
} from "../src/world/ironworkers-alignment";
const bytes = fs.readFileSync(A.source),
  roads = (JSON.parse(bytes.toString()).roads as Road[]).filter((r) =>
    isIronworkersCarriageway(r.id),
  );
const bridge = BRIDGES.find((b) => b.id === "ironworkers")!;
const h = (t: number) => bridgeY(bridge, t, [4, 7]);
const deck = createIronworkersDeckGeometry(h),
  mesh = new T.Mesh(deck, new T.MeshBasicMaterial({ side: T.DoubleSide }));
mesh.updateMatrixWorld(true);
function world() {
  const data = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - data.meta.bbox[1]) * KX,
    oz = (data.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  data.buildings.forEach((b) => (b.pts = convert(b.pts)));
  data.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  data.ocean = data.ocean.map(convert);
  data.roads = JSON.parse(bytes.toString()).roads;
  return new CollisionWorld(data);
}
const collision = world();

test("every actual source carriageway strip vertex and lane car footprint fits the aligned deck", (t) => {
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    A.sha256,
  );
  assert.deepEqual(roads.map((r) => r.id).sort(), [...A.roadIds].sort());
  let vertices = 0,
    corners = 0;
  for (const r of roads) {
    const before = JSON.stringify(r),
      g = ribbon(subdividePath(r.pts), roadWidth(r), 0, () => 0, 5, true),
      p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      assert.ok(
        ironworkersContains(p.getX(i), p.getZ(i)),
        `${r.id} strip vertex outside ${p.getX(i)},${p.getZ(i)}`,
      );
      vertices++;
    }
    for (let i = 0; i < r.pts.length - 2; i += 2) {
      const ax = r.pts[i],
        az = r.pts[i + 1],
        bx = r.pts[i + 2],
        bz = r.pts[i + 3],
        length = Math.hypot(bx - ax, bz - az),
        tx = (bx - ax) / length,
        tz = (bz - az) / length,
        nx = tz,
        nz = -tx,
        n = Math.ceil(length / 3);
      for (let j = 0; j <= n; j++)
        for (const lane of [-3.6, 0, 3.6])
          for (const along of [-2.45, 2.45])
            for (const side of [-1.43, 1.43]) {
              const x =
                  ax + ((bx - ax) * j) / n + tx * along + nx * (lane + side),
                z = az + ((bz - az) * j) / n + tz * along + nz * (lane + side);
              assert.ok(
                ironworkersContains(x, z),
                `${r.id} car corner outside ${x},${z}`,
              );
              corners++;
            }
    }
    assert.equal(JSON.stringify(r), before);
    g.dispose();
  }
  t.diagnostic(
    `${vertices} road-strip vertices and ${corners} full lane-car corners contained`,
  );
});

test("deck has upward winding and matches the unchanged grade at every triangle centroid and bend", (t) => {
  const p = deck.getAttribute("position"),
    ix = deck.index!;
  let maxError = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const v = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, ix.getX(i + j)),
      ),
      n = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
    assert.ok(n.y > 0, "deck winding reversed");
    const q = v[0].clone().add(v[1]).add(v[2]).divideScalar(3),
      expected = h(ironworkersGradeT(q.x, q.z));
    maxError = Math.max(maxError, Math.abs(q.y - expected));
    assert.ok(
      Math.abs(q.y - expected) < 0.025,
      `grade mismatch ${q.toArray()} expected${expected}`,
    );
  }
  for (const c of A.controls)
    for (const side of [-17, 0, 17]) {
      // The terminal edge is Float32 geometry at kilometre-scale world X.
      // Probe13mm inside that open boundary; source way ends sit6m inside it.
      const t = Math.max(
        A.controls[0].t + 1e-5,
        Math.min(A.controls.at(-1)!.t - 1e-5, c.t),
      );
      const [x, z] = ironworkersPoint(t, side),
        y = h(ironworkersGradeT(x, z));
      const hits = new T.Raycaster(
        new T.Vector3(x, y + 0.1, z),
        new T.Vector3(0, -1, 0),
        0,
        0.2,
      ).intersectObject(mesh);
      assert.ok(hits.length, `deck bend seam at ${c.t}/${side}`);
    }
  for (let i = 1; i < IRONWORKERS_DECK_STATIONS.length - 1; i++) {
    const t = IRONWORKERS_DECK_STATIONS[i];
    for (const side of [-18, 18]) {
      const a = ironworkersPoint(t - 1e-9, side),
        b = ironworkersPoint(t + 1e-9, side);
      assert.ok(
        Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.00001,
        "offset edge cracks at shared frame",
      );
    }
  }
  assert.ok(IRONWORKERS_PLAN_LENGTH > 1316 && IRONWORKERS_PLAN_LENGTH < 1340);
  assert.ok(
    Math.abs(ironworkersFrame(ironworkersTAtDistance(500)).distance - 500) <
      1e-7,
  );
  t.diagnostic(`maximum rendered/support grade difference ${maxError}m`);
});

test("live collision supports original spawn, recovery and all source lane centres at original baseline grade", (t) => {
  assert.deepEqual(bridge.a, A.gradeA);
  assert.deepEqual(bridge.b, A.gradeB);
  const ends: [number, number] = [
    collision.groundHeight(...bridge.a),
    collision.groundHeight(...bridge.b),
  ];
  let checks = 0;
  for (const r of roads)
    for (let i = 0; i < r.pts.length - 2; i += 2) {
      const a = [r.pts[i], r.pts[i + 1]],
        b = [r.pts[i + 2], r.pts[i + 3]],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = (b[1] - a[1]) / len,
        nz = -(b[0] - a[0]) / len,
        n = Math.ceil(len / 5);
      for (let j = 0; j <= n; j++)
        for (const lane of [-3.6, 0, 3.6]) {
          const x = a[0] + ((b[0] - a[0]) * j) / n + nx * lane,
            z = a[1] + ((b[1] - a[1]) * j) / n + nz * lane,
            y = bridgeY(bridge, ironworkersGradeT(x, z), ends);
          assert.equal(collision.bridgeAt(x, z, y)?.bridge.id, "ironworkers");
          assert.ok(Math.abs(collision.height(x, z, y) - y) < 1e-8);
          assert.equal(collision.water(x, z, y), false);
          checks++;
        }
    }
  for (const [x, z] of [
    [6814.47, -945.94],
    [6820.17, -1098.83],
  ]) {
    const y = bridgeY(bridge, ironworkersGradeT(x, z), ends);
    assert.equal(collision.bridgeAt(x, z, y)?.bridge.id, "ironworkers");
    assert.equal(collision.blocked(x, z, 0.36, y), false);
  }
  // The recorded W-only123km/h tangent leaves both actual road and new deck.
  // Do not hide this with broad invisible support.
  assert.equal(ironworkersContains(6829.47, -1087.27), false);
  const [x, z] = ironworkersPoint(0.5, 19);
  assert.equal(collision.bridgeAt(x, z, 40), null);
  t.diagnostic(`${checks} source lane-centre collision/grade checks`);
});

test("other bridge paths and grade behavior remain unchanged", () => {
  const expected: Record<string, [number, number]> = {
    cambie: [363, 1590],
    granville: BRIDGES.find((b) => b.id === "granville")!.b,
    burrard: BRIDGES.find((b) => b.id === "burrard")!.b,
    lions: [-520, -4958],
  };
  for (const b of BRIDGES.filter((b) => b.id !== "ironworkers")) {
    assert.deepEqual(bridgePoint(b, 0), b.a);
    assert.deepEqual(bridgePoint(b, 1), expected[b.id]);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = bridgePoint(b, t),
        s = bridgeSample(b, ...p);
      assert.ok(s.d < 1e-8);
      assert.ok(Math.abs(s.t - t) < 1e-12);
      const old = (t: number) =>
        Math.pow(Math.sin(Math.PI * t), 1.1) * b.height;
      assert.equal(bridgeY(b, t), old(t));
    }
  }
});
