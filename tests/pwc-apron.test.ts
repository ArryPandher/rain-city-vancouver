import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { CollisionWorld } from "../src/world/collision";
import { ORIGIN, KX, pointInPoly, type CityData } from "../src/world/data";
import { Batcher } from "../src/world/geometry";
import { buildPwcPlace, type PwcPlaceMaterials } from "../src/world/pwc-place";
import { createPwcLobbySite } from "../src/world/pwc-lobby-site";
import { PWC_PLACE_ID, PWC_PLACE_RING } from "../src/world/pwc-place-site";
import { canadaPlaceApproachGeometry } from "../src/world/canada-place-approach";
import { createExteriorRecessCollision } from "../src/world/exterior-recess-collision";

function data() {
  const d = JSON.parse(
    fs.readFileSync("public/data/vancouver.json", "utf8"),
  ) as CityData;
  const ox = (ORIGIN.lon - d.meta.bbox[1]) * KX,
    oz = (d.meta.bbox[2] - ORIGIN.lat) * 110540;
  const convert = (p: number[]) => p.map((v, i) => v / 2 - (i % 2 ? oz : ox));
  d.buildings.forEach((b) => (b.pts = convert(b.pts)));
  d.areas.forEach((a) => {
    a.pts = convert(a.pts);
    a.holes = a.holes?.map(convert);
  });
  d.ocean = d.ocean.map(convert);
  d.roads = JSON.parse(
    fs.readFileSync("public/data/vancouver-roads.json", "utf8"),
  ).roads;
  return d;
}
const map = data(),
  ground = new CollisionWorld(map),
  site = createPwcLobbySite(ground.baselineGroundHeight.bind(ground));
const previousMap = data();
// Retain the identical footprint as a generic building to disable ONLY PwC's
// new apron/recess factories in this comparison world.
previousMap.buildings.find((b) => b.id === PWC_PLACE_ID)!.id =
  "prior-pwc-footprint";
const previous = new CollisionWorld(previousMap);

test("source-bounded forecourt removes the observed retaining rail while preserving every old Howe grade", () => {
  const apron = ground.canada!.pwcApron!;
  assert.ok(apron);
  assert.ok(apron.contains(465.85, -411.87));
  assert.equal(previous.blocked(465.85, -411.87, 0.4, 1.06), true);
  assert.equal(ground.blocked(465.85, -411.87, 0.4, 1.06), false);
  for (const road of map.roads.filter((r) =>
    ["w232195213", "w1255990033", "w1550614843"].includes(r.id!),
  )) {
    for (let i = 0; i < road.pts.length - 2; i += 2)
      for (let t = 0; t <= 1; t += 0.02) {
        const x = road.pts[i] + (road.pts[i + 2] - road.pts[i]) * t,
          z = road.pts[i + 1] + (road.pts[i + 3] - road.pts[i + 1]) * t;
        assert.equal(
          ground.canada!.supportHeight(x, z),
          previous.canada!.supportHeight(x, z),
        );
      }
  }
  for (const p of apron.supportPolygons)
    for (const [x, z] of p.outer) {
      assert.ok(
        apron.covers(Math.fround(x), Math.fround(z)),
        "Float32 boundary vertices retain the apron sampler",
      );
      assert.ok(
        Number.isFinite(
          ground.canada!.supportHeight(Math.fround(x), Math.fround(z)),
        ),
      );
    }
  assert.equal(
    apron.contains(489, -401),
    false,
    "the forecourt never fills the building interior",
  );
  assert.equal(
    apron.contains(478, -456),
    false,
    "no expansion into the Fairmont route",
  );
});

test("new forecourt remains continuously graded and meets the sloped threshold within its 30mm lip", (t) => {
  const apron = ground.canada!.pwcApron!;
  let maxSlope = 0;
  for (let x = apron.bounds.minX; x < apron.bounds.maxX; x += 0.3)
    for (let z = apron.bounds.minZ; z < apron.bounds.maxZ; z += 0.3) {
      if (!apron.contains(x, z)) continue;
      const y = apron.height(x, z);
      for (const [dx, dz] of [
        [0.05, 0],
        [0, 0.05],
      ]) {
        if (!apron.contains(x + dx, z + dz)) continue;
        maxSlope = Math.max(
          maxSlope,
          Math.abs(apron.height(x + dx, z + dz) - y) / 0.05,
        );
      }
    }
  assert.ok(maxSlope < 0.1, `maximum grade component ${maxSlope}`);
  let low = Infinity,
    high = -Infinity;
  for (const s of site.sections)
    for (let u = s.mouth + 0.1; u < s.frame.length - s.mouth; u += 0.2) {
      const out = s.frame.p(u, 0, -0.045),
        inside = s.frame.p(u, 0, 0.1);
      const floor = site.floorAt(inside[0], inside[2])!;
      assert.ok(
        Math.abs(floor - ground.baselineGroundHeight(out[0], out[2]) - 0.18) <
          0.001,
      );
      assert.ok(
        Math.abs(floor - (apron.height(out[0], out[2]) + 0.15) - 0.03) < 0.001,
      );
      low = Math.min(low, floor);
      high = Math.max(high, floor);
    }
  assert.ok(high < 3.7 && high - low > 2);
  t.diagnostic(
    `forecourt max sampled grade component ${(maxSlope * 100).toFixed(2)}%; lobby floor ${low.toFixed(2)}–${high.toFixed(2)}m`,
  );
});

function assembled(
  callback = ground.baselineGroundHeight.bind(ground),
  datum = 0,
) {
  const root = new T.Group(),
    batch = new Batcher(root);
  batch.offsetY = datum;
  const materials = Object.fromEntries(
    [
      "stone",
      "glass",
      "spandrel",
      "lobbyGlass",
      "metal",
      "backing",
      "roof",
    ].map((name) => [name, new T.MeshStandardMaterial({ name })]),
  ) as unknown as PwcPlaceMaterials;
  buildPwcPlace(
    batch,
    { id: PWC_PLACE_ID, pts: PWC_PLACE_RING.flat() },
    materials,
    callback,
  );
  const meshes = batch.finish();
  root.updateMatrixWorld(true);
  return { root, meshes, materials };
}

test("shared floor triangles match the complete graded mesh and columns/windows meet that floor", () => {
  const { root, meshes, materials } = assembled();
  const ray = new T.Raycaster();
  for (const panel of site.floorPanels) {
    const [a, b, c, d] = panel.corners;
    for (const v of [
      [a, d, c],
      [a, c, b],
    ]) {
      const x = v.reduce((s, p) => s + p[0], 0) / 3,
        z = v.reduce((s, p) => s + p[2], 0) / 3,
        y = site.floorAt(x, z)!;
      if (
        site.columns.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 0.08)
      )
        continue;
      ray.set(new T.Vector3(x, y + 0.15, z), new T.Vector3(0, -1, 0));
      const hit = ray.intersectObject(root, true)[0];
      assert.ok(
        hit && Math.abs(hit.point.y - y) < 0.0001,
        "collision height uses the rendered triangle diagonal",
      );
      assert.equal((hit.object as T.Mesh).material, materials.stone);
    }
  }
  for (const column of site.columns) {
    const y = site.floorAt(column.x, column.z)!;
    assert.ok(column.bottom < y && y - column.bottom < 0.09);
    const f = site.sections.find((s) => s.edge === column.edge)!.frame;
    const out = new T.Vector3(f.outward[0], 0, f.outward[1]);
    ray.set(
      new T.Vector3(column.x, y + 0.04, column.z).addScaledVector(out, 0.8),
      out.negate(),
    );
    const hit = ray.intersectObject(root, true)[0];
    assert.ok(hit && Math.abs(hit.distance - (0.8 - column.radius)) < 0.005);
  }
  for (const s of site.sections)
    for (const u of [3.13, ...(s.entry ? [8.43] : [])]) {
      const depth =
        s.entry && u > s.entry.left && u < s.entry.right
          ? s.entry.depth
          : s.depth;
      const y = s.heightAt(u) + 0.3;
      ray.set(
        new T.Vector3(...s.frame.p(u, y, -0.1)),
        new T.Vector3(-s.frame.outward[0], 0, -s.frame.outward[1]),
      );
      const hit = ray.intersectObject(root, true)[0];
      assert.equal((hit.object as T.Mesh).material, materials.lobbyGlass);
      assert.ok(Math.abs(hit.distance - depth - 0.1) < 0.002);
    }
  assert.equal(
    Math.max(
      ...meshes.flatMap((m) =>
        Array.from(m.geometry.getAttribute("position").array).filter(
          (_, i) => i % 3 === 1,
        ),
      ),
    ),
    83,
  );
});

test("the observed street approach reaches each open recess, with rear glazing still blocking", () => {
  const collision = createExteriorRecessCollision({
    footprint: PWC_PLACE_RING,
    openings: site.openPolygons,
    closures: site.closures,
    columns: site.columns.map((p) => ({ point: [p.x, p.z], radius: p.radius })),
    floorAt: site.floorAt,
    ceiling: site.ceiling,
  });
  for (const s of site.sections) {
    const u = s.edge === 0 ? 8.43 : 5.8,
      target = s.frame.p(u, 0, s.edge === 0 ? 2.8 : 1.8);
    const from = s.frame.p(u, 0, -5);
    for (let i = 0; i <= 100; i++) {
      const x = from[0] + ((target[0] - from[0]) * i) / 100,
        z = from[2] + ((target[2] - from[2]) * i) / 100;
      const y = site.floorAt(x, z) ?? ground.baselineGroundHeight(x, z) + 0.15;
      if (pointInPoly(x, z, PWC_PLACE_RING.flat()))
        assert.equal(collision.blocked(x, z, 0.35, y, false), false);
      else assert.equal(ground.blocked(x, z, 0.35, y), false);
    }
    const back = s.frame.p(
      u,
      s.heightAt(u),
      s.edge === 0 ? s.entry!.depth : s.depth,
    );
    assert.equal(
      collision.blocked(back[0], back[2], 0.35, back[1], false),
      true,
    );
  }
});

test("non-flat callback and nonzero datum produce the same local floor/mesh contract", () => {
  const datum = 2.75,
    callback = (x: number, z: number) =>
      datum + 1.2 + (x - 470) * 0.025 + (z + 410) * 0.012;
  const local = createPwcLobbySite(callback, datum),
    { root } = assembled(callback, datum);
  for (const panel of local.floorPanels.filter((_, i) => i % 7 === 0)) {
    const [a, b, c] = panel.corners,
      x = (a[0] + b[0] + c[0]) / 3,
      z = (a[2] + b[2] + c[2]) / 3;
    if (
      local.columns.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + 0.1)
    )
      continue;
    const y = local.floorAt(x, z)! + datum;
    const hit = new T.Raycaster(
      new T.Vector3(x, y + 0.12, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(root, true)[0];
    assert.ok(hit && Math.abs(hit.point.y - y) < 0.0001);
  }
});

test("actual forecourt render has no float-rounded boundary spikes or holes at the former rail", () => {
  const parts = canadaPlaceApproachGeometry(
    map,
    ground.canada!,
    ground.existingGroundHeight.bind(ground),
  );
  const mesh = new T.Mesh(
    parts.pavement,
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  for (const [x, z] of [
    [465.85, -411.87],
    [470, -410],
    [475, -419],
  ]) {
    const y = ground.canada!.supportHeight(x, z) + 0.15;
    const hit = new T.Raycaster(
      new T.Vector3(x, y + 1, z),
      new T.Vector3(0, -1, 0),
    ).intersectObject(mesh)[0];
    assert.ok(
      hit && Math.abs(hit.point.y - y) < 0.03,
      "rendered apron agrees with the shared support height",
    );
  }
  Object.values(parts).forEach((g) => g.dispose());
});
