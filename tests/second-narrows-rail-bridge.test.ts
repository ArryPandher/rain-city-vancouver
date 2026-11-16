import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { Batcher } from "../src/world/geometry";
import { geo, type Building } from "../src/world/data";
import { ironworkersSample } from "../src/world/ironworkers-alignment";
import {
  SECOND_NARROWS_RAIL as S,
  SECOND_NARROWS_RAIL_LENGTH as length,
  SECOND_NARROWS_TOWER_STATIONS as stations,
  secondNarrowsRailPoint as point,
  preflightSecondNarrowsRail,
  createSecondNarrowsRailGeometry,
  createSecondNarrowsRailAssembly,
} from "../src/world/second-narrows-rail-bridge";
const city = JSON.parse(
  fs.readFileSync("public/data/vancouver-east.json", "utf8"),
);
const metadata = JSON.parse(
  fs.readFileSync("public/data/vancouver-building-tags.json", "utf8"),
);
const buildings: Building[] = city.buildings.map((building: Building) => {
  const attrs = metadata.buildings?.[building.id];
  return attrs
    ? { ...building, ...attrs, levels: building.levels ?? attrs.levels }
    : building;
});
const parts = createSecondNarrowsRailGeometry();
const group = new T.Group();
for (const part of parts)
  group.add(new T.Mesh(part.geometry, new T.MeshBasicMaterial()));
group.updateMatrixWorld(true);

test("exact retained pair gates replacement atomically; no unrelated shells or source data are changed", () => {
  assert.ok(preflightSecondNarrowsRail(buildings));
  assert.ok(
    preflightSecondNarrowsRail(city.buildings),
    "metadata-load fallback is equally valid",
  );
  const changedHeight = structuredClone(buildings);
  changedHeight.find((b) => b.id === S.towers[0].id)!.height = 31;
  assert.equal(preflightSecondNarrowsRail(changedHeight), false);
  for (const id of S.towers.map((b) => b.id)) {
    assert.equal(
      preflightSecondNarrowsRail(buildings.filter((b) => b.id !== id)),
      false,
    );
    const changed = structuredClone(buildings);
    changed.find((b) => b.id === id)!.pts[0] += 0.01;
    assert.equal(preflightSecondNarrowsRail(changed), false);
    assert.equal(
      preflightSecondNarrowsRail([
        ...buildings,
        buildings.find((b) => b.id === id)!,
      ]),
      false,
    );
  }
  const before = JSON.stringify(city),
    parent = new T.Group(),
    batch = new Batcher(parent, 270);
  const assembly = createSecondNarrowsRailAssembly(buildings);
  assert.deepEqual(
    buildings
      .filter((b) => assembly(b, batch))
      .map((b) => b.id)
      .sort(),
    S.towers.map((b) => b.id).sort(),
  );
  const pending = [...batch.groups.values()].reduce(
    (n, b) => n + b.geo.length,
    0,
  );
  for (const b of S.towers) assert.ok(assembly(b, batch));
  assert.equal(
    [...batch.groups.values()].reduce((n, b) => n + b.geo.length, 0),
    pending,
  );
  const chunks = batch.finish();
  assert.equal(
    new Set(chunks.map((m) => (m.material as T.Material).uuid)).size,
    4,
  );
  assert.ok(chunks.length <= 12, `${chunks.length} draw chunks`);
  assert.ok(
    chunks.every(
      (m) => m.userData.center[0] > 6800 && m.userData.center[1] < -1000,
    ),
  );
  assert.ok(chunks.every((m) => m.castShadow && m.receiveShadow));
  assert.equal(JSON.stringify(city), before);
});

test("rail centres retain geographic controls, gauge and published span constraints", () => {
  let station = 0;
  for (let i = 0; i < S.railGeo.length; i++) {
    const p = S.railPoints[i];
    if (i)
      station += Math.hypot(
        p[0] - S.railPoints[i - 1][0],
        p[1] - S.railPoints[i - 1][1],
      );
    const expected = geo(S.railGeo[i].lat, S.railGeo[i].lon);
    const actual = point(station);
    assert.ok(
      Math.hypot(actual[0] - expected[0], actual[2] - expected[1]) < 1e-6,
    );
    const a = point(station, -0.7175),
      b = point(station, 0.7175);
    assert.ok(Math.abs(Math.hypot(a[0] - b[0], a[2] - b[2]) - 1.435) < 1e-9);
  }
  assert.ok(length > 650 && length < 665);
  assert.ok(Math.abs(stations[1] - stations[0] - 152.4) < 0.6);
  assert.ok(
    stations[1] - stations[0] - 14 > 137,
    "fender gap agrees with official137m clearance",
  );
  const peakTrussY = S.elevation.railTop - 0.3 + 10.5 + 0.4;
  const lowerDeckY = S.elevation.railTop - 0.3 - 0.55 - 0.4;
  assert.ok(
    46 + peakTrussY - lowerDeckY < S.elevation.frameTop,
    "raised46m underside plus real truss depth must fit below machinery house",
  );
});

test("actual geometry stays finite, modest and far clear of highway driving/walking contacts", () => {
  let triangles = 0,
    minDistance = Infinity;
  for (const p of parts) {
    const a = p.geometry.getAttribute("position"),
      n = p.geometry.getAttribute("normal");
    triangles += p.geometry.index!.count / 3;
    for (let i = 0; i < a.count; i++) {
      assert.ok(Number.isFinite(a.getX(i) + a.getY(i) + a.getZ(i)));
      assert.ok(a.getY(i) >= -1.01 && a.getY(i) <= 64.01);
      assert.ok(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > 0.99);
      minDistance = Math.min(
        minDistance,
        ironworkersSample(a.getX(i), a.getZ(i)).d,
      );
    }
  }
  assert.ok(triangles < 40000, `${triangles} triangles`);
  assert.ok(
    minDistance > 95,
    `${minDistance}m minimum highway centreline separation`,
  );
  for (let s = 0; s <= length; s += 2.5) {
    const p = point(s, 0, 13.5);
    assert.equal(
      new T.Raycaster(
        new T.Vector3(...p),
        new T.Vector3(0, 1, 0),
        0,
        4,
      ).intersectObject(group).length,
      0,
      `rail corridor obstructed at${s}`,
    );
  }
});

test("tower mid-height is open lattice; real piers and drive houses remain closed solids", () => {
  for (const s of stations) {
    let open = 0,
      samples = 0;
    for (let y = 32; y < 38; y += 0.7)
      for (let z = -3; z <= 3; z += 0.6) {
        const a = new T.Vector3(...point(s + z, -15, y)),
          b = new T.Vector3(...point(s + z, 15, y));
        const hits = new T.Raycaster(
          a,
          b.sub(a).normalize(),
          0,
          30,
        ).intersectObject(group);
        samples++;
        if (!hits.length) open++;
      }
    assert.ok(
      open / samples > 0.6,
      `${open}/${samples} open rays; no opaque office shell`,
    );
    const p = point(s, 0, 70);
    const hit = new T.Raycaster(
      new T.Vector3(...p),
      new T.Vector3(0, -1, 0),
      0,
      20,
    ).intersectObject(group)[0];
    assert.ok(
      hit && Math.abs(hit.point.y - 64) < 0.001,
      "closed house roof with outward winding",
    );
    const pier = point(s, 0, 11.5);
    assert.ok(
      new T.Raycaster(
        new T.Vector3(...pier),
        new T.Vector3(0, -1, 0),
        0,
        2,
      ).intersectObject(group).length,
    );
  }
});

test("continuous stringers physically connect the actual floor-beam and sleeper elevations", () => {
  const spans = parts.filter(
    (p) => p.role === "steel" && !stations.includes(p.station),
  );
  assert.equal(spans.length, 8);
  for (const span of spans) {
    const mesh = new T.Mesh(span.geometry, new T.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    for (const side of [-0.7175, 0.7175]) {
      // Away from a transverse floor beam, ray the real stringer's two faces.
      const upper = point(span.station + 0.8, side, 12.8);
      const lower = point(span.station + 0.8, side, 12.0);
      const top = new T.Raycaster(
        new T.Vector3(...upper),
        new T.Vector3(0, -1, 0),
        0,
        1,
      ).intersectObject(mesh)[0];
      const bottom = new T.Raycaster(
        new T.Vector3(...lower),
        new T.Vector3(0, 1, 0),
        0,
        1,
      ).intersectObject(mesh)[0];
      assert.ok(top && bottom);
      assert.ok(Math.abs(top.point.y - 12.66) < 1e-4);
      assert.ok(Math.abs(bottom.point.y - 12.36) < 1e-4);
      const floorTop = S.elevation.railTop - 0.3 - 0.5 + 0.35 / 2;
      const sleeperBottom = S.elevation.railTop - 0.3 + 0.03 - 0.18 / 2;
      assert.ok(
        bottom.point.y <= floorTop && top.point.y >= sleeperBottom,
        "no air gap between transverse beam, stringer and sleeper",
      );
    }
  }
});
